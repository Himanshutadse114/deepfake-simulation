const express = require('express');
const config = require('./config');
const {
  createSession,
  getSession,
  saveSession,
  publicSession,
  updateStatus,
  deleteSession
} = require('./store');
const { upload, persistParticipantFile } = require('./media');
const { getActiveScripts } = require('./admin-settings');
const { sendAsset } = require('./storage');
const { launchIdentityFromRequest } = require('./launch-token');
const { reserveEstimatedCost, reserveLaunchEntitlement } = require('./cost-guard');
const { enqueueGeneration, scheduleSessionCleanup } = require('./queue');

const router = express.Router();
const generationAdmissions = new Set();

function allConsents(consents) {
  return consents?.faceOwnership === true && consents?.voiceOwnership === true && consents?.processing === true;
}

function cleanName(value, fallback) {
  const text = String(value || '').replace(/[^\p{L}\p{M}' .-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return text || fallback;
}

function unsafePaidRetryReason(session) {
  for (const [stageName, stage] of Object.entries(session?.stages || {})) {
    if (!stage) continue;
    if (stage.status === 'provider_failed') return `${stageName} ended in a terminal provider failure.`;
    if (stage.status === 'validation_failed') return `${stageName} produced output that failed the local safety/quality validation.`;
    if (stage.status === 'creation_ambiguous') return `${stageName} may already have been purchased, but its prediction ID could not be confirmed.`;
    if (stage.status === 'creation_started' && !stage.predictionId) {
      return `${stageName} crossed the paid-creation boundary without a persisted prediction ID.`;
    }
  }
  return null;
}

async function loadAuthorisedSession(req, res, next) {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Simulation session was not found or has expired.' });
    const token = req.get('x-simulation-token') || req.query.token;
    if (!token || token !== session.token) return res.status(403).json({ error: 'Invalid simulation session token.' });
    req.simulation = session;
    next();
  } catch (error) {
    next(error);
  }
}

router.post('/session', async (req, res) => {
  try {
    if (!allConsents(req.body?.consents)) return res.status(400).json({ error: 'All three informed-consent confirmations are required.' });
    const requestedMode = String(req.body?.mode || 'ai').toLowerCase();
    if (!['ai', 'demo'].includes(requestedMode)) return res.status(400).json({ error: 'Simulation mode must be ai or demo.' });

    const identity = requestedMode === 'ai' ? launchIdentityFromRequest(req) : null;
    const { scripts } = await getActiveScripts();
    const participant = {
      firstName: cleanName(req.body?.participant?.firstName, 'Participant'),
      lastName: cleanName(req.body?.participant?.lastName, '')
    };
    const mode = config.demoMode ? 'demo' : requestedMode;
    const session = await createSession(req.body.consents, { mode, participant, scripts, identity });
    await scheduleSessionCleanup(session.id, config.retentionMs).catch((error) => {
      console.warn(`[cleanup-schedule:${session.id}] ${error.message}`);
    });
    res.status(201).json(publicSession(session));
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message, code: error.code });
  }
});

router.post('/:id/face', loadAuthorisedSession, upload.single('face'), async (req, res, next) => {
  try {
    if (req.simulation.status !== 'collecting') return res.status(409).json({ error: 'This session is no longer accepting media.' });
    const saved = await persistParticipantFile(req.simulation.id, 'face', req.file);
    req.simulation.face = saved;
    await saveSession(req.simulation);
    res.json({
      ok: true,
      validation: {
        usable: true,
        method: 'bounded-local-validation',
        reason: 'Image passed local file-signature, size and dimension checks before provider use.',
        width: saved.width,
        height: saved.height
      }
    });
  } catch (error) { next(error); }
});

router.post('/:id/voice', loadAuthorisedSession, upload.single('voice'), async (req, res, next) => {
  try {
    if (req.simulation.status !== 'collecting') return res.status(409).json({ error: 'This session is no longer accepting media.' });
    const saved = await persistParticipantFile(req.simulation.id, 'voice', req.file);
    saved.referenceText = String(req.body?.referenceText || '').trim().slice(0, 1200);
    req.simulation.voice = saved;
    await saveSession(req.simulation);
    res.json({ ok: true, size: saved.size, mime: saved.mime, transcriptProvided: Boolean(saved.referenceText) });
  } catch (error) { next(error); }
});

router.post('/:id/generate', loadAuthorisedSession, async (req, res, next) => {
  const session = req.simulation;
  if (generationAdmissions.has(session.id)) {
    return res.status(409).json({ error: 'Generation admission is already in progress for this session.' });
  }
  generationAdmissions.add(session.id);

  try {
    if (session.status !== 'collecting') return res.status(409).json({ error: `Simulation is already ${session.status}.` });
    if (!session.face?.path || !session.voice?.path) return res.status(400).json({ error: 'Upload both a validated face image and a voice sample first.' });

    if (session.mode !== 'demo') {
      await reserveLaunchEntitlement(session.identity, session.id);
      const budget = await reserveEstimatedCost(session.id);
      session.budgetReservationUsd = budget.reserved;
    }

    session.queueAttempt = Math.max(0, Number(session.queueAttempt || 0)) + 1;
    updateStatus(session, 'queued', session.mode === 'demo'
      ? 'Internal demo has been queued.'
      : 'Simulation preparation is safely queued. Paid AI work starts only when a worker slot is available.');
    await saveSession(session);

    try {
      const job = await enqueueGeneration(session);
      session.queueJobId = job.id;
      await saveSession(session);
      res.status(202).json({ status: session.status, mode: session.mode, queueMode: job.mode });
    } catch (error) {
      updateStatus(session, 'collecting', 'Generation queue admission failed. Your media is still available so you can try again.');
      await saveSession(session);
      throw error;
    }
  } catch (error) {
    next(error);
  } finally {
    generationAdmissions.delete(session.id);
  }
});

