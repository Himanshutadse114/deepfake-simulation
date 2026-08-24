const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const nameFix = read('client/public/participant-name-fix.js');
const bootstrap = read('client/public/ui-bootstrap.js');

test('participant names use dedicated non-login autofill semantics', () => {
  assert.match(nameFix, /participant_given_name/);
  assert.match(nameFix, /participant_family_name/);
  assert.match(nameFix, /given-name/);
  assert.match(nameFix, /family-name/);
  assert.match(nameFix, /data-lpignore/);
  assert.match(nameFix, /data-1p-ignore/);
});

test('saved Innvikta credentials cannot become the simulated participant identity', () => {
  assert.match(nameFix, /firstValue === 'innvikta'/);
  assert.match(nameFix, /passwordLikeSurname/);
  assert.match(nameFix, /clearCredentialAutofill/);
  assert.match(nameFix, /first\.value = ''/);
  assert.match(nameFix, /last\.value = ''/);
});

test('user-entered first and last names are captured and re-applied before WhatsApp starts', () => {
  assert.match(nameFix, /participant = \{ first: firstValue, last: lastValue \}/);
  assert.match(nameFix, /setIdentity\?\.\(participant\.first, participant\.last\)/);
  assert.match(nameFix, /startWhatsAppSimulation/);
  assert.match(nameFix, /__innviktaSyncParticipantIdentity/);
});

test('generation is blocked until real participant names replace credential autofill', () => {
  assert.match(nameFix, /startGeneration/);
  assert.match(nameFix, /requireValid: true/);
  assert.match(nameFix, /Enter your first name and surname to continue/);
  assert.match(nameFix, /window\.go\?\.\('media'\)/);
});

test('participant name guard loads after bootstrap generation wrappers', () => {
  const wrapper = bootstrap.indexOf("if(typeof window.startGeneration==='function')");
  const participant = bootstrap.indexOf("participant-name-fix.js?v=participant-name-20260824-1");
  assert.ok(wrapper >= 0 && participant > wrapper);
  assert.doesNotThrow(() => new Function(nameFix));
});
