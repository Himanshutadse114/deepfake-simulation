const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVoiceCloneInput } = require('../server/services/qwen');

test('sends the administrator script and server transcript to Qwen unchanged', () => {
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

test('refuses voice cloning without the server-verified reference transcript', () => {
  assert.throws(() => buildVoiceCloneInput({
    referenceAudio: 'data:audio/wav;base64,AA==',
    referenceText: '',
    text: 'Administrator script',
    language: 'auto'
  }), /server-verified reference transcript/);
});
