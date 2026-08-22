const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const guide = read('client/public/camera-face-guide.js');
const bootstrap = read('client/public/ui-bootstrap.js');
const clientPackage = JSON.parse(read('client/package.json'));
const prepare = read('client/scripts/prepare-face-detector-assets.mjs');
const server = read('server/index.js');

test('camera opens as a full-screen guided portrait capture', () => {
  assert.match(guide, /camera-guide-fullscreen/);
  assert.match(guide, /Position your face/);
  assert.match(guide, /camera-guide-oval/);
  assert.match(guide, /Face aligned — ready to capture/);
});

test('camera alignment checks one face, distance, centering and lighting', () => {
  assert.match(guide, /Only one face should be visible/);
  assert.match(guide, /Move a little closer/);
  assert.match(guide, /Move slightly back/);
  assert.match(guide, /Move your face toward the centre/);
  assert.match(guide, /better lighting/);
  assert.match(guide, /detectForVideo/);
});

test('face detection runtime and model are self-hosted at build time', () => {
  assert.equal(clientPackage.dependencies['@mediapipe/tasks-vision'], '1.0.1');
  assert.match(clientPackage.scripts.prebuild, /prepare-face-detector-assets/);
  assert.match(prepare, /vision_bundle\.mjs/);
  assert.match(prepare, /blaze_face_short_range\.tflite/);
  assert.match(guide, /\/vendor\/mediapipe\/vision_bundle\.mjs/);
  assert.match(guide, /Face alignment is processed on this device/);
});

test('camera guide is loaded by the learner UI and CSP permits only local wasm execution', () => {
  assert.match(bootstrap, /camera-face-guide\.js/);
  assert.match(server, /'wasm-unsafe-eval'/);
  assert.match(server, /workerSrc:\s*\["'self'", 'blob:'\]/);
  assert.doesNotMatch(guide, /https:\/\//);
});
