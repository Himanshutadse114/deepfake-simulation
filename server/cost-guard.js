const crypto = require('node:crypto');
const config = require('./config');
const { getRedisClient } = require('./redis-client');
const {
  objectStorageConfigured,
  putJson,
  getJson,
  listKeys
} = require('./storage');

const localBudgetReservations = new Map();
const localDailyTotals = new Map();
const localEntitlements = new Map();
let durableLoadedDay = null;
let localMutationLock = Promise.resolve();

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function withLocalLock(operation) {
  const run = localMutationLock.then(operation, operation);
  localMutationLock = run.catch(() => {});
  return run;
}

function budgetError(current, limit, requested) {
  const error = new Error(`Daily AI generation budget is protected. Reserved $${Number(current).toFixed(2)} of the $${Number(limit).toFixed(2)} daily limit; this simulation would reserve another $${Number(requested).toFixed(2)}.`);
  error.status = 429;
  error.code = 'AI_DAILY_BUDGET_LIMIT';
  return error;
}

function durableBudgetPrefix(day) {
  return `control/budget/reservations/${day}/`;
}

function durableBudgetKey(day, sessionId) {
  return `${durableBudgetPrefix(day)}${sessionId}.json`;
}

async function loadDurableDailyBudget(day) {
  if (!objectStorageConfigured() || durableLoadedDay === day) return;

  const keys = (await listKeys(durableBudgetPrefix(day))).filter((key) => key.endsWith('.json'));
  let total = 0;
  localBudgetReservations.clear();

  for (let offset = 0; offset < keys.length; offset += 20) {
    const batch = await Promise.all(keys.slice(offset, offset + 20).map((key) => getJson(key).catch(() => null)));
    for (const item of batch) {
      const amount = Number(item?.amount || 0);
      if (!item?.sessionId || !(amount > 0)) continue;
      localBudgetReservations.set(item.sessionId, amount);
      total += amount;
    }
  }

  localDailyTotals.set(day, total);
  durableLoadedDay = day;
}

async function reserveEstimatedCost(sessionId, amount = config.estimatedSimulationCostUsd) {
  const requested = Number(amount || 0);
  const limit = Number(config.dailyAiBudgetUsd || 0);
  if (!(requested > 0) || !(limit > 0)) return { reserved: 0, limit, total: 0 };

  const redis = getRedisClient();
  const day = utcDay();
  if (redis) {
    const reservationKey = `deepfake:budget:reservation:${sessionId}`;
    const dailyKey = `deepfake:budget:daily:${day}`;
    const script = `
      local existing = redis.call('GET', KEYS[1])
      local current = tonumber(redis.call('GET', KEYS[2]) or '0')
      if existing then
        return {1, current, tonumber(existing)}
      end
      local requested = tonumber(ARGV[1])
      local limit = tonumber(ARGV[2])
      if current + requested > limit then
        return {0, current, requested}
      end
      local updated = redis.call('INCRBYFLOAT', KEYS[2], requested)
      redis.call('EXPIRE', KEYS[2], 172800)
      redis.call('SET', KEYS[1], requested, 'EX', 172800)
      return {1, tonumber(updated), requested}
    `;
    const result = await redis.eval(script, 2, reservationKey, dailyKey, String(requested), String(limit));
    const allowed = Number(result?.[0]) === 1;
    const total = Number(result?.[1] || 0);
    const reserved = Number(result?.[2] || requested);
    if (!allowed) throw budgetError(total, limit, requested);
    return { reserved, limit, total };
  }

  return withLocalLock(async () => {
    if (objectStorageConfigured()) await loadDurableDailyBudget(day);

    if (localBudgetReservations.has(sessionId)) {
      return {
        reserved: localBudgetReservations.get(sessionId),
        limit,
        total: Number(localDailyTotals.get(day) || 0)
      };
    }

    const current = Number(localDailyTotals.get(day) || 0);
    if (current + requested > limit) throw budgetError(current, limit, requested);

    if (objectStorageConfigured()) {
      // Write the immutable per-session reservation before updating the in-memory
      // total. If Render stops immediately afterwards, the next boot recomputes
      // the total from these R2 reservation objects and does not lose the guard.
      await putJson(durableBudgetKey(day, sessionId), {
        sessionId,
        day,
        amount: requested,
        createdAt: new Date().toISOString()
      });
    }

    localBudgetReservations.set(sessionId, requested);
    localDailyTotals.set(day, current + requested);
    return { reserved: requested, limit, total: current + requested };
  });
}

function entitlementObjectKey(identity) {
  const digest = crypto.createHash('sha256')
    .update(`${identity.tenantId}\u0000${identity.campaignId}\u0000${identity.userId}`)
    .digest('hex');
  return `control/entitlements/${digest}.json`;
}

async function reserveLaunchEntitlement(identity, sessionId) {
  if (!identity?.userId || !identity?.tenantId || !identity?.campaignId) return { enforced: false };
  const redisKey = `deepfake:entitlement:${identity.tenantId}:${identity.campaignId}:${identity.userId}`;
  const redis = getRedisClient();

  if (redis) {
    const existing = await redis.get(redisKey);
    if (existing && existing !== sessionId) {
      const error = new Error('This learner already has an AI generation reserved for this campaign.');
      error.status = 409;
      error.code = 'AI_SIMULATION_ALREADY_RESERVED';
      throw error;
    }
    await redis.set(redisKey, sessionId, 'EX', 7 * 24 * 60 * 60, 'NX');
    return { enforced: true };
  }

  return withLocalLock(async () => {
    const key = entitlementObjectKey(identity);
    const now = Date.now();
    let existing = localEntitlements.get(key) || null;
    if (!existing && objectStorageConfigured()) existing = await getJson(key);

    if (existing && Number(existing.expiresAt || 0) > now && existing.sessionId !== sessionId) {
      const error = new Error('This learner already has an AI generation reserved for this campaign.');
      error.status = 409;
      error.code = 'AI_SIMULATION_ALREADY_RESERVED';
      throw error;
    }

    const payload = {
      sessionId,
      tenantId: identity.tenantId,
      campaignId: identity.campaignId,
      userId: identity.userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + (7 * 24 * 60 * 60 * 1000)
    };
    if (objectStorageConfigured()) await putJson(key, payload);
    localEntitlements.set(key, payload);
    return { enforced: true };
  });
}

module.exports = {
  reserveEstimatedCost,
  reserveLaunchEntitlement,
  utcDay,
  durableBudgetPrefix,
  entitlementObjectKey
};
