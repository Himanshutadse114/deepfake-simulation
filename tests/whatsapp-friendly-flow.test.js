const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flow = read('client/public/whatsapp-friendly-flow.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('WhatsApp story uses believable emotional pressure instead of a server-timeout pretext', () => {
  assert.match(flow, /Please don\'t ignore this/);
  assert.match(flow, /starting to panic/);
  assert.match(flow, /they\'ll cancel it and I could lose the money/);
  assert.match(flow, /I\'ll still be charged/);
  assert.match(flow, /Can you scan it now and just tell me what comes up/);
  assert.match(flow, /Shared QR code/);
  assert.doesNotMatch(flow, /server timeout/i);
  assert.doesNotMatch(flow, /processing payment of \$5 urgently/i);
});

test('pressure builds from personal concern to time-limited loss without asking for credentials', () => {
  assert.match(flow, /I really need you for a minute/);
  assert.match(flow, /next few minutes/);
  assert.match(flow, /Please stay with me for one more minute/);
  assert.doesNotMatch(flow, /password|OTP|PIN|verification code/i);
});

test('pressured WhatsApp flow is cache-busted in normal and demo entry points', () => {
  assert.match(index, /whatsapp-friendly-flow\.js\?v=pressure-20260823-2/);
  assert.match(demo, /whatsapp-friendly-flow\.js\?v=pressure-20260823-2/);
  assert.doesNotThrow(() => new Function(flow));
});
