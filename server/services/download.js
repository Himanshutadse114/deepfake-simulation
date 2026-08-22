const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(attempt) {
  return [2000, 5000, 10_000, 20_000, 30_000][Math.min(attempt, 4)];
}

async function streamResponseToFile(response, targetPath) {
  if (!response.body) throw new Error('Download response had no body.');
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.part`;
  await fs.rm(temporaryPath, { force: true }).catch(() => {});

  const source = typeof response.body.pipe === 'function'
    ? response.body
    : Readable.fromWeb(response.body);

  try {
    await pipeline(source, fsSync.createWriteStream(temporaryPath, { mode: 0o600 }));
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function downloadWithRetry(url, targetPath, {
  label = 'Generated asset',
  attempts = 5,
  timeoutMs = 120_000
} = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`${label} download failed (${response.status}).`);
      await streamResponseToFile(response, targetPath);
      return targetPath;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await sleep(retryDelay(attempt));
    }
  }
  const error = new Error(`${label} could not be downloaded after ${attempts} attempts: ${lastError?.message || 'unknown error'}`);
  error.code = 'GENERATED_ASSET_DOWNLOAD_FAILED';
  throw error;
}

module.exports = { downloadWithRetry, streamResponseToFile, retryDelay };
