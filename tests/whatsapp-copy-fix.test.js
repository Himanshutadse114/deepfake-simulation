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
  assert.doesNotMatch(flow, /processing payment of \$5 urgently/i);
});

test('WhatsApp patch loads after every asynchronous WhatsApp polish script', () => {
  const waFlow = bootstrap.indexOf("/wa-flow-fix.js?v=3");
  const finalCopy = bootstrap.indexOf("/whatsapp-copy-fix.js?v=qr500-final-20260824-1");
  assert.ok(waFlow >= 0 && finalCopy > waFlow);
  assert.match(flow, /__innviktaQr500Copy/);
  assert.match(flow, /setInterval/);
  assert.doesNotMatch(index, /whatsapp-copy-fix\.js/);
  assert.doesNotMatch(demo, /whatsapp-copy-fix\.js/);
  assert.doesNotThrow(() => new Function(flow));
});
