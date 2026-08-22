const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createSession,
  getSession,
  saveSession,
  updateStatus,
  deleteSession
} = require('../server/store');
const { predictionCallbacks } = require('../server/pipeline');

test('stale cleanup cannot delete an active single-service session', async () => {
  const session = await createSession(
    { faceOwnership: true, voiceOwnership: true, processing: true },
    { mode: 'ai', scripts: { whatsapp: 'Awareness script for WhatsApp verification.', video: 'Awareness script for independent verification.' } }
  );

  updateStatus(session, 'queued', 'waiting');
  await saveSession(session);
  assert.equal(session.expiresAt, null);

  const deleted = await deleteSession(session.id, { cancelPredictions: false });
  assert.equal(deleted, false);
  assert.ok(await getSession(session.id));

  session.expiresAt = Date.now() - 1;
  await saveSession(session);
  assert.equal(await deleteSession(session.id, { cancelPredictions: false }), true);
  assert.equal(await getSession(session.id), undefined);
});

test('paid prediction creation boundary is checkpointed before a prediction id exists', async () => {
  const session = {
    id: `unit-${Date.now()}`,
    provider: {},
    variants: [],
    expiresAt: null,
    stages: {
      whatsappAudio: { status: 'pending', predictionId: null },
      videoAudio: { status: 'pending', predictionId: null },
      pruna: { status: 'pending', predictionId: null, providerUrl: null },
      flux: { status: 'pending', predictionId: null, providerUrl: null }
    }
  };

  const callbacks = predictionCallbacks(session, 'whatsappAudio');
  await callbacks.onBeforePredictionCreate();
  assert.equal(session.stages.whatsappAudio.status, 'creation_started');
  assert.equal(session.stages.whatsappAudio.predictionId, null);

  await callbacks.onPredictionCreated({ id: 'pred-unit-1' });
  assert.equal(session.stages.whatsappAudio.status, 'provider_running');
  assert.equal(session.stages.whatsappAudio.predictionId, 'pred-unit-1');

  session.expiresAt = Date.now() - 1;
  await saveSession(session);
  await deleteSession(session.id, { cancelPredictions: false });
});
