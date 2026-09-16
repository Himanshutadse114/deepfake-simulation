const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVoiceCloneInput } = require('../server/services/qwen');

test('sends the administrator script to Qwen without replacing or rewriting it', () => {
  const script = 'Admin punctuation stays exact: pause, then finish!';
  const input = buildVoiceCloneInput({
    referenceAudio: Buffer.from('audio'),
    referenceText: 'This is the exact reference recording.',
    text: script,
    language: 'English'
  });

  assert.equal(input.mode, 'voice_clone');
  assert.equal(input.text, script);
  assert.equal(input.reference_text, 'This is the exact reference recording.');
  assert.equal(input.language, 'English');
  assert.match(input.style_instruction, /verbatim/i);
});

test('accepts the uploaded voice sample without a reference transcript', () => {
  const input = buildVoiceCloneInput({
    referenceAudio: Buffer.from('audio'),
    referenceText: '',
    text: 'Administrator script',
    language: 'English'
  });

  assert.equal(input.mode, 'voice_clone');
  assert.equal(input.text, 'Administrator script');
  assert.equal(input.reference_audio.toString(), 'audio');
  assert.equal('reference_text' in input, false);
  assert.match(input.style_instruction, /Do not stop early/i);
});
