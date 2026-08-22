const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flux = read('server/services/flux.js');
const pipeline = read('server/pipeline.js');
const config = require('../server/config');
const instagramUi = read('client/public/instagram-video-grid.js');
const bootstrap = read('client/public/ui-bootstrap.js');

test('FLUX profile generation is exactly three independent 1 MP requests', () => {
  assert.match(flux, /const PROFILE_VARIANT_COUNT = 3/);
  assert.match(flux, /const FLUX_PROFILE_RESOLUTION = '1 MP'/);
  assert.match(flux, /resolution:\s*FLUX_PROFILE_RESOLUTION/);
  assert.doesNotMatch(flux, /resolution:\s*'2 MP'/);
  assert.doesNotMatch(flux, /2x2 contact sheet|splitGrid|GRID_PROMPT/);
  assert.equal(config.providers.fluxProfileImages, 3);
  assert.equal(config.providers.fluxProfileResolution, '1 MP');
});

test('FLUX reference image is bounded to the 1 MP billing tier', () => {
  assert.match(flux, /scale=min\(1024\\\\,iw\):min\(1024\\\\,ih\):force_original_aspect_ratio=decrease/);
});

test('each of the three paid FLUX creations gets its own durable checkpoint', () => {
  assert.match(pipeline, /function fluxPredictionCallbacks\(session, index\)/);
  assert.match(pipeline, /itemCallbacks:\s*\(index\) => fluxPredictionCallbacks\(session, index\)/);
  assert.match(pipeline, /item\.status = 'creation_started'/);
  assert.match(pipeline, /item\.predictionId = prediction\.id/);
  assert.match(pipeline, /stage\.predictionId = prediction\.id/);
  assert.match(pipeline, /session\.stages\.flux\.items\.forEach/);
});

test('Instagram grid uses three FLUX photos plus the already-generated video', () => {
  assert.match(instagramUi, /variantUrls\.slice\(0, 3\)/);
  assert.match(instagramUi, /generatedVideoUrl/);
  assert.match(instagramUi, /ig-video-post/);
  assert.match(instagramUi, /AI VIDEO/);
  assert.match(instagramUi, /openIgVideoPost/);
  assert.match(bootstrap, /instagram-video-grid\.js/);
  assert.doesNotThrow(() => new Function(instagramUi));
});
