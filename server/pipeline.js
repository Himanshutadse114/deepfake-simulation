const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
const {
  saveSession,
  updateStatus,
  updateProfileStatus
} = require('./store');
const {
  persistGeneratedFile,
  materialize,
  deleteRef
} = require('./storage');
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

function ensureStages(session) {
  session.stages ||= {};
  session.stages.whatsappAudio ||= { status: 'pending', predictionId: null };
  session.stages.videoAudio ||= { status: 'pending', predictionId: null };
  session.stages.pruna ||= { status: 'pending', predictionId: null, providerUrl: null };
  session.stages.flux ||= { status: 'pending', predictionId: null, providerUrl: null };
  session.provider ||= {};
  session.variants ||= [];
  return session.stages;
}

async function persistSession(session) {
  if (session?.id) await saveSession(session);
}

function compactProviderOutput(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  if (typeof output?.url === 'string') return output.url;
  return null;
}

function predictionCallbacks(session, stageKey) {
  ensureStages(session);
  const stage = session.stages[stageKey];
  return {
    predictionId: stage.predictionId,
    onPredictionCreated: async (prediction) => {
      stage.predictionId = prediction.id;
      stage.status = 'provider_running';
      await persistSession(session);
    },
    onProviderOutput: async (payload) => {
      stage.predictionId = payload.predictionId || stage.predictionId;
      stage.providerUrl = payload.url || compactProviderOutput(payload.output) || stage.providerUrl || null;
      stage.status = 'provider_succeeded';
      await persistSession(session);
    }
  };
}

function rateLimitStatus(session) {
  return async ({ waitSeconds }) => {
    updateStatus(session, 'rate_limited', `Temporary service limit reached. Waiting about ${waitSeconds} seconds, then continuing automatically.`);
    await persistSession(session);
  };
}

async function generateVoice(session, speechPath, text, status = 'cloning_voice', stageKey = 'whatsappAudio') {
  const provider = config.providers.voiceProvider;
  updateStatus(session, status, status === 'cloning_whatsapp'
    ? 'Cloning your voice for the WhatsApp experience.'
    : 'Cloning your voice for the video experience.');
  await persistSession(session);

  if (provider === 'qwen') {
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required when VOICE_PROVIDER=qwen.');
    const callbacks = predictionCallbacks(session, stageKey);
    await synthesizeQwen(session.voice, speechPath, session.voice?.referenceText || '', text, {
      ...callbacks,
      onRateLimit: rateLimitStatus(session)
    });
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
    await synthesizeChatterbox(session.voice, speechPath, text, {
      onRateLimit: rateLimitStatus(session)
    });
    session.provider.voice = 'chatterbox';
    return;
  }

  throw new Error(`Unsupported VOICE_PROVIDER: ${provider}`);
}

async function persistAudioTrack(session, stageKey, localPath, relativeName) {
  const ref = session?.id
    ? await persistGeneratedFile(session.id, relativeName, localPath, 'audio/wav')
    : localPath;
  const stage = ensureStages(session)[stageKey];
  stage.status = 'completed';
  if (stageKey === 'whatsappAudio') session.whatsappAudioOutput = ref;
  else session.videoAudioOutput = ref;
  await persistSession(session);
  return ref;
}

async function generateCheckedAudioTracks(session, { whatsappPath, videoSpeechPath }, dependencies = {}) {
  ensureStages(session);
  const generateVoiceTrack = dependencies.generateVoice || generateVoice;
  const checkDuration = dependencies.assertAudioDuration || assertAudioDuration;

  if (session.stages.whatsappAudio.status !== 'completed' || !session.whatsappAudioOutput) {
    await generateVoiceTrack(session, whatsappPath, session.scripts.whatsapp, 'cloning_whatsapp', 'whatsappAudio');
    await checkDuration(whatsappPath, {
      label: 'Generated awareness audio',
      maxSeconds: config.maxGeneratedAudioSeconds
    });
    await persistAudioTrack(session, 'whatsappAudio', whatsappPath, 'whatsapp-speech.wav');
  }

  if (session.stages.videoAudio.status !== 'completed' || !session.videoAudioOutput) {
    await generateVoiceTrack(session, videoSpeechPath, session.scripts.video, 'cloning_video', 'videoAudio');
    await checkDuration(videoSpeechPath, {
      label: 'Generated video audio',
      // Pruna is billed per output second and the final video is capped at ten
      // seconds. Never pay for generated video audio that will later be cut off.
      maxSeconds: config.maxVideoSeconds
    });
    await persistAudioTrack(session, 'videoAudio', videoSpeechPath, 'video-speech.wav');
  }
}

async function materializeLegacyVideoInputs(session, speechRef, workspace) {
  const faceExtension = session.face?.mime === 'image/png' ? 'png' : 'jpg';
  const facePath = path.join(workspace, `legacy-face.${faceExtension}`);
  const audioPath = path.join(workspace, 'legacy-video-audio.wav');
  await Promise.all([
    materialize(session.face.path, facePath),
    materialize(speechRef, audioPath)
  ]);
  return {
    faceFile: { ...session.face, path: facePath },
    speechPath: audioPath
  };
}

