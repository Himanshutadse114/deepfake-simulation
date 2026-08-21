const path = require('node:path');
const config = require('./config');
const { updateStatus, updateProfileStatus, removeLocalSessionFiles } = require('./store');
const { synthesizeScript: synthesizeQwen } = require('./services/qwen');
const { synthesizeFixedScript: synthesizeChatterbox } = require('./services/chatterbox');
const { synthesizeFixedScript: synthesizeElevenLabs } = require('./services/elevenlabs');
const { generateIdentityVariants } = require('./services/flux');
const { generateAvatarVideo: generateDidVideo } = require('./services/did');
const { generateAvatarVideo: generateHeyGenVideo } = require('./services/heygen');
const { generateAvatarVideo: generatePrunaVideo } = require('./services/pruna');
const { createWatermarkedVideo } = require('./services/watermark');
const { assertAudioDuration } = require('./services/audio-duration');

function didConfigured() {
  return config.providers.didEnabled && Boolean(config.providers.didKey);
}

function heygenConfigured() {
  return config.providers.heygenEnabled && Boolean(config.providers.heygenAccessToken || config.providers.heygenApiKey);
}

async function generateVoice(session, speechPath, text, stage = 'cloning_voice') {
  const provider = config.providers.voiceProvider;
  updateStatus(session, stage, stage === 'cloning_whatsapp'
    ? 'Creating the consented WhatsApp awareness voice note.'
    : 'Creating the separate consented voice track for the deepfake video.');

  if (provider === 'qwen') {
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when VOICE_PROVIDER=qwen.');
    await synthesizeQwen(session.voice, speechPath, session.voice?.referenceText || '', text);
    session.provider.voice = 'qwen3-tts';
    return;
  }

  if (provider === 'elevenlabs') {
    if (!config.providers.elevenLabsApiKey) throw new Error('ELEVENLABS_API_KEY is required when VOICE_PROVIDER=elevenlabs.');
    await synthesizeElevenLabs(session.voice, speechPath, session.id, text);
    session.provider.voice = 'elevenlabs';
    return;
  }

  if (provider === 'chatterbox') {
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when VOICE_PROVIDER=chatterbox.');
    await synthesizeChatterbox(session.voice, speechPath, text);
    session.provider.voice = 'chatterbox';
    return;
  }

  throw new Error(`Unsupported VOICE_PROVIDER: ${provider}`);
}

async function generateCheckedAudioTracks(session, { whatsappPath, videoSpeechPath }, dependencies = {}) {
  const generateVoiceTrack = dependencies.generateVoice || generateVoice;
  const checkDuration = dependencies.assertAudioDuration || assertAudioDuration;

  await generateVoiceTrack(session, whatsappPath, session.scripts.whatsapp, 'cloning_whatsapp');
  await checkDuration(whatsappPath, {
    label: 'Generated awareness audio',
    maxSeconds: config.maxGeneratedAudioSeconds
  });
  session.whatsappAudioOutput = whatsappPath;

  await generateVoiceTrack(session, videoSpeechPath, session.scripts.video, 'cloning_video');
  await checkDuration(videoSpeechPath, {
    label: 'Generated video audio',
    maxSeconds: config.maxGeneratedAudioSeconds
  });
  session.videoAudioOutput = videoSpeechPath;
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
        updateStatus(session, 'generating_video', 'D-ID is animating the consented portrait with the dedicated video audio.');
        return await generateDidVideo(session.face, speechPath, session.id);
      }
      if (provider === 'heygen') {
        if (!heygenConfigured()) {
          failures.push('heygen: HeyGen authentication is not configured');
          continue;
        }
        updateStatus(session, 'generating_video', 'HeyGen is animating the consented portrait with the dedicated video audio.');
        return await generateHeyGenVideo(session.face, speechPath, session.id);
      }
      if (provider === 'pruna') {
        if (!config.providers.replicateToken) {
          failures.push('pruna: REPLICATE_API_TOKEN is not configured');
          continue;
        }
        updateStatus(session, 'generating_video', 'Pruna is animating the original consented portrait with the checked video audio track.');
        return await generatePrunaVideo(session.face, speechPath);
      }
      failures.push(`${provider}: unsupported video provider`);
    } catch (error) {
      failures.push(`${provider}: ${error.message}`);
    }
  }
  throw new Error(`No video provider completed the simulation. ${failures.join(' | ')}`.trim());
}

