const { Queue, Worker, UnrecoverableError } = require('bullmq');
const config = require('./config');
const { redisConfigured, createRedisConnection } = require('./redis-client');
const { objectStorageConfigured } = require('./storage');

let queue = null;
let worker = null;
let queueConnection = null;
let workerConnection = null;

const localJobs = [];
const localJobIds = new Set();
let localActive = 0;

function queueMode() {
  if (redisConfigured()) return 'bullmq';
  return objectStorageConfigured() ? 'durable-r2-local' : 'bounded-local';
}

function assertDistributedStorageReady() {
  const productionNeedsDurability = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if ((redisConfigured() || productionNeedsDurability) && !objectStorageConfigured()) {
    const error = new Error('Paid AI generation is blocked because private durable object storage is not configured. Configure the Cloudflare R2/S3 environment variables before starting production AI work.');
    error.status = 503;
    error.code = 'DURABLE_OBJECT_STORAGE_REQUIRED';
    throw error;
  }
}

function getQueue() {
  if (!redisConfigured()) return null;
  if (!queue) {
    queueConnection = createRedisConnection({ role: 'bullmq' });
    queue = new Queue(config.queueName, { connection: queueConnection });
  }
  return queue;
}

function unsafeAutomaticResumeReason(session) {
  for (const [name, stage] of Object.entries(session?.stages || {})) {
    if (!stage) continue;
    if (stage.status === 'provider_failed') {
      return `${name} ended in a terminal provider failure.`;
    }
    if (stage.status === 'creation_ambiguous') {
      return `${name} may have been accepted by the provider but no prediction ID was safely persisted.`;
    }
    if (stage.status === 'creation_started' && !stage.predictionId) {
      return `${name} had begun paid prediction creation but no prediction ID was persisted before the process stopped.`;
    }
  }
  return null;
}

async function markFinalWorkerFailure(sessionId, error) {
  const { getSession, updateStatus, saveSession } = require('./store');
  const session = await getSession(sessionId);
  if (!session || session.status === 'completed' || session.status === 'failed') return;
  updateStatus(session, 'failed', error?.message || 'Generation worker failed after retrying safely.');
  await saveSession(session);
  await scheduleSessionCleanup(session.id, config.retentionMs).catch(() => {});
}

async function processLocalQueue() {
  const limit = Math.max(1, Number(config.aiWorkerConcurrency || 4));
  while (localActive < limit && localJobs.length) {
    const job = localJobs.shift();
    localActive += 1;
    setImmediate(async () => {
      try {
        if (job.name === 'generate') {
          const { getSession } = require('./store');
          const { generateSimulation } = require('./pipeline');
          const session = await getSession(job.data.sessionId);
          if (session) await generateSimulation(session);
        } else if (job.name === 'cleanup') {
          await handleCleanupJob(job.data.sessionId);
        }
      } catch (error) {
        console.warn(`[local-queue:${job.name}] ${error.stack || error.message}`);
        if (job.name === 'generate') {
          await markFinalWorkerFailure(job.data.sessionId, error).catch((cause) => {
            console.warn(`[local-queue-failure:${job.data.sessionId}] ${cause.message}`);
          });
        }
      } finally {
        localActive = Math.max(0, localActive - 1);
        localJobIds.delete(job.id);
        processLocalQueue();
      }
    });
  }
}

async function enqueueGeneration(session) {
  assertDistributedStorageReady();
  const attempt = Math.max(1, Number(session.queueAttempt || 1));
  const id = `simulation-${session.id}-${attempt}`;

  if (!redisConfigured()) {
    if (localJobIds.has(id)) return { id, mode: queueMode() };
    if (localJobs.filter((job) => job.name === 'generate').length + localActive >= config.maxQueuedJobs) {
      const error = new Error('The simulation generation queue is full. Please try again shortly.');
      error.status = 503;
      error.code = 'GENERATION_QUEUE_FULL';
      throw error;
    }
    localJobIds.add(id);
    localJobs.push({ id, name: 'generate', data: { sessionId: session.id } });
    processLocalQueue();
    return { id, mode: queueMode() };
  }

  const q = getQueue();
  const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total >= config.maxQueuedJobs) {
    const error = new Error('The simulation generation queue is full. Please try again shortly.');
    error.status = 503;
    error.code = 'GENERATION_QUEUE_FULL';
    throw error;
  }

  const job = await q.add('generate', { sessionId: session.id }, {
    jobId: id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600, count: 2000 }
  });
  return { id: job.id, mode: queueMode() };
}

async function recoverDurableLocalQueue() {
  if (redisConfigured()) return { mode: 'bullmq', recoveredSessions: 0, requeued: 0, blocked: 0, expired: 0 };
  if (!objectStorageConfigured()) return { mode: 'bounded-local', recoveredSessions: 0, requeued: 0, blocked: 0, expired: 0 };

  const {
    recoverSessionsFromObjectStorage,
    saveSession,
    updateStatus,
    deleteSession
  } = require('./store');

  const recovered = await recoverSessionsFromObjectStorage();
  let requeued = 0;
  let blocked = 0;
  let expired = 0;
  const now = Date.now();

  for (const session of recovered) {
    const terminalOrCollecting = ['collecting', 'completed', 'failed'].includes(session.status);
    if (session.expiresAt !== null && session.expiresAt !== undefined && Number(session.expiresAt) <= now) {
      await deleteSession(session.id, { cancelPredictions: false }).catch(() => {});
      expired += 1;
      continue;
    }
    if (terminalOrCollecting) continue;

    const unsafeReason = unsafeAutomaticResumeReason(session);
    if (unsafeReason) {
      updateStatus(
        session,
        'failed',
        `Automatic recovery stopped to prevent duplicate AI spend. ${unsafeReason} Start a new paid attempt only if you intentionally want to regenerate this stage.`
      );
      await saveSession(session);
      blocked += 1;
      continue;
    }

    session.queueAttempt = Math.max(1, Number(session.queueAttempt || 1));
    updateStatus(session, 'queued', 'Recovered after a Render restart. Existing provider prediction IDs and generated checkpoints will be reused.');
    await saveSession(session);
    await enqueueGeneration(session);
    requeued += 1;
  }

  return {
    mode: queueMode(),
    recoveredSessions: recovered.length,
    requeued,
    blocked,
    expired
  };
}

