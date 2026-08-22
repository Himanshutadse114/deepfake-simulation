require('dotenv').config();

const fs = require('node:fs/promises');
const config = require('./config');
const { startGenerationWorker, closeQueue } = require('./queue');
const { closeRedisClient } = require('./redis-client');

async function start() {
  await fs.mkdir(config.workRoot, { recursive: true });
  await fs.mkdir(config.uploadRoot, { recursive: true });
  const worker = startGenerationWorker();
  console.log(`Deepfake generation worker started with concurrency ${config.aiWorkerConcurrency} and media-process limit ${config.ffmpegConcurrency}.`);

  const shutdown = async (signal) => {
    console.log(`Generation worker received ${signal}; draining active work.`);
    await worker.close().catch(() => {});
    await closeQueue().catch(() => {});
    await closeRedisClient().catch(() => {});
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