async function completeDemoSession(session) {
  updateStatus(session, 'demo_preparing', 'Internal demo mode: using uploaded media directly. No AI provider is being called.');
  session.whatsappAudioOutput = session.voice.path;
  session.videoAudioOutput = session.voice.path;
  session.variants = [session.face.path, session.face.path, session.face.path, session.face.path];
  session.provider = {
    voice: 'demo-original-sample',
    video: 'demo-static-preview',
    images: 'demo-original-photo'
  };
  updateProfileStatus(session, 'completed', 'Internal demo profile is ready using local participant media only.');
  updateStatus(session, 'completed', 'Internal no-AI demo is ready. Uploaded media will be removed at completion or expiry.');
}

async function generateSimulation(session) {
  const directory = path.join(config.uploadRoot, session.id);
  const whatsappPath = path.join(directory, 'whatsapp-speech.wav');
  const videoSpeechPath = path.join(directory, 'video-speech.wav');
  const rawVideoPath = path.join(directory, 'raw.mp4');
  const outputPath = path.join(directory, 'simulation.mp4');

  try {
    if (!session.face || !session.voice) throw new Error('Both face and voice media are required.');
    if (!Object.values(session.consents || {}).every(Boolean)) throw new Error('All participant consent confirmations are required.');
    if (!session.scripts?.whatsapp || !session.scripts?.video) throw new Error('Both awareness audio scripts are required.');

    updateStatus(session, 'validating', 'Consent, scripts and uploaded media checks passed.');

    if (session.mode === 'demo' || config.demoMode) {
      await completeDemoSession(session);
      return;
    }

    await generateCheckedAudioTracks(session, { whatsappPath, videoSpeechPath });

    const video = await generateVideoWithFallback(session, session.videoAudioOutput);
    session.provider.video = video.provider;

    updateStatus(session, 'watermarking', 'Burning a permanent AI-generated awareness disclosure into the deepfake video.');
    await createWatermarkedVideo(video.url, rawVideoPath, outputPath, {
      maxSeconds: config.maxVideoSeconds
    });
    session.output = outputPath;

    updateProfileStatus(session, 'idle', config.providers.fluxEnabled
      ? 'Synthetic profile generation is optional and requires separate confirmation.'
      : 'FLUX is disabled; the profile stage will use the consented source portrait.');
    updateStatus(session, 'completed', `Your two checked audio tracks and 10-second deepfake video are ready (${video.provider}).`);

    // Delete original participant voice and portrait after all provider work.
    // Keep only generated outputs required by the learner flow until completion/expiry.
    await removeLocalSessionFiles(session, {
      keepOutput: true,
      keepAudio: true,
      keepFace: config.providers.fluxEnabled
    });
  } catch (error) {
    updateStatus(session, 'failed', error.message || 'Generation failed.');
    session.profileStatus = 'failed';
    session.profileError = error.message || 'Generation failed.';
    await removeLocalSessionFiles(session).catch(() => {});
  }
}

async function generateProfileVariants(session) {
  if (session.mode === 'demo') {
    updateProfileStatus(session, 'completed', 'Internal demo profile uses the uploaded portrait; no AI provider was called.');
    return session.variants;
  }

  updateProfileStatus(session, 'generating', 'FLUX.2 Pro is turning the consented portrait into four synthetic social-profile photos.');
  session.profileError = null;

  try {
    if (session.status !== 'completed' || !session.output) throw new Error('Complete the deepfake video stage before generating the profile demo.');
    if (session.variants?.length) {
      updateProfileStatus(session, 'completed', `${session.variants.length} synthetic profile images are already ready.`);
      return session.variants;
    }
    if (!config.providers.fluxEnabled) throw new Error('FLUX profile generation is disabled. Set FLUX_ENABLED=true.');
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required for FLUX image generation.');
    if (!session.face?.path) throw new Error('The temporary participant portrait is no longer available for this session.');

    session.variants = await generateIdentityVariants(session.face, session.id);
    if (!session.variants.length) throw new Error('FLUX did not return any synthetic profile images.');
    session.provider.images = 'flux-2-pro';
    updateProfileStatus(session, 'completed', `${session.variants.length} synthetic profile images are ready.`);
    await removeLocalSessionFiles(session, {
      keepOutput: true,
      keepAudio: true,
      keepVariants: true
    });
    return session.variants;
  } catch (error) {
    session.profileError = error.message || 'FLUX profile generation failed.';
    updateProfileStatus(session, 'failed', session.profileError);
    throw error;
  }
}

module.exports = {
  generateSimulation,
  generateProfileVariants,
  generateVideoWithFallback,
  generateVoice,
  generateCheckedAudioTracks,
  completeDemoSession
};
