const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAwarenessScript, validateScriptPair } = require('../server/script-policy');

test('accepts benign awareness scripts', () => {
  const result = validateScriptPair({
    whatsapp: 'This is an AI voice-clone awareness demo. A familiar voice can be faked, so verify unusual requests through a trusted channel.',
    video: 'This is an AI-generated deepfake security simulation. A familiar face and voice are not proof of identity; verify before acting.'
  });
  assert.match(result.whatsapp, /voice-clone/i);
  assert.match(result.video, /deepfake/i);
});

test('allows warnings that mention sensitive scam requests', () => {
  const text = validateAwarenessScript('This is an AI awareness demo. If someone asks you to send money or share an OTP, verify first and report the request.');
  assert.match(text, /send money/i);
});

test('rejects direct credential requests', () => {
  assert.throws(
    () => validateAwarenessScript('This is an AI simulation. Please send me your OTP verification code now.', 'WhatsApp audio script'),
    /cannot directly instruct/i
  );
});

test('rejects direct money transfer requests', () => {
  assert.throws(
    () => validateAwarenessScript('This is an AI voice clone. Please transfer the payment funds immediately.', 'WhatsApp audio script'),
    /cannot directly instruct/i
  );
});

test('rejects unrelated arbitrary speech', () => {
  assert.throws(
    () => validateAwarenessScript('Hello there, I hope you are doing very well today and enjoying your afternoon.', 'Video script'),
    /awareness|verification/i
  );
});
