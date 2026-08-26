const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const { validateAwarenessScript, validateScriptPair } = require('../server/script-policy');

test('uses env-backed script policy defaults', () => {
  assert.equal(config.scriptPolicy.minChars, 20);
  assert.equal(config.scriptPolicy.maxChars, 180);
  assert.equal(config.scriptPolicy.blockUrls, true);
  assert.equal(config.scriptPolicy.requireAwarenessContext, false);
});

test('accepts benign awareness scripts', () => {
  const result = validateScriptPair({
    whatsapp: 'This is an AI voice-clone awareness demo. A familiar voice can be faked, so verify unusual requests through a trusted channel.',
    video: 'This is an AI-generated deepfake security simulation. A familiar face and voice are not proof of identity; verify before acting.'
  });
  assert.match(result.whatsapp, /voice-clone/i);
  assert.match(result.video, /deepfake/i);
});

test('accepts benign admin-defined dialogue when awareness-context requirement is disabled', () => {
  const text = validateAwarenessScript('Hi, please call me back when you have a moment. I wanted to discuss the project update with you.');
  assert.match(text, /project update/i);
});

test('allows warnings that mention sensitive scam requests', () => {
  const text = validateAwarenessScript('This is an AI awareness demo. If someone asks you to send money or share an OTP, verify first and report the request.');
  assert.match(text, /send money/i);
});

test('permits admin-defined credential-request dialogue while lexical blocking is intentionally cleared', () => {
  const text = validateAwarenessScript(
    'This is an AI simulation. Please send me your OTP verification code now.',
    'WhatsApp audio script'
  );
  assert.match(text, /OTP verification code/i);
});

test('permits admin-defined money-request dialogue while lexical blocking is intentionally cleared', () => {
  const text = validateAwarenessScript(
    'This is an AI voice clone. Please transfer the payment funds immediately.',
    'WhatsApp audio script'
  );
  assert.match(text, /transfer the payment funds/i);
});

test('still rejects URLs when URL blocking is enabled', () => {
  assert.throws(
    () => validateAwarenessScript('This is an awareness simulation. Open https://example.com to continue the scenario.'),
    /cannot contain links or domains/i
  );
});
