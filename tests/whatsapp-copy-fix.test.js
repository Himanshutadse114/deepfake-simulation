const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flow = read('client/public/whatsapp-copy-fix.js');
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

test('revised WhatsApp copy loads in learner and demo entry points', () => {
  assert.match(index, /whatsapp-copy-fix\.js\?v=qr500-20260823-1/);
  assert.match(demo, /whatsapp-copy-fix\.js\?v=qr500-20260823-1/);
  assert.doesNotThrow(() => new Function(flow));
});
