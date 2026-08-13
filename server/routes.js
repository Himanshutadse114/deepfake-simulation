const express = require('express');
const fs = require('node:fs/promises');
const { createSession, getSession, publicSession, updateStatus, deleteSession } = require('./store');
const { upload, persistParticipantFile } = require('./media');
const { generateSimulation } = require('./pipeline');

const router = express.Router();

function allConsents(consents) {
  return consents?.faceOwnership === true && consents?.voiceOwnership === true && consents?.processing === true;
}

function loadAuthorisedSession(req, res, next) {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Simulation session was not found or has expired.' });
  const token = req.get('x-simulation-token') || req.query.token;
  if (!token || token !== session.token) return res.status(403).json({ error: 'Invalid simulation session token.' });
  req.simulation = session;
  next();
}

router.post('/session', (req, res) => {
  if (!allConsents(req.body?.consents)) return res.status(400).json({ error: 'All three informed-consent confirmations are required.' });
  const session = createSession(req.body.consents);
  res.status(201).json(publicSession(session));
});

router.post('/:id/face', loadAuthorisedSession, upload.single('face'), async (req, res, next) => {
  try {
    if (req.simulation.status !== 'collecting') return res.status(409).json({ error: 'This session is no longer accepting media.' });
    const saved = await persistParticipantFile(req.simulation.id, 'face', req.file);
    req.simulation.face = saved;
    res.json({
      ok: true,
      validation: {
        usable: true,
        method: 'local',
        reason: 'Image passed local file-signature, size and dimension checks.',
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
    req.simulation.voice = saved;
    res.json({ ok: true, size: saved.size, mime: saved.mime });
  } catch (error) { next(error); }
});

router.post('/:id/generate', loadAuthorisedSession, (req, res) => {
  const session = req.simulation;
  if (session.status !== 'collecting') return res.status(409).json({ error: `Simulation is already ${session.status}.` });
  if (!session.face || !session.voice) return res.status(400).json({ error: 'Upload both a validated face image and a voice sample first.' });
  updateStatus(session, 'queued', 'Generation has been queued.');
  setImmediate(() => generateSimulation(session));
  res.status(202).json({ status: session.status });
});

router.get('/:id/status', loadAuthorisedSession, (req, res) => {
  const { status, detail, expiresAt } = req.simulation;
  res.json({ status, detail, expiresAt });
});

router.get('/:id/video', loadAuthorisedSession, async (req, res, next) => {
  try {
    if (req.simulation.status !== 'completed' || !req.simulation.output) return res.status(409).json({ error: 'The simulation video is not ready.' });
    await fs.access(req.simulation.output);
    res.setHeader('cache-control', 'private, no-store');
    res.setHeader('content-disposition', 'inline; filename="ai-awareness-simulation.mp4"');
    res.sendFile(req.simulation.output);
  } catch (error) { next(error); }
});

router.delete('/:id', loadAuthorisedSession, async (req, res, next) => {
  try {
    await deleteSession(req.simulation.id);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

module.exports = router;
