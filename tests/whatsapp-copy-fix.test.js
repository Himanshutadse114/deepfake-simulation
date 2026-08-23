const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flow = read('client/public/whatsapp-copy-fix.js');
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

test('QR rendering itself guarantees completion and navigation recovery', () => {
  assert.match(flow, /function installQrCompletionHook/);
  assert.match(flow, /finally \{[\s\S]*scheduleCompletionAfterQr\(\)/);
  assert.match(flow, /function scheduleCompletionAfterQr/);
  assert.match(flow, /ensureCompletionActions\(\)/);
  assert.match(flow, /completionBackupTimer/);
  assert.match(flow, /waVictimPayment500/);
  assert.match(flow, /waSimulationComplete/);
  assert.match(flow, /waInlineCompletion/);
  assert.match(flow, /replayWhatsAppSimulation/);
  assert.match(flow, /openProfileExperience/);
});

test('completion controls are forced visible and sticky inside the scrollable chat', () => {
  assert.match(flow, /wa-inline-completion-forced/);
  assert.match(flow, /position:sticky!important/);
  assert.match(flow, /visibility:visible!important/);
  assert.match(flow, /block\.style\.display = 'block'/);
  assert.match(flow, /scrollChatToBottom\(\)/);
});

test('new completion patch replaces older cached WhatsApp overrides', () => {
  assert.match(flow, /const COMPLETION_VERSION = 2/);
  assert.match(flow, /__innviktaCompletionVersion/);
  assert.match(flow, /!== COMPLETION_VERSION/);
  assert.match(index, /whatsapp-copy-fix\.js\?v=qr500-completion-20260824-2/);
  assert.match(demo, /whatsapp-copy-fix\.js\?v=qr500-completion-20260824-2/);
  assert.match(flow, /READY_TIMEOUT_MS = 120000/);
  assert.match(flow, /setInterval/);
  assert.doesNotThrow(() => new Function(flow));
});

test('bootstrap still contains a late WhatsApp patch load while direct entry loading provides the newest guard', () => {
  assert.match(bootstrap, /whatsapp-copy-fix\.js/);
});