async function generateVideoWithFallback(session, speechRef, workspace = path.join(config.workRoot, session.id || 'test')) {
  ensureStages(session);
  if (session.stages.pruna.status === 'completed' && session.output) {
    return { provider: session.provider.video || 'pruna', output: session.output };
  }

  const failures = [];
  for (const provider of config.providers.videoProviderPreference) {
    let providerAttempted = false;
    try {
      if (provider === 'did') {
        if (!didConfigured()) {
          failures.push('did: DID_API_KEY is not configured');
          continue;
        }
        providerAttempted = true;
        updateStatus(session, 'generating_video', 'Decoding facial structure and preparing the impersonation video.');
        await persistSession(session);
        const local = await materializeLegacyVideoInputs(session, speechRef, workspace);
        return await generateDidVideo(local.faceFile, local.speechPath, session.id);
      }

      if (provider === 'heygen') {
        if (!heygenConfigured()) {
          failures.push('heygen: HeyGen authentication is not configured');
          continue;
        }
        providerAttempted = true;
        updateStatus(session, 'generating_video', 'Decoding facial structure and preparing the impersonation video.');
        await persistSession(session);
        const local = await materializeLegacyVideoInputs(session, speechRef, workspace);
        return await generateHeyGenVideo(local.faceFile, local.speechPath, session.id);
      }

      if (provider === 'pruna') {
        if (!config.providers.replicateToken) {
          failures.push('pruna: REPLICATE_API_TOKEN is not configured');
          continue;
        }
        providerAttempted = true;
        const stage = session.stages.pruna;
        updateStatus(session, 'generating_video', 'Decoding facial structure and preparing the impersonation video.');
        await persistSession(session);

        if (stage.status === 'provider_succeeded' && stage.providerUrl) {
          return { provider: 'pruna', url: stage.providerUrl, predictionId: stage.predictionId };
        }

        const callbacks = predictionCallbacks(session, 'pruna');
        const result = await generatePrunaVideo(session.face, speechRef, {
          ...callbacks,
          onRateLimit: rateLimitStatus(session)
        });
        session.provider.video = 'pruna';
        await persistSession(session);
        return result;
      }

      failures.push(`${provider}: unsupported video provider`);
    } catch (error) {
      failures.push(`${provider}: ${error.message}`);
      if (provider === 'pruna') {
        session.stages.pruna.status = error.nonRetryable ? 'provider_failed' : 'interrupted';
        await persistSession(session);
      }
      if (providerAttempted && !config.providers.allowPaidVideoFallback) throw error;
    }
  }

  throw new Error(`No video provider completed the simulation. ${failures.join(' | ')}`.trim());
}

async function completeDemoSession(session) {
  updateStatus(session, 'demo_preparing', 'Internal demo mode: loading the uploaded media.');
  session.whatsappAudioOutput = session.voice.path;
  session.videoAudioOutput = session.voice.path;
  session.variants = [session.face.path, session.face.path, session.face.path, session.face.path];
  session.provider = {
    voice: 'demo-original-sample',
    video: 'demo-static-preview',
    images: 'demo-original-photo'
  };
  ensureStages(session);
  session.stages.whatsappAudio.status = 'completed';
  session.stages.videoAudio.status = 'completed';
  session.stages.flux.status = 'completed';
  updateProfileStatus(session, 'completed', 'Internal demo profile is ready using participant media only.');
  updateStatus(session, 'completed', 'Internal demo is ready. Uploaded media will be removed at completion or expiry.');
  await persistSession(session);
}

