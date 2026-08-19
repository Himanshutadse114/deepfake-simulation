const path = require('node:path');
const config = require('./config');
const { updateStatus, updateProfileStatus, removeLocalSessionFiles } = require('./store');
const { synthesizeFixedScript: synthesizeQwen } = require('./services/qwen');
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

  if (provider === 'qwen') {
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when VOICE_PROVIDER=qwen.');
    updateStatus(session, 'cloning_voice', 'Qwen3-TTS is cloning the participant-provided reference voice for the fixed awareness sentence.');
    await synthesizeQwen(session.voice, speechPath, session.voice?.referenceText || '');
    session.provider.voice = 'qwen3-tts';
    return;
  }

  if (provider === 'elevenlabs') {
    if (!config.providers.elevenLabsApiKey) throw new Error('ELEVENLABS_API_KEY is required when VOICE_PROVIDER=elevenlabs.');
    updateStatus(session, 'cloning_voice', 'ElevenLabs is creating a temporary consented voice clone for this session.');
    await synthesizeElevenLabs(session.voice, speechPath, session.id);
    session.provider.voice = 'elevenlabs';
    return;
  }

  if (provider === 'chatterbox') {
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when VOICE_PROVIDER=chatterbox.');
    updateStatus(session, 'cloning_voice', 'Chatterbox is cloning the participant-provided reference voice for the fixed awareness sentence.');
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
        updateStatus(session, 'generating_video', 'Pruna is animating the original consented portrait with the exact same cloned awareness audio used in the voice-deepfake lesson.');
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
    session.audioOutput = speechPath;

    const video = await generateVideoWithFallback(session, speechPath);
    session.provider.video = video.provider;

    updateStatus(session, 'watermarking', 'Burning a permanent AI-generated simulation disclosure into the result.');
    await createWatermarkedVideo(video.url, rawVideoPath, outputPath);
    session.output = outputPath;

    updateStatus(session, 'completed', `Your restricted voice and video deepfake-awareness assets are ready (${video.provider}).`);

    // Remove the participant's original voice sample and raw video immediately.
    // Keep only the generated fixed-script clone, watermarked result and original
    // portrait needed for the later FLUX impersonation-profile exercise.
    await removeLocalSessionFiles(session, {
      keepOutput: true,
      keepAudio: true,
      keepFace: config.providers.fluxEnabled
    });
  } catch (error) {
    updateStatus(session, 'failed', error.message || 'Generation failed.');
    await removeLocalSessionFiles(session).catch(() => {});
  }
}

async function generateProfileVariants(session) {
  updateProfileStatus(session, 'generating', 'FLUX.2 Pro is turning the single consented portrait into four synthetic social-profile photos with different settings.');
  session.profileError = null;

  try {
    if (session.status !== 'completed' || !session.output) throw new Error('Complete the deepfake video stage before generating the profile demo.');
    if (!config.providers.fluxEnabled) throw new Error('FLUX profile generation is disabled. Set FLUX_ENABLED=true.');
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required for FLUX image generation.');
    if (!session.face?.path) throw new Error('The temporary participant portrait is no longer available for this session.');

    session.variants = await generateIdentityVariants(session.face, session.id);
    if (!session.variants.length) throw new Error('FLUX did not return any synthetic profile images.');

    session.provider.images = 'flux-2-pro';
    updateProfileStatus(session, 'completed', `${session.variants.length} synthetic profile images are ready for the impersonation lesson.`);

    // Original portrait is no longer required after FLUX. Keep only the
    // watermarked video, generated clone audio and synthetic lesson images.
    await removeLocalSessionFiles(session, {
      keepOutput: true,
      keepAudio: true,
      keepVariants: true
    });
  } catch (error) {
    session.profileError = error.message || 'FLUX profile generation failed.';
    updateProfileStatus(session, 'failed', session.profileError);
    await removeLocalSessionFiles(session, {
      keepOutput: true,
      keepAudio: true,
      keepFace: true
    }).catch(() => {});
    throw error;
  }
}

module.exports = { generateSimulation, generateProfileVariants, generateVideoWithFallback, generateVoice };
