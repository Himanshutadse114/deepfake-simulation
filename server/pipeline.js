const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const { updateStatus, removeLocalSessionFiles } = require('./store');
const { createTemporaryVoice, synthesizeFixedScript, deleteVoice } = require('./services/elevenlabs');
const { uploadResource, createTalk, waitForTalk, deleteResource } = require('./services/did');
const { createWatermarkedVideo } = require('./services/watermark');

async function generateSimulation(session) {
  const directory = path.join(config.uploadRoot, session.id);
  const speechPath = path.join(directory, 'speech.mp3');
  const rawVideoPath = path.join(directory, 'raw.mp4');
  const outputPath = path.join(directory, 'simulation.mp4');
  let voiceId;
  let didImage;
  let didAudio;

  try {
    if (!session.face || !session.voice) throw new Error('Both face and voice media are required.');
    if (!Object.values(session.consents || {}).every(Boolean)) throw new Error('All participant consent confirmations are required.');

    updateStatus(session, 'validating', 'Consent and uploaded media checks passed.');

    if (config.demoMode) {
      updateStatus(session, 'demo_ready', 'DEMO_MODE is enabled, so paid cloning/video providers were not called.');
      await removeLocalSessionFiles(session);
      return;
    }

    if (!config.providers.elevenLabsKey || !config.providers.didKey) throw new Error('ElevenLabs and D-ID API keys are required when DEMO_MODE=false.');

    updateStatus(session, 'cloning_voice', 'Creating an ephemeral voice clone from the participant-provided sample.');
    voiceId = await createTemporaryVoice(session.voice, session.id);
    session.provider.elevenLabsVoiceId = voiceId;

    updateStatus(session, 'generating_audio', 'Generating the fixed security-awareness script.');
    await synthesizeFixedScript(voiceId, speechPath);

    updateStatus(session, 'uploading_media', 'Uploading temporary animation inputs to D-ID.');
    [didImage, didAudio] = await Promise.all([
      uploadResource('image', session.face.path, session.face.mime),
      uploadResource('audio', speechPath, 'audio/mpeg')
    ]);
    session.provider.didImageId = didImage.id;
    session.provider.didAudioId = didAudio.id;

    updateStatus(session, 'generating_video', 'D-ID is animating the consented portrait using the fixed awareness audio.');
    const talkId = await createTalk(didImage.url, didAudio.url, session.id);
    session.provider.didTalkId = talkId;
    const resultUrl = await waitForTalk(talkId);

    updateStatus(session, 'watermarking', 'Burning a permanent AI-generated simulation disclosure into the result.');
    await createWatermarkedVideo(resultUrl, rawVideoPath, outputPath);
    session.output = outputPath;

    updateStatus(session, 'completed', 'The restricted awareness simulation is ready.');
    await removeLocalSessionFiles(session, { keepOutput: true });
  } catch (error) {
    updateStatus(session, 'failed', error.message || 'Generation failed.');
    await removeLocalSessionFiles(session).catch(() => {});
  } finally {
    await Promise.allSettled([
      deleteVoice(voiceId),
      deleteResource('image', didImage?.id),
      deleteResource('audio', didAudio?.id)
    ]);
    session.provider.elevenLabsVoiceId = null;
    session.provider.didImageId = null;
    session.provider.didAudioId = null;
  }
}

module.exports = { generateSimulation };
