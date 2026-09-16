const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flow = read('client/public/whatsapp-copy-fix.js');
const replay = read('client/public/wa-replay-reset.js');
const bootstrap = read('client/public/ui-bootstrap.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('WhatsApp flow removes the payment approval-code request', () => {
  assert.doesNotMatch(flow, /Please send the payment approval code now\. It is urgent\./i);
  assert.match(flow, /That sounds exactly like you\./);
  assert.match(flow, /triggerIncomingVideoCall/);
});

test('QR follow-up removes server-timeout wording and uses $500', () => {
  assert.doesNotMatch(flow, /We are facing a server timeout/i);
  assert.match(flow, /Please scan this QR code to complete the processing payment of \$500 urgently\./);
  assert.match(flow, /Done, I've sent the \$500 payment\./);
  assert.doesNotMatch(flow, /processing payment of \$5 urgently/i);
});

test('Replay and Convinced controls are appended only as the final chat content', () => {
  assert.match(flow, /wa-inline-completion-final/);
  assert.match(flow, /if \(body\.lastElementChild !== block\) body\.appendChild\(block\)/);
  assert.match(flow, /position:static!important/);
  assert.doesNotMatch(flow, /position:sticky!important/);
  assert.match(flow, /replayWhatsAppSimulation/);
  assert.match(flow, /openProfileExperience/);
  assert.match(flow, /scrollChatToBottom\(\)/);
});

test('QR rendering guarantees completion and prevents stale timers leaking into replay', () => {
  assert.match(flow, /const FLOW_VERSION = 3/);
  assert.match(flow, /let flowEpoch = 0/);
  assert.match(flow, /function resetFlowState/);
  assert.match(flow, /flowEpoch \+= 1/);
  assert.match(flow, /clearCompletionTimers\(\)/);
  assert.match(flow, /function scheduleCompletionAfterQr/);
  assert.match(flow, /completionBackupTimer/);
  assert.match(flow, /epoch !== flowEpoch/);
  assert.match(flow, /__innviktaResetWhatsappCompletion/);
});

test('Replay clears the conversation and restarts the complete WhatsApp story', () => {
  assert.match(replay, /chat\.replaceChildren\(\)/);
  assert.match(replay, /__innviktaResetWhatsappCompletion/);
  assert.match(replay, /storyAdvancedForCurrentRun = false/);
  assert.match(replay, /window\.startWhatsAppSimulation\?\.\(\)/);
  assert.match(replay, /requestAnimationFrame/);
  assert.match(replay, /waVictimPayment500/);
  assert.match(replay, /waSimulationComplete/);
  assert.match(replay, /waInlineCompletion/);
  assert.doesNotThrow(() => new Function(replay));
});

test('fresh WhatsApp flow is cache-busted in learner, demo and bootstrap', () => {
  assert.match(index, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.match(demo, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.match(bootstrap, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.match(bootstrap, /wa-replay-reset\.js\?v=replay-clean-20260824-2/);
  assert.match(flow, /READY_TIMEOUT_MS = 120000/);
  assert.match(flow, /setInterval/);
  assert.doesNotThrow(() => new Function(flow));
});
