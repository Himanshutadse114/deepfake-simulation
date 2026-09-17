const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../server/config');
const { unsafeAutomaticResumeReason } = require('../server/queue');
const { reserveRedisEntitlement } = require('../server/cost-guard');

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
const admin = read('server/admin.js');
const adminUi = read('client/public/admin-ui.js');
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
  assert.match(routes, /generationHasStarted/);
  assert.match(routes, /alreadyStarted: true/);
});

test('shutdown stops new local queue admission and dispatch', () => {
  assert.match(queue, /let queueClosing = false/);
  assert.match(queue, /if \(queueClosing\) return/);
  assert.match(queue, /GENERATION_QUEUE_DRAINING/);
  assert.match(queue, /async function closeQueue\(\) \{[\s\S]*queueClosing = true/);
});

test('single-service sessions and unfinished queue state are durable in R2', () => {
  assert.match(store, /state\/session\.json/);
  assert.match(store, /putJson\(sessionStateObjectKey/);
  assert.match(store, /recoverSessionsFromObjectStorage/);
  assert.match(queue, /recoverDurableLocalQueue/);
  assert.match(storage, /ListObjectsV2Command/);
});

test('production paid generation fails closed without durable object storage', () => {
  assert.match(queue, /DURABLE_OBJECT_STORAGE_REQUIRED/);
  assert.match(queue, /NODE_ENV/);
  assert.match(queue, /enqueueGeneration\(session\)[\s\S]*assertDistributedStorageReady\(\)/);
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

test('Redis learner entitlement admission is atomic across concurrent web instances', async () => {
  const redis = {
    async eval(_script, keyCount, key, sessionId, ttl) {
      assert.equal(keyCount, 1);
      assert.equal(key, 'entitlement-key');
      assert.equal(sessionId, 'session-b');
      assert.equal(Number(ttl), 7 * 24 * 60 * 60);
      return [0, 'session-a'];
    }
  };

  await assert.rejects(
    reserveRedisEntitlement(redis, 'entitlement-key', 'session-b'),
    (error) => error?.code === 'AI_SIMULATION_ALREADY_RESERVED' && error?.status === 409
  );
});

test('uploads use disk staging rather than multer memoryStorage', () => {
  assert.match(media, /multer\.diskStorage/);
  assert.doesNotMatch(media, /multer\.memoryStorage/);
});

test('audio is unrestricted while the delivered Pruna video is capped to ten seconds', () => {
  assert.doesNotMatch(pipeline, /Generated video audio[^\n]*maxSeconds/);
  assert.equal(config.maxVideoSeconds, 10);
  assert.match(pipeline, /createWatermarkedVideo\(sourceUrl, rawVideoPath, outputPath, \{ maxSeconds: config\.maxVideoSeconds \}\)/);
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

test('admin page has a protected real R2 write-read-delete connection test', () => {
  assert.match(admin, /router\.post\('\/storage-test', requireAdmin/);
  assert.match(admin, /putJson\(key, probe\)/);
  assert.match(admin, /getJson\(key\)/);
  assert.match(admin, /deleteKey\(key\)/);
  assert.match(adminUi, /Test R2 connection|testStorage/);
  assert.match(adminUi, /\/api\/admin\/storage-test/);
});

test('Render blueprint contains only the one durable R2-backed web service', () => {
  assert.match(render, /type:\s*web/);
  assert.doesNotMatch(render, /type:\s*worker/);
  assert.doesNotMatch(render, /type:\s*keyvalue/);
  assert.doesNotMatch(render, /REDIS_URL/);
  assert.match(render, /AI_WORKER_CONCURRENCY[\s\S]*value:\s*4/);
  assert.match(render, /FFMPEG_CONCURRENCY[\s\S]*value:\s*2/);
  assert.match(render, /MAX_VIDEO_SECONDS[\s\S]*value:\s*10/);
  assert.doesNotMatch(render, /MAX_GENERATED_AUDIO_SECONDS/);
  assert.match(render, /S3_BUCKET/);
});
