const path = require('node:path');
const config = require('./config');
const { updateStatus, removeLocalSessionFiles } = require('./store');
const { synthesizeFixedScript: synthesizeChatterbox } = require('./services/chatterbox');
const { synthesizeFixedScript: synthesizeElevenLabs } = require('./services/elevenlabs');
const { generateIdentityVariants } = require('./services/flux');
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

async function generateVoice(session, speechPath) {
  const provider = config.providers.voiceProvider;

  if (provider === 'elevenlabs') {
    if (!config.providers.elevenLabsApiKey) throw new Error('ELEVENLABS_API_KEY is required when VOICE_PROVIDER=elevenlabs.');
    updateStatus(session, 'cloning_voice', 'ElevenLabs is creating a temporary consented voice clone for this session.');
    await synthesizeElevenLabs(session.voice, speechPath, session.id);
    session.provider.voice = 'elevenlabs';
    return;
  }

  if (provider === 'chatterbox') {
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when VOICE_PROVIDER=chatterbox.');
    updateStatus(session, 'generating_audio', 'Chatterbox Multilingual is generating the fixed awareness message from the participant-provided reference voice.');
    await synthesizeChatterbox(session.voice, speechPath);
    session.provider.voice = 'chatterbox';
    return;
  }

  throw new Error(`Unsupported VOICE_PROVIDER: ${provider}`);
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
        updateStatus(session, 'generating_video', 'D-ID is animating the consented portrait with the fixed awareness audio.');
        return await generateDidVideo(session.face, speechPath, session.id);
      }
      if (provider === 'heygen') {
        if (!heygenConfigured()) {
          failures.push('heygen: HeyGen authentication is not configured');
          continue;
        }
        updateStatus(session, 'generating_video', 'HeyGen is animating the consented portrait with the fixed awareness audio.');
        return await generateHeyGenVideo(session.face, speechPath, session.id);
      }
      if (provider === 'pruna') {
        if (!config.providers.replicateToken) {
          failures.push('pruna: REPLICATE_API_TOKEN is not configured');
          continue;
        }
        updateStatus(session, 'generating_video', 'Pruna is animating the original consented portrait with the fixed awareness audio.');
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

    await generateVoice(session, speechPath);

    // FLUX variants are optional awareness assets. A variant failure should not
    // discard an otherwise valid paid voice/video generation.
    if (config.providers.fluxEnabled) {
      try {
        if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when FLUX_ENABLED=true.');
        updateStatus(session, 'generating_variants', 'FLUX.2 Pro is creating consented identity-preserving angle and background variants for the awareness grid.');
        session.variants = await generateIdentityVariants(session.face, session.id);
        session.provider.images = 'flux-2-pro';
      } catch (error) {
        session.variantError = error.message || 'FLUX image variants could not be generated.';
        session.variants = [];
        console.warn(`FLUX variants skipped for session ${session.id.slice(0, 8)}: ${session.variantError}`);
      }
    }

    const video = await generateVideoWithFallback(session, speechPath);
    session.provider.video = video.provider;

    updateStatus(session, 'watermarking', 'Burning a permanent AI-generated simulation disclosure into the result.');
    await createWatermarkedVideo(video.url, rawVideoPath, outputPath);
    session.output = outputPath;

    const variantNote = session.variants?.length ? ` + ${session.variants.length} synthetic awareness images` : '';
    updateStatus(session, 'completed', `The restricted awareness simulation is ready (${video.provider}${variantNote}).`);
    await removeLocalSessionFiles(session, { keepOutput: true });
  } catch (error) {
    updateStatus(session, 'failed', error.message || 'Generation failed.');
    await removeLocalSessionFiles(session).catch(() => {});
  }
}

module.exports = { generateSimulation, generateVideoWithFallback, generateVoice };
