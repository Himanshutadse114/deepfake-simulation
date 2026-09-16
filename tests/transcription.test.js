const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compareTranscripts,
  normalizeTranscript,
  outputText
} = require('../server/services/transcription');

test('normalizes punctuation and case before comparing speech', () => {
  const expected = 'This is the administrator-approved script.';
  const actual = 'this is the administrator approved script';
  assert.equal(normalizeTranscript(expected), normalizeTranscript(actual));
  assert.equal(compareTranscripts(expected, actual).matches, true);
});

test('rejects extra generated speech', () => {
  const result = compareTranscripts(
    'This is the complete approved message for the simulation.',
    'This is the complete approved message for the simulation and unrelated extra words.'
  );
  assert.equal(result.matches, false);
  assert.ok(result.actualWordCount > result.expectedWordCount);
});

test('reads the transcription returned by Whisper', () => {
  assert.equal(outputText({ transcription: ' approved speech ' }), 'approved speech');
  assert.equal(outputText({ text: ' fallback text ' }), 'fallback text');
});