async function scheduleSessionCleanup(sessionId, delayMs = config.retentionMs) {
  const delay = Math.max(1000, Number(delayMs || config.retentionMs));
  const id = `cleanup-${sessionId}-${Date.now()}`;

  if (!redisConfigured()) {
    setTimeout(() => {
      localJobs.push({ id, name: 'cleanup', data: { sessionId } });
      localJobIds.add(id);
      processLocalQueue();
    }, delay).unref?.();
    return { id, mode: queueMode() };
  }

  const job = await getQueue().add('cleanup', { sessionId }, {
    jobId: id,
    delay,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: true,
    removeOnFail: { age: 24 * 3600, count: 1000 }
  });
  return { id: job.id, mode: queueMode() };
}

async function cancelQueuedGeneration(session) {
  if (!session) return;
  if (!redisConfigured()) {
    for (let index = localJobs.length - 1; index >= 0; index -= 1) {
      if (localJobs[index].name === 'generate' && localJobs[index].data.sessionId === session.id) {
        localJobIds.delete(localJobs[index].id);
        localJobs.splice(index, 1);
      }
    }
    return;
  }

  const q = getQueue();
  const attempts = Math.max(1, Number(session.queueAttempt || 1));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const job = await q.getJob(`simulation-${session.id}-${attempt}`);
    if (!job) continue;
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed' || state === 'prioritized') await job.remove().catch(() => {});
  }
}

async function handleCleanupJob(sessionId) {
  const { getSession, deleteSession } = require('./store');
  const session = await getSession(sessionId);
  if (!session) {
    const { deleteSessionPrefix } = require('./storage');
    await deleteSessionPrefix(sessionId);
    return;
  }

  if (session.expiresAt === null || session.expiresAt === undefined) {
    await scheduleSessionCleanup(sessionId, 10 * 60_000);
    return;
  }

  const remaining = Number(session.expiresAt) - Date.now();
  if (remaining > 0) {
    await scheduleSessionCleanup(sessionId, remaining + 1000);
    return;
  }
  await deleteSession(sessionId, { cancelPredictions: false });
}

function startGenerationWorker() {
  if (!redisConfigured()) throw new Error('REDIS_URL is required to start the distributed generation worker.');
  assertDistributedStorageReady();
  if (worker) return worker;

  workerConnection = createRedisConnection({ role: 'bullmq' });
  worker = new Worker(config.queueName, async (job) => {
    if (job.name === 'cleanup') {
      await handleCleanupJob(job.data.sessionId);
      return { cleaned: true };
    }
    if (job.name !== 'generate') throw new UnrecoverableError(`Unsupported job type: ${job.name}`);

    const { getSession } = require('./store');
    const { generateSimulation } = require('./pipeline');
    const session = await getSession(job.data.sessionId);
    if (!session) return { missing: true };

    try {
      await generateSimulation(session);
      return { completed: true };
    } catch (error) {
      if (error?.nonRetryable) {
        job.discard();
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }, {
    connection: workerConnection,
    concurrency: Math.max(1, Number(config.aiWorkerConcurrency || 4)),
    maxStalledCount: 1,
    lockDuration: 5 * 60_000
  });

  worker.on('failed', (job, error) => {
    if (!job || job.name !== 'generate') return;
    const attempts = Number(job.opts.attempts || 1);
    if (job.attemptsMade >= attempts || error?.name === 'UnrecoverableError') {
      markFinalWorkerFailure(job.data.sessionId, error).catch((cause) => console.warn(`[worker-failure] ${cause.message}`));
    }
  });
  worker.on('error', (error) => console.error(`[generation-worker] ${error.stack || error.message}`));
  return worker;
}

async function getQueueStats() {
  if (!redisConfigured()) {
    return {
      mode: queueMode(),
      active: localActive,
      waiting: localJobs.filter((job) => job.name === 'generate').length,
      durableState: objectStorageConfigured()
    };
  }
  const counts = await getQueue().getJobCounts('waiting', 'active', 'delayed', 'failed');
  return { mode: queueMode(), ...counts };
}

async function closeQueue() {
  await worker?.close().catch(() => {});
  await queue?.close().catch(() => {});
  worker = null;
  queue = null;
  workerConnection?.disconnect();
  queueConnection?.disconnect();
  workerConnection = null;
  queueConnection = null;
}

module.exports = {
  queueMode,
  enqueueGeneration,
  recoverDurableLocalQueue,
  unsafeAutomaticResumeReason,
  scheduleSessionCleanup,
  cancelQueuedGeneration,
  startGenerationWorker,
  getQueueStats,
  closeQueue,
  assertDistributedStorageReady
};
