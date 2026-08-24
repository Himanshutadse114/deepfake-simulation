const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const fixes = read('client/public/desktop-experience-fixes.js');
const whatsapp = read('client/public/whatsapp-copy-fix.js');
const bootstrap = read('client/public/ui-bootstrap.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('voice recording keeps the 3-2-1 countdown and automatic save flow', () => {
  assert.match(fixes, /const AUTO_RECORD_SECONDS = 22/);
  assert.match(fixes, /voiceCountdownOverlay/);
  assert.match(fixes, /let count = 3/);
  assert.match(fixes, /count -= 1/);
  assert.match(fixes, /Recording starts automatically/);
  assert.match(fixes, /autoStopTimer = setTimeout\(\(\) => finishRecording\(false\), AUTO_RECORD_SECONDS \* 1000\)/);
  assert.match(fixes, /Your recording will save automatically/);
  assert.doesNotMatch(fixes, />Use recording</);
});

test('teleprompter keeps the desktop and short-laptop anti-overlap layout', () => {
  assert.match(fixes, /voice-teleprompter-shell\{[\s\S]*grid-template-rows:auto minmax\(0,1fr\) auto!important/);
  assert.match(fixes, /voice-teleprompter-stage\{[\s\S]*overflow-y:auto!important/);
  assert.match(fixes, /@media\(min-width:701px\) and \(max-height:780px\)/);
});

test('WhatsApp keeps the wordmark and incoming-message notification sound', () => {
  assert.match(fixes, /wa-desktop-wordmark">WhatsApp/);
  assert.match(fixes, /function playWhatsAppNotification/);
  assert.match(fixes, /direction === 'in'/);
  assert.match(fixes, /window\.appendWaBubble = wrappedAppend/);
  assert.match(fixes, /window\.appendQrBubble = wrappedQr/);
  assert.match(whatsapp, /if \(current\.__innviktaNotificationSound\) wrapped\.__innviktaNotificationSound = true/);
});

test('generation screen keeps the pictorial deepfake facts that fill the empty space', () => {
  assert.match(fixes, /id="generationFacts"/);
  assert.match(fixes, /Familiar can still be fake/);
  assert.match(fixes, /Change the channel/);
  assert.match(fixes, /Protect security secrets/);
  assert.match(fixes, /<svg viewBox="0 0 48 48">/);
  assert.doesNotMatch(fixes, /Replicate|Pruna|FLUX|Qwen/);
});

test('the rejected LinkedIn Facebook and newspaper polish is no longer applied', () => {
  assert.doesNotMatch(fixes, /decorateProfileBanners/);
  assert.doesNotMatch(fixes, /installOpenToWorkBadge/);
  assert.doesNotMatch(fixes, /innvikta-reference-open-badge/);
  assert.doesNotMatch(fixes, /The Simulation Daily: desktop\/laptop content remains readable/);
  assert.doesNotMatch(fixes, /paper-story\{overflow-y:auto!important/);
});

test('retained polish loads after the existing carousel and WhatsApp runtime', () => {
  const baseCarousel = bootstrap.indexOf('/profile-carousel-experience.js?v=cloned-profiles-20260824-2');
  const referenceCarousel = bootstrap.indexOf('/profile-carousel-reference-ui.js?v=reference-ui-20260824-2');
  const desktopFixes = bootstrap.indexOf('/desktop-experience-fixes.js?v=desktop-polish-20260824-1');
  assert.ok(baseCarousel >= 0);
  assert.ok(referenceCarousel > baseCarousel);
  assert.ok(desktopFixes > referenceCarousel);
  assert.match(bootstrap, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.match(index, /ui-bootstrap\.js\?v=desktop-polish-20260824-6/);
  assert.match(demo, /ui-bootstrap\.js\?v=desktop-polish-20260824-6/);
  assert.doesNotThrow(() => new Function(fixes));
});
