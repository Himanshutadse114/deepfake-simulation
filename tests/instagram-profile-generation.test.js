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
const profileFix = read('client/public/generated-profile-grid-fix.js');
const index = read('client/index.html');
const serverIndex = read('server/index.js');

test('FLUX profile generation is exactly three independent 1 MP requests', () => {
  assert.match(flux, /const PROFILE_VARIANT_COUNT = 3/);
  assert.match(flux, /const FLUX_PROFILE_RESOLUTION = '1 MP'/);
  assert.match(flux, /resolution:\s*FLUX_PROFILE_RESOLUTION/);
  assert.doesNotMatch(flux, /resolution:\s*'2 MP'/);
  assert.doesNotMatch(flux, /2x2 contact sheet|splitGrid|GRID_PROMPT/);
  assert.equal(config.providers.fluxProfileImages, 3);
  assert.equal(config.providers.fluxProfileResolution, '1 MP');
});

test('the three generated Instagram portraits are deliberately distinct', () => {
  assert.match(flux, /POST 1 MUST BE VISUALLY DISTINCT/i);
  assert.match(flux, /head-and-shoulders or upper-chest portrait/i);
  assert.match(flux, /modern office or coworking environment/i);
  assert.match(flux, /POST 2 MUST LOOK LIKE A DIFFERENT REAL-LIFE MOMENT/i);
  assert.match(flux, /half-body photograph/i);
  assert.match(flux, /everyday cafe or casual indoor lounge/i);
  assert.match(flux, /POST 3 MUST BE OBVIOUSLY DIFFERENT/i);
  assert.match(flux, /near-full-body or full-body lifestyle photograph/i);
  assert.match(flux, /outdoor park path, pedestrian area or generic building entrance/i);
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

test('Instagram grid shows three AI portraits plus one non-AI CC0 scenery post', () => {
  assert.match(instagramUi, /variantUrls\.slice\(0, 3\)/);
  assert.match(instagramUi, /count\.textContent = '4'/);
  assert.match(instagramUi, /ig-scenery-post/);
  assert.match(instagramUi, /upload\.wikimedia\.org/);
  assert.match(instagramUi, /CC0 1\.0 public-domain dedication/);
  assert.doesNotMatch(instagramUi, /AI VIDEO|openIgVideoPost|generatedVideoUrl/);
  assert.match(serverIndex, /https:\/\/upload\.wikimedia\.org/);
  assert.match(serverIndex, /instagramPostCount:\s*4/);
  assert.match(serverIndex, /instagramGeneratedPostCount:\s*3/);
});

test('completed sessions bind exact generated variant routes instead of repeating the upload', () => {
  assert.match(profileFix, /variantCount/);
  assert.match(profileFix, /\/variant\/\$\{index\}/);
  assert.match(profileFix, /__generatedProfileUrls/);
  assert.match(profileFix, /never silently repeat the uploaded source portrait/i);
  assert.match(profileFix, /Loading the generated profile posts/);
  assert.match(index, /generated-profile-grid-fix\.js\?v=generated-variants-20260823-1/);
  assert.doesNotThrow(() => new Function(profileFix));
  assert.doesNotThrow(() => new Function(instagramUi));
});
