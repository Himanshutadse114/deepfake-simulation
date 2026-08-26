const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const carousel = read('client/public/profile-carousel-experience.js');
const bootstrap = read('client/public/ui-bootstrap.js');
const index = read('client/index.html');
const demo = read('server/demo.js');

test('Instagram now leads to a four-card cloned social profile stage', () => {
  assert.match(carousel, /data-screen="profileCarouselExperience"/);
  assert.match(carousel, /const TOTAL_CARDS = 4/);
  assert.match(carousel, /pc-linkedin/);
  assert.match(carousel, /pc-facebook/);
  assert.match(carousel, /pc-dating/);
  assert.match(carousel, /pc-threads/);
  assert.match(carousel, /View other cloned profiles/);
  assert.match(carousel, /Next profiles/);
});

test('carousel reuses and randomises the four Instagram-generated images', () => {
  assert.match(carousel, /window\.__generatedProfileUrls/);
  assert.match(carousel, /window\.variantUrls/);
  assert.match(carousel, /querySelectorAll\('#igGrid img'\)/);
  assert.match(carousel, /function shuffle\(items\)/);
  assert.match(carousel, /function assignRandomGeneratedPhotos\(\)/);
  assert.match(carousel, /const ordered = shuffle\(source\.slice\(0, 4\)\)/);
  assert.match(carousel, /window\.__profileCarouselImageOrder = ordered\.slice\(\)/);
  assert.match(carousel, /Paid simulations must use the four images already created for Instagram/);
});

test('analysis action remains visible without scrolling on laptop', () => {
  assert.match(carousel, /profile-carousel-shell\{height:100%!important;display:grid!important;grid-template-rows:minmax\(0,1fr\) auto!important/);
  assert.match(carousel, /profile-carousel-viewport\{min-height:0!important;overflow:hidden!important/);
  assert.match(carousel, /class="profile-carousel-footer"/);
  assert.match(carousel, /id="profileCarouselAnalyze" type="button" disabled/);
  assert.doesNotMatch(carousel, /carouselProceedDock[^\n]*display:\s*none/i);
  assert.match(carousel, /@media\(max-height:760px\) and \(min-width:701px\)/);
});

test('learner must see all four clone cards before analysis starts', () => {
  assert.match(carousel, /let viewedCards = new Set\(\[0\]\)/);
  assert.match(carousel, /viewedCards\.add\(currentIndex\)/);
  assert.match(carousel, /viewedCards\.size >= TOTAL_CARDS/);
  assert.match(carousel, /viewedCards\.size < TOTAL_CARDS/);
  assert.match(carousel, /button\.textContent = 'Proceed to analysis →'/);
  assert.match(carousel, /window\.go\?\.\('unifiedLearn'\)/);
});

test('carousel inherits the learner-entered identity', () => {
  assert.match(carousel, /firstNameInput/);
  assert.match(carousel, /lastNameInput/);
  assert.match(carousel, /__innviktaSyncParticipantIdentity/);
  assert.match(carousel, /profile-carousel-full-name/);
  assert.match(carousel, /profile-carousel-handle/);
});

test('bootstrap loads carousel after participant-name guard and entry pages load the current bootstrap', () => {
  const nameIndex = bootstrap.indexOf('/participant-name-fix.js?v=participant-name-20260824-1');
  const carouselIndex = bootstrap.indexOf('/profile-carousel-experience.js?v=cloned-profiles-20260824-2');
  assert.ok(nameIndex >= 0);
  assert.ok(carouselIndex > nameIndex);
  assert.match(index, /ui-bootstrap\.js\?v=retained-polish-20260824-7/);
  assert.match(demo, /ui-bootstrap\.js\?v=retained-polish-20260824-7/);
  assert.doesNotThrow(() => new Function(carousel));
});
