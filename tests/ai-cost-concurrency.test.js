const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../server/config');
const { unsafeAutomaticResumeReason } = require('../server/queue');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const routes = read('server/routes.js');
const queue = read('server/queue.js');
const store = read('server/store.js');
const storage = read('server/storage.js');
const costGuard = read('server/cost-guard.js');
const pipeline = read('server/pipeline.js');
const media = read('server/media.js');
const prediction = read('server/services/replicate-prediction.js');
const render = read('render.yaml');

 test('defaults to four paid pipelines and two local media processes in one-service mode', () => {
  assert.equal(config.aiWorkerConcurrency, 4);
  assert.equal(config.ffmpegConcurrency, 2);
  assert.equal(config.maxQueuedJobs, 250);
  assert.match(queue, /durable-r2-local/);
});

test('generate endpoint queues work instead of launching an unbounded pipeline', () => {
  assert.match(routes, /enqueueGeneration\(session\)/);
  assert.doesNotMatch(routes, /setImmediate\(\(\)\s*=>\s*generateSimulation/);
});

test('single-service sessions and unfinished queue state are durable in R2', () => {
  assert.match(store, /state\/session\.json/);
  assert.match(store, /putJson\(sessionStateObjectKey/);
  assert.match(store, /recoverSessionsFromObjectStorage/);
  assert.match(queue, /recoverDurableLocalQueue/);
  assert.match(storage, /ListObjectsV2Command/);
});

test('recovery blocks ambiguous paid creation but resumes a persisted prediction id', () => {
  assert.match(
    unsafeAutomaticResumeReason({ stages: { qwen: { status: 'creation_started', predictionId: null } } }),
    /no prediction ID was persisted/i
  );
  assert.match(
    unsafeAutomaticResumeReason({ stages: { flux: { status: 'creation_ambiguous', predictionId: null } } }),
    /may have been accepted/i
  );
  assert.equal(
    unsafeAutomaticResumeReason({ stages: { pruna: { status: 'provider_running', predictionId: 'pred_123' } } }),
    null
  );
});

test('daily budget and learner entitlement survive a Render restart through R2', () => {
  assert.match(costGuard, /control\/budget\/reservations/);
  assert.match(costGuard, /control\/entitlements/);
  assert.match(costGuard, /putJson/);
  assert.match(costGuard, /listKeys/);
});

test('uploads use disk staging rather than multer memoryStorage', () => {
  assert.match(media, /multer\.diskStorage/);
  assert.doesNotMatch(media, /multer\.memoryStorage/);
});

test('video audio is capped to the same duration that Pruna output keeps', () => {
  assert.match(pipeline, /maxSeconds:\s*config\.maxVideoSeconds/);
  assert.equal(config.maxVideoSeconds, 10);
});

test('paid stages checkpoint the creation boundary before the provider request', () => {
  assert.match(pipeline, /onBeforePredictionCreate/);
  assert.match(pipeline, /creation_started/);
  assert.match(routes, /NEW_PAID_ATTEMPT_REQUIRED/);
});

test('Replicate creation uses async mode and fails closed on ambiguous POST outcomes', () => {
  assert.doesNotMatch(prediction, /Prefer:\s*['"]wait/);
  assert.match(prediction, /REPLICATE_CREATE_AMBIGUOUS/);
  assert.match(prediction, /nonRetryable = true/);
});

test('Render blueprint contains only the one durable R2-backed web service', () => {
  assert.match(render, /type:\s*web/);
  assert.doesNotMatch(render, /type:\s*worker/);
  assert.doesNotMatch(render, /type:\s*keyvalue/);
  assert.doesNotMatch(render, /REDIS_URL/);
  assert.match(render, /AI_WORKER_CONCURRENCY[\s\S]*value:\s*4/);
  assert.match(render, /FFMPEG_CONCURRENCY[\s\S]*value:\s*2/);
  assert.match(render, /S3_BUCKET/);
});
