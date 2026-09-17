const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'client', 'public');
const integration = fs.readFileSync(path.join(publicRoot, 'ui-js-2.txt'), 'utf8');
const generation = fs.readFileSync(path.join(publicRoot, 'ui-js-3.txt'), 'utf8');
const polish = fs.readFileSync(path.join(publicRoot, 'final-flow-polish.js'), 'utf8');

test('marks browser fetch failures as recoverable network interruptions', () => {
  assert.match(integration, /networkError\.isNetworkError\s*=\s*true/);
  assert.match(integration, /Connection to the simulation server was interrupted/);
  assert.match(integration, /\[408, 425, 429, 502, 503, 504\]/);
});

test('generation polling reconnects without abandoning the active session', () => {
  assert.match(generation, /if \(!error\.isNetworkError\) throw error/);
  assert.match(generation, /status:\s*'reconnecting'/);
  assert.match(generation, /Your outputs are still processing; reconnecting automatically/);
  assert.match(generation, /15 \* 60 \* 1000/);
});

test('an ambiguous generate response is reconciled without deleting paid work', () => {
  assert.match(integration, /responseError\.status = response\.status/);
  assert.match(generation, /async function recoverAmbiguousGenerationAdmission/);
  assert.match(generation, /No duplicate AI work will be started/);
  assert.match(generation, /admissionRequestStarted && liveSession && error\?\.isNetworkError/);
  assert.match(generation, /payload\.status === 'collecting'/);
});

test('the loading screen presents a neutral reconnection message', () => {
  assert.match(polish, /case 'reconnecting'/);
  assert.doesNotMatch(polish, /Failed to fetch/);
});
