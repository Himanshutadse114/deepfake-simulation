const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../server/config');
const { assertDistributedStorageReady } = require('../server/queue');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const routes = read('server/routes.js');
const queue = read('server/queue.js');
const pipeline = read('server/pipeline.js');
const media = read('server/media.js');
const prediction = read('server/services/replicate-prediction.js');
const render = read('render.yaml');

test('defaults to a bounded five-pipeline worker pool and two local media processes', () => {
  assert.equal(config.aiWorkerConcurrency, 5);
  assert.equal(config.ffmpegConcurrency, 2);
  assert.equal(config.maxQueuedJobs, 500);
  assert.match(queue, /concurrency:\s*Math\.max\(1, Number\(config\.aiWorkerConcurrency/);
});

test('generate endpoint queues work instead of launching an unbounded in-process pipeline', () => {
  assert.match(routes, /enqueueGeneration\(session\)/);
  assert.doesNotMatch(routes, /setImmediate\(\(\)\s*=>\s*generateSimulation/);
});

test('distributed queue requires shared object storage before any worker job is admitted', () => {
  assert.match(queue, /SHARED_OBJECT_STORAGE_REQUIRED/);
  assert.match(queue, /assertDistributedStorageReady\(\)/);
  assert.equal(typeof assertDistributedStorageReady, 'function');
});

test('uploads use disk staging rather than multer memoryStorage', () => {
  assert.match(media, /multer\.diskStorage/);
  assert.doesNotMatch(media, /multer\.memoryStorage/);
});

test('video audio is capped to the same duration that Pruna output keeps', () => {
  assert.match(pipeline, /maxSeconds:\s*config\.maxVideoSeconds/);
  assert.equal(config.maxVideoSeconds, 10);
});

test('Replicate creation uses async mode and fails closed on ambiguous POST outcomes', () => {
  assert.doesNotMatch(prediction, /Prefer:\s*['"]wait/);
  assert.match(prediction, /REPLICATE_CREATE_AMBIGUOUS/);
  assert.match(prediction, /nonRetryable = true/);
});

test('Render blueprint provisions persistent no-eviction queue and separate standard worker', () => {
  assert.match(render, /type:\s*keyvalue/);
  assert.match(render, /plan:\s*starter/);
  assert.match(render, /maxmemoryPolicy:\s*noeviction/);
  assert.match(render, /persistenceMode:\s*journal-snapshot/);
  assert.match(render, /type:\s*worker/);
  assert.match(render, /plan:\s*standard/);
  assert.match(render, /dockerCommand:\s*node server\/worker\.js/);
  assert.match(render, /AI_WORKER_CONCURRENCY[\s\S]*value:\s*5/);
  assert.match(render, /FFMPEG_CONCURRENCY[\s\S]*value:\s*2/);
});
