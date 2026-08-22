const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('./config');

let s3 = null;

function objectStorageConfigured() {
  if (!config.storage?.bucket) return false;
  // Custom S3-compatible endpoints such as Cloudflare R2 need explicit
  // credentials on Render. Native AWS S3 can still use the SDK credential chain.
  if (config.storage.endpoint) {
    return Boolean(config.storage.accessKeyId && config.storage.secretAccessKey);
  }
  return true;
}

function objectRef(key) {
  return `object://${key}`;
}

function isObjectRef(value) {
  return typeof value === 'string' && value.startsWith('object://');
}

function keyFromRef(value) {
  if (!isObjectRef(value)) return null;
  return value.slice('object://'.length);
}

function getS3() {
  if (!objectStorageConfigured()) return null;
  if (s3) return s3;

  const options = {
    region: config.storage.region || 'auto',
    forcePathStyle: Boolean(config.storage.forcePathStyle),
    maxAttempts: 5
  };
  if (config.storage.endpoint) options.endpoint = config.storage.endpoint;
  if (config.storage.accessKeyId && config.storage.secretAccessKey) {
    options.credentials = {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey
    };
  }
  s3 = new S3Client(options);
  return s3;
}

async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function putJson(key, value) {
  if (!objectStorageConfigured()) throw new Error('Object storage is not configured.');
  await getS3().send(new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: String(key).replace(/^\/+/, ''),
    Body: `${JSON.stringify(value)}\n`,
    ContentType: 'application/json',
    CacheControl: 'private, no-store'
  }));
  return key;
}

async function getJson(key) {
  if (!objectStorageConfigured()) return null;
  try {
    const response = await getS3().send(new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: String(key).replace(/^\/+/, '')
    }));
    if (!response.Body) return null;
    const raw = await bodyToBuffer(response.Body);
    return JSON.parse(raw.toString('utf8'));
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') return null;
    throw error;
  }
}

async function listKeys(prefix) {
  if (!objectStorageConfigured()) return [];
  const keys = [];
  let continuationToken;
  do {
    const page = await getS3().send(new ListObjectsV2Command({
      Bucket: config.storage.bucket,
      Prefix: String(prefix || '').replace(/^\/+/, ''),
      ContinuationToken: continuationToken
    }));
    for (const item of page.Contents || []) {
      if (item.Key) keys.push(item.Key);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function deleteKey(key) {
  if (!objectStorageConfigured() || !key) return;
  await getS3().send(new DeleteObjectCommand({
    Bucket: config.storage.bucket,
    Key: String(key).replace(/^\/+/, '')
  })).catch(() => {});
}

async function putFile(localPath, key, contentType) {
  if (!objectStorageConfigured()) throw new Error('Object storage is not configured.');
  await getS3().send(new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: fsSync.createReadStream(localPath),
    ContentType: contentType,
    CacheControl: 'private, no-store'
  }));
  return objectRef(key);
}

async function persistInputFile(sessionId, kind, localPath, extension, contentType) {
  if (objectStorageConfigured()) {
    const key = `sessions/${sessionId}/input/${kind}.${extension}`;
    try {
      return await putFile(localPath, key, contentType);
    } finally {
      await fs.rm(localPath, { force: true }).catch(() => {});
    }
  }

  const directory = path.join(config.uploadRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, `${kind}.${extension}`);
  if (path.resolve(localPath) !== path.resolve(target)) {
    await fs.rm(target, { force: true }).catch(() => {});
    await fs.rename(localPath, target);
  }
  return target;
}

async function persistGeneratedFile(sessionId, relativeName, localPath, contentType) {
  if (objectStorageConfigured()) {
    const key = `sessions/${sessionId}/generated/${relativeName.replace(/^\/+/, '')}`;
    return putFile(localPath, key, contentType);
  }

  const directory = path.join(config.uploadRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, path.basename(relativeName));
  if (path.resolve(localPath) !== path.resolve(target)) await fs.copyFile(localPath, target);
  return target;
}

async function persistTemporaryProviderFile(sessionId, name, localPath, contentType) {
  if (!objectStorageConfigured()) return localPath;
  const key = `sessions/${sessionId}/provider-temp/${path.basename(name)}`;
  return putFile(localPath, key, contentType);
}

async function materialize(ref, targetPath) {
  if (!ref) throw new Error('Asset reference is missing.');
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  if (!isObjectRef(ref)) {
    if (/^https?:\/\//i.test(ref)) {
      const response = await fetch(ref, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok || !response.body) throw new Error(`Could not download asset (${response.status}).`);
      const { Readable } = require('node:stream');
      const source = typeof response.body.pipe === 'function' ? response.body : Readable.fromWeb(response.body);
      await pipeline(source, fsSync.createWriteStream(targetPath, { mode: 0o600 }));
      return targetPath;
    }
    if (path.resolve(ref) !== path.resolve(targetPath)) await fs.copyFile(ref, targetPath);
    return targetPath;
  }

  const response = await getS3().send(new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: keyFromRef(ref)
  }));
  if (!response.Body) throw new Error('Object storage returned no asset body.');
  await pipeline(response.Body, fsSync.createWriteStream(targetPath, { mode: 0o600 }));
  return targetPath;
}

