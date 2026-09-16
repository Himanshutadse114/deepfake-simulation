const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const { predictionCreateRequest } = require('../server/services/replicate-prediction');

test('routes pinned community models through the generic predictions endpoint', () => {
  const input = { audio: 'data:audio/wav;base64,AA==' };
  const request = predictionCreateRequest(config.providers.whisperModel, input);
  assert.equal(request.url, 'https://api.replicate.com/v1/predictions');
  assert.equal(request.type, 'versioned');
  assert.equal(request.body.version, config.providers.whisperModel);
  assert.equal(request.body.input, input);
  assert.match(config.providers.whisperModel, /^openai\/whisper:[a-f0-9]{64}$/);
});

test('keeps official Qwen models on the official-model endpoint', () => {
  const input = { text: 'Administrator script' };
  const request = predictionCreateRequest('qwen/qwen3-tts', input);
  assert.equal(request.url, 'https://api.replicate.com/v1/models/qwen/qwen3-tts/predictions');
  assert.equal(request.type, 'official');
  assert.deepEqual(request.body, { input });
});

test('rejects unversioned community-style identifiers instead of sending a malformed URL', () => {
  assert.throws(
    () => predictionCreateRequest('openai/whisper:not-a-version', {}),
    /official Replicate model/
  );
});
