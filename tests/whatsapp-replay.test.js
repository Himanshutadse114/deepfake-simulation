const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const replayScript = fs.readFileSync(path.join(__dirname, '..', 'client', 'public', 'wa-replay-reset.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(__dirname, '..', 'client', 'public', 'ui-bootstrap.js'), 'utf8');

test('voice replay advances the WhatsApp story only once per run', () => {
  assert.match(replayScript, /storyAdvancedForCurrentRun/);
  assert.match(replayScript, /btnId === 'waVoiceBtn' && !storyAdvancedForCurrentRun/);
  assert.match(replayScript, /storyAdvancedForCurrentRun = true/);
  assert.match(replayScript, /window\.onVoiceNoteCompleted\?\.\(\)/);
});

test('WhatsApp replay is UI-only and never starts paid AI generation', () => {
  const replayFunction = replayScript.match(/window\.replayWhatsAppSimulation[\s\S]*?\n  };/)?.[0] || '';
  assert.match(replayFunction, /startWhatsAppSimulation/);
  assert.doesNotMatch(replayFunction, /startGeneration|\/generate|apiRequest|Qwen|Pruna|FLUX/);
});

test('replay clears stale completion controls before restarting the conversation', () => {
  assert.match(replayScript, /waSimulationComplete/);
  assert.match(replayScript, /waInlineCompletion/);
  assert.match(replayScript, /resetVisibleWhatsAppState\(\)/);
});

test('the replay guard loads after the WhatsApp completion layout patch', () => {
  const flowIndex = bootstrap.indexOf('/wa-flow-fix.js');
  const replayIndex = bootstrap.indexOf('/wa-replay-reset.js');
  assert.ok(flowIndex >= 0);
  assert.ok(replayIndex > flowIndex);
});
