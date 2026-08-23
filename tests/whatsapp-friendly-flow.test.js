const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flow = read('client/public/whatsapp-friendly-flow.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('WhatsApp simulation opens like a natural request for help', () => {
  assert.match(flow, /are you free for a minute/i);
  assert.match(flow, /I could really use your help with something/i);
  assert.match(flow, /Yeah, of course\. What\\'s going on\?/i);
  assert.match(flow, /I knew I could ask you/i);
});

test('post-call QR request is conversational rather than a server-error payment message', () => {
  assert.match(flow, /Thanks for picking up\. I really appreciate it/i);
  assert.match(flow, /this QR came up on my screen/i);
  assert.match(flow, /Could you scan it for me and tell me what you see\? No rush\./i);
  assert.match(flow, /Shared QR code/);
  assert.doesNotMatch(flow, /server timeout|processing payment|payment approval code/i);
});

test('friendly flow loads for learner and internal demo pages', () => {
  assert.match(index, /whatsapp-friendly-flow\.js\?v=friendly-20260823-1/);
  assert.match(demo, /whatsapp-friendly-flow\.js\?v=friendly-20260823-1/);
  assert.doesNotThrow(() => new Function(flow));
});
