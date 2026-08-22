const crypto = require('node:crypto');
const config = require('./config');

function decodePayload(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyLaunchToken(token) {
  const secret = String(config.launchTokenSecret || '').trim();
  if (!secret) return null;

  const [encoded, signature, extra] = String(token || '').split('.');
  if (!encoded || !signature || extra) throw new Error('Invalid simulation launch token.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!timingSafeEqualText(signature, expected)) throw new Error('Invalid simulation launch token signature.');

  const payload = decodePayload(encoded);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) <= now) throw new Error('Simulation launch token has expired.');
  if (!payload.userId || !payload.tenantId || !payload.campaignId) throw new Error('Simulation launch token is missing user, tenant or campaign identity.');

  return {
    userId: String(payload.userId).slice(0, 128),
    tenantId: String(payload.tenantId).slice(0, 128),
    campaignId: String(payload.campaignId).slice(0, 128),
    exp: Number(payload.exp)
  };
}

function launchIdentityFromRequest(req) {
  const token = req.get('x-innvikta-launch-token') || req.body?.launchToken || req.query?.launchToken;
  if (!config.launchTokenSecret) {
    if (config.requireLaunchToken) {
      const error = new Error('REQUIRE_LAUNCH_TOKEN is enabled but LAUNCH_TOKEN_SECRET is not configured.');
      error.status = 503;
      throw error;
    }
    return null;
  }

  if (!token) {
    if (!config.requireLaunchToken) return null;
    const error = new Error('A signed Innvikta platform launch token is required for AI generation.');
    error.status = 401;
    throw error;
  }

  try {
    return verifyLaunchToken(token);
  } catch (cause) {
    const error = new Error(cause.message);
    error.status = 401;
    throw error;
  }
}

module.exports = { verifyLaunchToken, launchIdentityFromRequest };