async function runInitialGeneration(mediaTask, profileTask) {
  const results = await Promise.allSettled([
    Promise.resolve().then(mediaTask),
    Promise.resolve().then(profileTask)
  ]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
}

async function finalizeVideo(session, video, workspace) {
  const stage = session.stages.pruna;
  const rawVideoPath = path.join(workspace, 'raw.mp4');
  const outputPath = path.join(workspace, 'simulation.mp4');

  if (stage.status === 'completed' && session.output) return session.output;
  const sourceUrl = video?.url || stage.providerUrl;
  if (!sourceUrl) throw new Error('The video provider completed without a reusable output URL.');
  stage.providerUrl = sourceUrl;
  stage.status = 'provider_succeeded';
  await persistSession(session);

  updateStatus(session, 'watermarking', 'Finalizing facial motion and applying the awareness disclosure.');
  await persistSession(session);
  await createWatermarkedVideo(sourceUrl, rawVideoPath, outputPath, { maxSeconds: config.maxVideoSeconds });
  session.output = await persistGeneratedFile(session.id, 'simulation.mp4', outputPath, 'video/mp4');
  stage.status = 'completed';
  await persistSession(session);
  return session.output;
}

async function generateProfileVariants(session, workspace = path.join(config.workRoot, session.id || 'test')) {
  ensureStages(session);
  if (session.mode === 'demo') {
    updateProfileStatus(session, 'completed', 'Internal demo profile uses the uploaded portrait; no AI provider was called.');
    await persistSession(session);
    return session.variants;
  }

  if (session.stages.flux.status === 'completed' && session.variants?.length === 4) {
    updateProfileStatus(session, 'completed', 'Four profile images are ready.');
    await persistSession(session);
    return session.variants;
  }

  updateProfileStatus(session, 'generating', 'Creating one identity-consistent profile grid and preparing four photos.');
  session.profileError = null;
  await persistSession(session);

  try {
    if (!config.providers.fluxEnabled) throw new Error('FLUX profile generation is disabled. Set FLUX_ENABLED=true.');
    if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is required for FLUX image generation.');
    if (!session.face?.path) throw new Error('The temporary participant portrait is no longer available for this session.');

    const callbacks = predictionCallbacks(session, 'flux');
    const result = await generateIdentityVariants(session.face, session.id, {
      workspace,
      ...callbacks,
      onRateLimit: rateLimitStatus(session)
    });
    if (result.variants.length !== 4) throw new Error('The generated profile grid could not be split into four images.');

    session.variants = await Promise.all(result.variants.map((variant, index) =>
      persistGeneratedFile(session.id, `variant-${index + 1}.jpg`, variant, 'image/jpeg')));
    session.stages.flux.predictionId = result.predictionId || session.stages.flux.predictionId;
    session.stages.flux.providerUrl = result.providerOutputUrl || session.stages.flux.providerUrl;
    session.stages.flux.status = 'completed';
    session.provider.images = 'flux-2-pro-grid';
    updateProfileStatus(session, 'completed', 'Four profile images are ready.');
    await persistSession(session);
    return session.variants;
  } catch (error) {
    session.stages.flux.status = error.nonRetryable ? 'provider_failed' : 'interrupted';
    session.profileError = error.message || 'Profile images could not be prepared.';
    updateProfileStatus(session, 'failed', session.profileError);
    await persistSession(session);
    throw error;
  }
}

async function generateSimulation(session) {
  ensureStages(session);
  const workspace = path.join(config.workRoot, session.id);
  const whatsappPath = path.join(workspace, 'whatsapp-speech.wav');
  const videoSpeechPath = path.join(workspace, 'video-speech.wav');
  await fs.mkdir(workspace, { recursive: true });

  try {
    if (session.status === 'completed') return session;
    if (!session.face?.path || !session.voice?.path) throw new Error('Both face and voice media are required.');
    if (!Object.values(session.consents || {}).every(Boolean)) throw new Error('All participant consent confirmations are required.');
    if (!session.scripts?.whatsapp || !session.scripts?.video) throw new Error('Both awareness audio scripts are required.');

    updateStatus(session, 'validating', 'Loading consented media and validating the generation checkpoints.');
    await persistSession(session);

    if (session.mode === 'demo' || config.demoMode) {
      await completeDemoSession(session);
      return session;
    }

    await generateCheckedAudioTracks(session, { whatsappPath, videoSpeechPath });

    const videoWork = async () => {
      const video = await generateVideoWithFallback(session, session.videoAudioOutput, workspace);
      if (video.output) return video.output;
      return finalizeVideo(session, video, workspace);
    };

    const results = await Promise.allSettled([
      videoWork(),
      generateProfileVariants(session, workspace)
    ]);

    if (results[0].status === 'rejected') throw results[0].reason;
    if (results[1].status === 'rejected') {
      console.warn(`[profile:${session.id}] continuing with the core simulation after profile generation failed: ${results[1].reason.message}`);
    }

    updateStatus(
      session,
      'completed',
      results[1].status === 'fulfilled'
        ? 'Your voice, video and profile experience are ready.'
        : 'Your voice and video experience are ready. The profile image step was unavailable, so the interface will use the consented portrait as a fallback.'
    );

    // Paid provider work is finished. Remove the original portrait/voice from
    // server-side/object storage; generated outputs remain only for retention.
    const originalFace = session.face?.path;
    const originalVoice = session.voice?.path;
    await Promise.allSettled([deleteRef(originalFace), deleteRef(originalVoice)]);
    if (session.face) session.face.path = null;
    if (session.voice) session.voice.path = null;
    await persistSession(session);
    return session;
  } catch (error) {
    console.warn(`[generation:${session.id}] ${error.stack || error.message || error}`);
    if (error.nonRetryable) {
      updateStatus(session, 'failed', error.message || 'Generation failed.');
    } else {
      updateStatus(session, 'retrying', `Generation was interrupted safely. Existing paid prediction IDs were kept so the worker can resume without blindly purchasing the same stage again. ${error.message || ''}`.trim());
    }
    await persistSession(session).catch(() => {});
    throw error;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  generateSimulation,
  generateProfileVariants,
  generateVideoWithFallback,
  generateVoice,
  generateCheckedAudioTracks,
  completeDemoSession,
  runInitialGeneration,
  ensureStages,
  predictionCallbacks,
  finalizeVideo
};
