const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const config = require('../server/config');
const { verifyLaunchToken } = require('../server/launch-token');

function sign(secret, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

test('accepts a valid tenant/user/campaign launch token and rejects tampering', () => {
  const previous = config.launchTokenSecret;
  config.launchTokenSecret = 'unit-test-launch-secret';
  try {
    const token = sign(config.launchTokenSecret, {
      userId: 'user-100',
      tenantId: 'tenant-a',
      campaignId: 'deepfake-aug-2026',
      exp: Math.floor(Date.now() / 1000) + 300
    });
    assert.deepEqual(verifyLaunchToken(token), {
      userId: 'user-100',
      tenantId: 'tenant-a',
      campaignId: 'deepfake-aug-2026',
      exp: Math.floor(Date.now() / 1000) + 300
    });
    assert.throws(() => verifyLaunchToken(`${token.slice(0, -1)}x`), /signature/i);
  } finally {
    config.launchTokenSecret = previous;
  }
});

test('rejects expired launch tokens', () => {
  const previous = config.launchTokenSecret;
  config.launchTokenSecret = 'unit-test-launch-secret';
  try {
    const token = sign(config.launchTokenSecret, {
      userId: 'user-100',
      tenantId: 'tenant-a',
      campaignId: 'deepfake-aug-2026',
      exp: Math.floor(Date.now() / 1000) - 1
    });
    assert.throws(() => verifyLaunchToken(token), /expired/i);
  } finally {
    config.launchTokenSecret = previous;
  }
});
