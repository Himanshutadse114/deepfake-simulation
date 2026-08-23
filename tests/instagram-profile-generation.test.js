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

test('the three Instagram prompts deliberately use close, half-body and near-full-body framing', () => {
  assert.match(flux, /head-and-shoulders or upper-chest portrait/i);
  assert.match(flux, /half-body photograph/i);
  assert.match(flux, /near-full-body or full-body lifestyle photograph/i);
  assert.match(flux, /Identity consistency is the highest priority/i);
});

test('FLUX reference image is bounded to the 1 MP billing tier', () => {
  assert.match(flux, /scale=min\(1024\\\\,iw\):min\(1024\\\\,ih\):force_original_aspect_ratio=decrease/);
});

test('each of the three paid FLUX creations gets its own durable checkpoint', () => {
  assert.match(pipeline, /function fluxPredictionCallbacks\(session, index\)/);
  assert.match(pipeline, /itemCallbacks:\s*\(index\) => fluxPredictionCallbacks\(session, index\)/);
  assert.match(pipeline, /item\.status = 'creation_started'/);
  assert.match(pipeline, /item\.predictionId = prediction\.id/);
  assert.match(pipeline, /session\.stages\.flux\.items\.forEach/);
});

test('Instagram grid shows only three generated photo posts and no video post', () => {
  assert.match(instagramUi, /variantUrls\)\s*\?\s*window\.variantUrls\.slice\(0, 3\)/);
  assert.match(instagramUi, /count\.textContent = '3'/);
  assert.doesNotMatch(instagramUi, /AI VIDEO|openIgVideoPost|ig-video-post|generatedVideoUrl/);
  assert.match(bootstrap, /instagram-video-grid\.js\?v=1mp-3photos/);
  assert.doesNotThrow(() => new Function(instagramUi));
});
