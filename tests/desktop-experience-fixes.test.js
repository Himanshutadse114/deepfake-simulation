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

test('voice recording uses a visible 3-2-1 countdown and auto-saves without a Use recording button', () => {
  assert.match(fixes, /const AUTO_RECORD_SECONDS = 22/);
  assert.match(fixes, /voiceCountdownOverlay/);
  assert.match(fixes, /let count = 3/);
  assert.match(fixes, /count -= 1/);
  assert.match(fixes, /Recording starts automatically/);
  assert.match(fixes, /autoStopTimer = setTimeout\(\(\) => finishRecording\(false\), AUTO_RECORD_SECONDS \* 1000\)/);
  assert.match(fixes, /Your recording will save automatically/);
  assert.doesNotMatch(fixes, />Use recording</);
});

test('teleprompter has desktop and short-laptop rules that prevent header/script overlap', () => {
  assert.match(fixes, /voice-teleprompter-shell\{grid-template-rows:auto minmax\(0,1fr\) auto!important\}/);
  assert.match(fixes, /voice-teleprompter-stage\{position:relative!important;min-height:0!important;overflow-y:auto!important/);
  assert.match(fixes, /@media\(min-width:701px\) and \(max-height:780px\)/);
});

test('WhatsApp sidebar uses a wordmark and incoming messages have a notification sound', () => {
  assert.match(fixes, /wa-desktop-wordmark">WhatsApp/);
  assert.match(fixes, /function playWhatsAppNotification/);
  assert.match(fixes, /direction === 'in'/);
  assert.match(fixes, /window\.appendWaBubble = wrappedAppend/);
  assert.match(fixes, /window\.appendQrBubble = wrappedQr/);
  assert.match(whatsapp, /if \(current\.__innviktaNotificationSound\) wrapped\.__innviktaNotificationSound = true/);
});

test('generation screen adds pictorial deepfake awareness facts without exposing provider stages', () => {
  assert.match(fixes, /id="generationFacts"/);
  assert.match(fixes, /Familiar can still be fake/);
  assert.match(fixes, /Change the channel/);
  assert.match(fixes, /Protect security secrets/);
  assert.match(fixes, /<svg viewBox="0 0 48 48">/);
  assert.doesNotMatch(fixes, /Replicate|Pruna|FLUX|Qwen/);
});

test('LinkedIn and Facebook covers are decorated and OpenToWork badge follows the supplied reference treatment', () => {
  assert.match(fixes, /decorateProfileBanners/);
  assert.match(fixes, /linkedin\.style\.backgroundImage/);
  assert.match(fixes, /facebook\.style\.backgroundImage/);
  assert.match(fixes, /#OPENTOWORK/);
  assert.match(fixes, /innvikta-reference-open-badge/);
});

test('Simulation Daily has final desktop/laptop anti-clipping rules after responsive polish', () => {
  assert.match(fixes, /The Simulation Daily: desktop\/laptop content remains readable and never clipped/);
  assert.match(fixes, /@media\(min-width:901px\) and \(max-height:950px\)/);
  assert.match(fixes, /paper-story\{overflow-y:auto!important/);
  assert.match(fixes, /@media\(min-width:901px\) and \(max-height:760px\)/);
});

test('bootstrap loads reference carousel and desktop fixes last and entry pages cache-bust current assets', () => {
  const baseCarousel = bootstrap.indexOf('/profile-carousel-experience.js?v=cloned-profiles-20260824-2');
  const referenceCarousel = bootstrap.indexOf('/profile-carousel-reference-ui.js?v=reference-ui-20260824-2');
  const desktopFixes = bootstrap.indexOf('/desktop-experience-fixes.js?v=desktop-polish-20260824-1');
  assert.ok(baseCarousel >= 0);
  assert.ok(referenceCarousel > baseCarousel);
  assert.ok(desktopFixes > referenceCarousel);
  assert.match(bootstrap, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.match(index, /ui-bootstrap\.js\?v=desktop-polish-20260824-6/);
  assert.match(index, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.match(demo, /ui-bootstrap\.js\?v=desktop-polish-20260824-6/);
  assert.match(demo, /whatsapp-copy-fix\.js\?v=whatsapp-final-flow-20260824-4/);
  assert.doesNotMatch(index, /profile-carousel-reference-ui\.js/);
  assert.doesNotMatch(demo, /profile-carousel-reference-ui\.js/);
  assert.doesNotThrow(() => new Function(fixes));
});
