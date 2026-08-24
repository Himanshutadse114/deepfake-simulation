const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const flux = read('server/services/flux.js');
const pipeline = read('server/pipeline.js');
const config = require('../server/config');
const profileFix = read('client/public/generated-profile-grid-fix.js');
const bootstrap = read('client/public/ui-bootstrap.js');
const serverIndex = read('server/index.js');

test('FLUX profile generation is exactly four independent 1 MP requests', () => {
  assert.match(flux, /const PROFILE_VARIANT_COUNT = 4/);
  assert.match(flux, /const FLUX_PROFILE_RESOLUTION = '1 MP'/);
  assert.match(flux, /resolution:\s*FLUX_PROFILE_RESOLUTION/);
  assert.doesNotMatch(flux, /resolution:\s*'2 MP'/);
  assert.doesNotMatch(flux, /2x2 contact sheet|splitGrid|GRID_PROMPT/);
  assert.equal(config.providers.fluxProfileImages, 4);
  assert.equal(config.providers.fluxProfileResolution, '1 MP');
});

test('the four social-photo environments remain office, cafe, city and park', () => {
  assert.match(flux, /modern office or coworking space, three-quarter left camera angle/i);
  assert.match(flux, /bright cafe setting, three-quarter right camera angle/i);
  assert.match(flux, /generic city promenade or public plaza/i);
  assert.match(flux, /green park or neutral outdoor setting/i);
  assert.match(flux, /realistic smartphone photography/i);
});

test('each Instagram image requests distinct clothing matched to its environment', () => {
  assert.match(flux, /smart-casual office-appropriate outfit/i);
  assert.match(flux, /relaxed everyday cafe outfit/i);
  assert.match(flux, /urban outdoor outfit suitable for going out in the city/i);
  assert.match(flux, /relaxed weekend or park top or light outdoor layer/i);
  assert.match(flux, /clearly different from the clothing in the other three generated posts/i);
  assert.match(flux, /different garment style and a different overall colour palette/i);
  assert.match(flux, /different silhouette, outer layer and overall colour feel/i);
  assert.match(flux, /clearly different from the office, cafe and city outfits/i);
});

test('fourth Instagram photo is a close shoulder selfie, never a full-body image', () => {
  assert.match(flux, /realistic square smartphone selfie/i);
  assert.match(flux, /close head-and-shoulders composition only/i);
  assert.match(flux, /face, neck and shoulders/i);
  assert.match(flux, /Do NOT create a full-body, half-body, waist-up or wide portrait/i);
  assert.match(flux, /Do not show the person below the upper chest/i);
});

test('FLUX reference image is bounded to the 1 MP billing tier', () => {
  assert.match(flux, /scale=min\(1024\\\\,iw\):min\(1024\\\\,ih\):force_original_aspect_ratio=decrease/);
});

test('each paid FLUX creation gets its own durable checkpoint', () => {
  assert.match(pipeline, /function fluxPredictionCallbacks\(session, index\)/);
  assert.match(pipeline, /itemCallbacks:\s*\(index\) => fluxPredictionCallbacks\(session, index\)/);
  assert.match(pipeline, /item\.status = 'creation_started'/);
  assert.match(pipeline, /item\.predictionId = prediction\.id/);
  assert.match(pipeline, /session\.stages\.flux\.items\.forEach/);
});

test('Instagram binds four generated images with no scenery fallback', () => {
  assert.match(profileFix, /const EXPECTED_COUNT = 4/);
  assert.match(profileFix, /variantCount/);
  assert.match(profileFix, /\/variant\/\$\{index\}/);
  assert.match(profileFix, /__generatedProfileUrls/);
  assert.match(profileFix, /never substitutes the uploaded source portrait/i);
  assert.match(profileFix, /Preparing content/);
  assert.doesNotMatch(profileFix, /wikimedia|scenery/i);
  assert.match(bootstrap, /generated-profile-grid-fix\.js\?v=four-generated-posts-20260824-1/);
  assert.doesNotMatch(bootstrap, /instagram-video-grid\.js/);
  assert.match(serverIndex, /instagramPostCount:\s*4/);
  assert.match(serverIndex, /instagramGeneratedPostCount:\s*4/);
  assert.doesNotMatch(serverIndex, /upload\.wikimedia\.org/);
  assert.doesNotThrow(() => new Function(profileFix));
});