async function toProviderUri(ref, mime = 'application/octet-stream', { expiresIn = 900 } = {}) {
  if (!ref) throw new Error('Provider input asset is missing.');
  if (/^https?:\/\//i.test(ref)) return ref;

  if (isObjectRef(ref)) {
    return getSignedUrl(getS3(), new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: keyFromRef(ref)
    }), { expiresIn });
  }

  const bytes = await fs.readFile(ref);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function sendAsset(res, ref, { contentType, filename } = {}) {
  if (!ref) throw new Error('Asset is unavailable.');
  res.setHeader('cache-control', 'private, no-store');
  if (contentType) res.setHeader('content-type', contentType);
  if (filename) res.setHeader('content-disposition', `inline; filename="${filename}"`);

  if (!isObjectRef(ref)) {
    return res.sendFile(ref);
  }

  const response = await getS3().send(new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: keyFromRef(ref)
  }));
  if (!response.Body) throw new Error('Object storage returned no asset body.');
  if (response.ContentLength) res.setHeader('content-length', String(response.ContentLength));
  if (!contentType && response.ContentType) res.setHeader('content-type', response.ContentType);
  response.Body.on('error', (error) => res.destroy(error));
  response.Body.pipe(res);
}

async function deleteRef(ref) {
  if (!ref) return;
  if (isObjectRef(ref)) {
    await deleteKey(keyFromRef(ref));
    return;
  }
  if (!/^https?:\/\//i.test(ref)) await fs.rm(ref, { force: true }).catch(() => {});
}

async function deleteSessionPrefix(sessionId) {
  if (!objectStorageConfigured()) {
    await fs.rm(path.join(config.uploadRoot, sessionId), { recursive: true, force: true }).catch(() => {});
    await fs.rm(path.join(config.workRoot, sessionId), { recursive: true, force: true }).catch(() => {});
    return;
  }

  const prefix = `sessions/${sessionId}/`;
  let continuationToken;
  do {
    const page = await getS3().send(new ListObjectsV2Command({
      Bucket: config.storage.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    const objects = (page.Contents || []).map((item) => ({ Key: item.Key })).filter((item) => item.Key);
    if (objects.length) {
      await getS3().send(new DeleteObjectsCommand({
        Bucket: config.storage.bucket,
        Delete: { Objects: objects, Quiet: true }
      }));
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  await fs.rm(path.join(config.workRoot, sessionId), { recursive: true, force: true }).catch(() => {});
}

module.exports = {
  objectStorageConfigured,
  objectRef,
  isObjectRef,
  keyFromRef,
  putJson,
  getJson,
  listKeys,
  deleteKey,
  persistInputFile,
  persistGeneratedFile,
  persistTemporaryProviderFile,
  materialize,
  toProviderUri,
  sendAsset,
  deleteRef,
  deleteSessionPrefix
};