router.post('/:id/retry', loadAuthorisedSession, async (req, res, next) => {
  const session = req.simulation;
  try {
    if (session.status !== 'failed') {
      return res.status(409).json({ error: `Only a failed session can be retried. Current status: ${session.status}.` });
    }
    if (!session.face?.path || !session.voice?.path) {
      return res.status(409).json({ error: 'The original consented media is no longer available for a safe retry.' });
    }

    const unsafeReason = unsafePaidRetryReason(session);
    if (unsafeReason) {
      return res.status(409).json({
        error: `Safe retry is blocked because the existing attempt cannot be resumed into a valid result without an intentional new attempt. ${unsafeReason}`,
        code: 'NEW_PAID_ATTEMPT_REQUIRED'
      });
    }

    session.queueAttempt = Math.max(0, Number(session.queueAttempt || 0)) + 1;
    updateStatus(session, 'queued', 'Retry queued using the existing paid prediction checkpoints where available.');
    await saveSession(session);
    const job = await enqueueGeneration(session);
    session.queueJobId = job.id;
    await saveSession(session);
    res.status(202).json({ status: session.status, queueMode: job.mode, resumed: true });
  } catch (error) { next(error); }
});

router.get('/:id/status', loadAuthorisedSession, (req, res) => {
  const {
    status,
    detail,
    expiresAt,
    variants = [],
    provider,
    profileStatus,
    profileDetail,
    profileError,
    whatsappAudioOutput,
    videoAudioOutput,
    output,
    mode,
    queueAttempt
  } = req.simulation;
  res.json({
    status,
    detail,
    expiresAt,
    mode,
    queueAttempt,
    provider,
    profileStatus,
    profileDetail,
    profileError,
    whatsappAudioReady: status === 'completed' && Boolean(whatsappAudioOutput),
    videoAudioReady: status === 'completed' && Boolean(videoAudioOutput),
    videoReady: status === 'completed' && Boolean(output),
    variantCount: variants.length
  });
});

async function sendAudio(req, res, next, kind) {
  try {
    if (req.simulation.status !== 'completed') return res.status(409).json({ error: 'The simulation audio is not ready.' });
    const file = kind === 'video' ? req.simulation.videoAudioOutput : req.simulation.whatsappAudioOutput;
    if (!file) return res.status(409).json({ error: `${kind === 'video' ? 'Video' : 'WhatsApp'} awareness audio is not ready.` });
    const mime = req.simulation.mode === 'demo' && req.simulation.voice?.path === file
      ? (req.simulation.voice.mime || 'audio/webm')
      : 'audio/wav';
    await sendAsset(res, file, { contentType: mime, filename: `${kind}-awareness-audio` });
  } catch (error) { next(error); }
}

router.get('/:id/audio/whatsapp', loadAuthorisedSession, (req, res, next) => sendAudio(req, res, next, 'whatsapp'));
router.get('/:id/audio/video', loadAuthorisedSession, (req, res, next) => sendAudio(req, res, next, 'video'));
router.get('/:id/audio', loadAuthorisedSession, (req, res, next) => sendAudio(req, res, next, 'whatsapp'));

router.get('/:id/video', loadAuthorisedSession, async (req, res, next) => {
  try {
    if (req.simulation.mode === 'demo') return res.status(409).json({ error: 'Internal demo mode does not create an AI video.' });
    if (req.simulation.status !== 'completed' || !req.simulation.output) return res.status(409).json({ error: 'The simulation video is not ready.' });
    await sendAsset(res, req.simulation.output, { contentType: 'video/mp4', filename: 'ai-awareness-simulation.mp4' });
  } catch (error) { next(error); }
});

router.get('/:id/variant/:index', loadAuthorisedSession, async (req, res, next) => {
  try {
    if (req.simulation.profileStatus !== 'completed') return res.status(409).json({ error: 'Synthetic profile images are not ready.' });
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= (req.simulation.variants || []).length) {
      return res.status(404).json({ error: 'Synthetic profile image was not found.' });
    }
    await sendAsset(res, req.simulation.variants[index], {
      contentType: req.simulation.mode === 'demo' ? (req.simulation.face?.mime || 'image/jpeg') : 'image/jpeg',
      filename: `profile-demo-${index + 1}.jpg`
    });
  } catch (error) { next(error); }
});

router.delete('/:id', loadAuthorisedSession, async (req, res, next) => {
  try {
    generationAdmissions.delete(req.simulation.id);
    await deleteSession(req.simulation.id, { cancelPredictions: true });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
