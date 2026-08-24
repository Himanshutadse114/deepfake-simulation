const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const referenceUi = read('client/public/profile-carousel-reference-ui.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('cloned profile carousel uses the reference geometry and card class structure', () => {
  assert.match(referenceUi, /carousel-stage\{perspective:1200px[^}]*max-width:900px[^}]*height:480px/);
  assert.match(referenceUi, /carousel-ring\{width:360px;height:440px/);
  assert.match(referenceUi, /carousel-card\{position:absolute[^}]*border-radius:16px/);
  assert.match(referenceUi, /li-card pc-linkedin/);
  assert.match(referenceUi, /fb-card pc-facebook/);
  assert.match(referenceUi, /da-card pc-dating/);
  assert.match(referenceUi, /th-card pc-threads/);
});

test('reference profile typography sizes are preserved', () => {
  assert.match(referenceUi, /\.li-name\{font-size:21px;font-weight:600/);
  assert.match(referenceUi, /\.li-headline\{font-size:13\.5px/);
  assert.match(referenceUi, /\.fb-name\{font-size:21px;font-weight:800/);
  assert.match(referenceUi, /\.fb-friends\{font-size:12\.5px/);
  assert.match(referenceUi, /\.da-name\{font-size:22px;font-weight:800/);
  assert.match(referenceUi, /\.da-bio\{font-size:12px/);
  assert.match(referenceUi, /\.th-name\{font-size:18px;font-weight:800/);
  assert.match(referenceUi, /\.th-bio\{font-size:12\.5px/);
});

test('reference warp tunnel transition appears before analysis', () => {
  assert.match(referenceUi, /class="warp-tunnel-overlay" id="analysisOverlay"/);
  assert.match(referenceUi, /class="warp-streak"/);
  assert.match(referenceUi, /class="warp-ring"/);
  assert.match(referenceUi, /class="warp-core-light"/);
  assert.match(referenceUi, /@keyframes warpRingZoom/);
  assert.match(referenceUi, /@keyframes streakShoot/);
  assert.match(referenceUi, /setTimeout\(\(\) => \{[\s\S]*overlay\.style\.transition = 'opacity \.5s ease'/);
  assert.match(referenceUi, /\}, 2000\);/);
  assert.match(referenceUi, /window\.go\?\.\('unifiedLearn'\)/);
});

test('analysis action remains outside the scrolling carousel viewport', () => {
  assert.match(referenceUi, /class="carousel-fixed-footer"/);
  assert.match(referenceUi, /id="profileCarouselAnalyze" type="button" disabled/);
  assert.match(referenceUi, /carousel-screen\{height:100%;display:grid;grid-template-rows:minmax\(0,1fr\) auto/);
  assert.match(referenceUi, /carousel-viewport\{min-height:0[^}]*overflow:hidden/);
});

test('reference layer keeps generated Instagram image bindings and is loaded in main and demo pages', () => {
  assert.match(referenceUi, /data-carousel-photo="0"/);
  assert.match(referenceUi, /data-carousel-photo="1"/);
  assert.match(referenceUi, /data-carousel-photo="2"/);
  assert.match(referenceUi, /data-carousel-photo="3"/);
  assert.match(index, /profile-carousel-reference-ui\.js\?v=reference-carousel-20260824-1/);
  assert.match(demo, /profile-carousel-reference-ui\.js\?v=reference-carousel-20260824-1/);
  assert.doesNotThrow(() => new Function(referenceUi));
});
