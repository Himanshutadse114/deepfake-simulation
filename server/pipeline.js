const path = require('node:path');
const config = require('./config');
const { updateStatus, removeLocalSessionFiles } = require('./store');
const { synthesizeFixedScript } = require('./services/chatterbox');
const { generateAvatarVideo: generateDidVideo } = require('./services/did');
const { generateAvatarVideo: generateHeyGenVideo } = require('./services/heygen');
const { generateAvatarVideo: generatePrunaVideo } = require('./services/pruna');
const { createWatermarkedVideo } = require('./services/watermark');

function didConfigured() {
  return config.providers.didEnabled && Boolean(config.providers.didKey);
}

function heygenConfigured() {
  return config.providers.heygenEnabled && Boolean(config.providers.heygenAccessToken || config.providers.heygenApiKey);
}

async function generateVideoWithFallback(session, speechPath) {
  const failures = [];
  for (const provider of config.providers.videoProviderPreference) {
    try {
      if (provider === 'did') {
        if (!didConfigured()) {
          failures.push('did: DID_API_KEY is not configured');
          continue;
        }
        updateStatus(session, 'generating_video', 'D-ID is animating the consented portrait with the fixed Chatterbox awareness audio.');
        return await generateDidVideo(session.face, speechPath, session.id);
      }
      if (provider === 'heygen') {
        if (!heygenConfigured()) continue;
        updateStatus(session, 'generating_video', 'HeyGen is animating the consented portrait with the fixed awareness audio.');
        return await generateHeyGenVideo(session.face, speechPath, session.id);
      }
      if (provider === 'pruna') {
        updateStatus(session, 'generating_video', 'Pruna is animating the consented portrait with the fixed awareness audio.');
        return await generatePrunaVideo(session.face, speechPath);
      }
      failures.push(`${provider}: unsupported video provider`);
    } catch (error) {
      failures.push(`${provider}: ${error.message}`);
    }
  }
  throw new Error(`No video provider completed the simulation. ${failures.join(' | ')}`.trim());
}

async function generateSimulation(session) {
  const directory = path.join(config.uploadRoot, session.id);
  const speechPath = path.join(directory, 'speech.wav');
  const rawVideoPath = path.join(directory, 'raw.mp4');
  const outputPath = path.join(directory, 'simulation.mp4');

  try {
    if (!session.face || !session.voice) throw new Error('Both face and voice media are required.');
    if (!Object.values(session.consents || {}).every(Boolean)) throw new Error('All participant consent confirmations are required.');

    updateStatus(session, 'validating', 'Consent and uploaded media checks passed.');

    if (config.demoMode) {
      updateStatus(session, 'demo_ready', 'DEMO_MODE is enabled, so paid AI providers were not called.');
      await removeLocalSessionFiles(session);
      return;
    }

    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when DEMO_MODE=false.');

    updateStatus(session, 'generating_audio', 'Chatterbox Multilingual is generating the fixed awareness message from the participant-provided reference voice.');
    await synthesizeFixedScript(session.voice, speechPath);

    const video = await generateVideoWithFallback(session, speechPath);
    session.provider.video = video.provider;

    updateStatus(session, 'watermarking', 'Burning a permanent AI-generated simulation disclosure into the result.');
    await createWatermarkedVideo(video.url, rawVideoPath, outputPath);
    session.output = outputPath;

    updateStatus(session, 'completed', `The restricted awareness simulation is ready (${video.provider}).`);
    await removeLocalSessionFiles(session, { keepOutput: true });
  } catch (error) {
    updateStatus(session, 'failed', error.message || 'Generation failed.');
    await removeLocalSessionFiles(session).catch(() => {});
  }
}

module.exports = { generateSimulation, generateVideoWithFallback };
