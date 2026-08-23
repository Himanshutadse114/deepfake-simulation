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

test('QR flow always creates replay and proceed actions after completion', () => {
  assert.match(flow, /function ensureCompletionActions/);
  assert.match(flow, /waSimulationComplete/);
  assert.match(flow, /waInlineCompletion/);
  assert.match(flow, /replayWhatsAppSimulation\(\)/);
  assert.match(flow, /openProfileExperience\(\)/);
  assert.match(flow, /setTimeout\(\(\) => \{\s*ensureCompletionActions\(\)/);
});

test('fresh WhatsApp completion patch is loaded explicitly in learner and demo entry points', () => {
  assert.match(index, /whatsapp-copy-fix\.js\?v=qr500-completion-20260824-1/);
  assert.match(demo, /whatsapp-copy-fix\.js\?v=qr500-completion-20260824-1/);
  assert.match(flow, /__innviktaQr500Copy/);
  assert.match(flow, /READY_TIMEOUT_MS = 120000/);
  assert.match(flow, /setInterval/);
  assert.doesNotThrow(() => new Function(flow));
});

test('bootstrap may also load the patch, but direct entry loading protects against stale async ordering', () => {
  assert.match(bootstrap, /whatsapp-copy-fix\.js/);
});
