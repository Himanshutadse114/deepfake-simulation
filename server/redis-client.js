const IORedis = require('ioredis');

let sharedClient = null;

function redisConfigured() {
  return Boolean(String(process.env.REDIS_URL || '').trim());
}

function createRedisConnection({ role = 'general' } = {}) {
  const url = String(process.env.REDIS_URL || '').trim();
  if (!url) return null;

  const client = new IORedis(url, {
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: role === 'bullmq' ? null : 3,
    connectTimeout: 10_000,
    commandTimeout: 10_000
  });

  client.on('error', (error) => {
    console.warn(`[redis:${role}] ${error.message}`);
  });

  return client;
}

function getRedisClient() {
  if (!redisConfigured()) return null;
  if (!sharedClient) sharedClient = createRedisConnection({ role: 'general' });
  return sharedClient;
}

async function closeRedisClient() {
  if (!sharedClient) return;
  const client = sharedClient;
  sharedClient = null;
  await client.quit().catch(() => client.disconnect());
}

module.exports = {
  redisConfigured,
  createRedisConnection,
  getRedisClient,
  closeRedisClient
};
