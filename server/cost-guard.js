const config = require('./config');
const { getRedisClient } = require('./redis-client');

const localReservations = new Map();
const localDailyTotals = new Map();

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function budgetError(current, limit, requested) {
  const error = new Error(`Daily AI generation budget is protected. Reserved $${Number(current).toFixed(2)} of the $${Number(limit).toFixed(2)} daily limit; this simulation would reserve another $${Number(requested).toFixed(2)}.`);
  error.status = 429;
  error.code = 'AI_DAILY_BUDGET_LIMIT';
  return error;
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

  if (localReservations.has(sessionId)) {
    return {
      reserved: localReservations.get(sessionId),
      limit,
      total: Number(localDailyTotals.get(day) || 0)
    };
  }
  const current = Number(localDailyTotals.get(day) || 0);
  if (current + requested > limit) throw budgetError(current, limit, requested);
  localReservations.set(sessionId, requested);
  localDailyTotals.set(day, current + requested);
  return { reserved: requested, limit, total: current + requested };
}

async function reserveLaunchEntitlement(identity, sessionId) {
  if (!identity?.userId || !identity?.tenantId || !identity?.campaignId) return { enforced: false };
  const key = `deepfake:entitlement:${identity.tenantId}:${identity.campaignId}:${identity.userId}`;
  const redis = getRedisClient();

  if (redis) {
    const existing = await redis.get(key);
    if (existing && existing !== sessionId) {
      const error = new Error('This learner already has an AI generation reserved for this campaign.');
      error.status = 409;
      error.code = 'AI_SIMULATION_ALREADY_RESERVED';
      throw error;
    }
    await redis.set(key, sessionId, 'EX', 7 * 24 * 60 * 60, 'NX');
    return { enforced: true };
  }

  const existing = localReservations.get(key);
  if (existing && existing !== sessionId) {
    const error = new Error('This learner already has an AI generation reserved for this campaign.');
    error.status = 409;
    error.code = 'AI_SIMULATION_ALREADY_RESERVED';
    throw error;
  }
  localReservations.set(key, sessionId);
  return { enforced: true };
}

module.exports = { reserveEstimatedCost, reserveLaunchEntitlement, utcDay };
