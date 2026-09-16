const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVoiceCloneInput } = require('../server/services/qwen');

test('sends the administrator script and optional recording transcript to Qwen unchanged', () => {
  const script = 'Admin punctuation stays exact: pause, then finish!';
  const input = buildVoiceCloneInput({
    referenceAudio: 'data:audio/wav;base64,AA==',
    referenceText: 'This is the verified reference recording.',
    text: script,
    language: 'auto'
  });
  assert.equal(input.text, script);
  assert.equal(input.reference_text, 'This is the verified reference recording.');
  assert.match(input.style_instruction, /verbatim/i);
});

test('accepts the uploaded voice sample without a reference transcript', () => {
  const input = buildVoiceCloneInput({
    referenceAudio: 'data:audio/wav;base64,AA==',
    referenceText: '',
    text: 'Administrator script',
    language: 'auto'
  });
  assert.equal(input.text, 'Administrator script');
  assert.equal(input.reference_audio, 'data:audio/wav;base64,AA==');
  assert.equal('reference_text' in input, false);
});
