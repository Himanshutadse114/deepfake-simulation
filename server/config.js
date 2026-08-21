const path = require('node:path');

const numberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const booleanEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
};

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT || 10000),
  root: ROOT,
  uploadRoot: path.join(ROOT, 'uploads'),
  clientDist: path.join(ROOT, 'client', 'dist'),
  maxImageBytes: numberEnv('MAX_IMAGE_SIZE_MB', 8) * 1024 * 1024,
  maxAudioBytes: numberEnv('MAX_AUDIO_SIZE_MB', 20) * 1024 * 1024,
  maxReferenceAudioSeconds: numberEnv('MAX_REFERENCE_AUDIO_SECONDS', 45),
  maxGeneratedAudioSeconds: numberEnv('MAX_GENERATED_AUDIO_SECONDS', 30),
  retentionMs: numberEnv('MEDIA_RETENTION_MINUTES', 30) * 60 * 1000,
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  adminKey: String(process.env.ADMIN_KEY || '').trim(),
  scriptPolicy: {
    minChars: numberEnv('SCRIPT_MIN_CHARS', 20),
    maxChars: numberEnv('SCRIPT_MAX_CHARS', 180),
    blockUrls: booleanEnv('SCRIPT_BLOCK_URLS', true),
    requireAwarenessContext: booleanEnv('SCRIPT_REQUIRE_AWARENESS_CONTEXT', false)
  },
  // Legacy benign fallback retained for older provider adapters.
  awarenessScript: 'This is an AI-generated security awareness simulation. A familiar face or voice can be faked. Verify unusual requests through a trusted channel before acting.',
  providers: {
    replicateToken: process.env.REPLICATE_API_TOKEN || '',

    // Active voice path: per-session reference-audio cloning on Replicate.
    voiceProvider: String(process.env.VOICE_PROVIDER || 'qwen').trim().toLowerCase(),
    qwenModel: process.env.QWEN_MODEL || 'qwen/qwen3-tts',
    qwenLanguage: process.env.QWEN_LANGUAGE || 'auto',
    separateVideoAudio: booleanEnv('SEPARATE_VIDEO_AUDIO', false),

    // Optional fallback/experimentation providers kept available but not active by default.
    chatterboxModel: process.env.CHATTERBOX_MODEL || 'resemble-ai/chatterbox-multilingual:9cfba4c265e685f840612be835424f8c33bdee685d7466ece7684b0d9d4c0b1c',
    chatterboxLanguage: process.env.CHATTERBOX_LANGUAGE || 'en',
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsModel: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',

    // Social-profile awareness images are generated only after the first learning checkpoint.
    fluxEnabled: String(process.env.FLUX_ENABLED || 'true').toLowerCase() !== 'false',
    fluxModel: process.env.FLUX_MODEL || 'black-forest-labs/flux-2-pro',
    fluxGridImages: Math.min(numberEnv('FLUX_GRID_IMAGES', 4), 4),

    didKey: process.env.DID_API_KEY || '',
    didEnabled: String(process.env.DID_ADAPTER_ENABLED || 'false').toLowerCase() !== 'false',

    prunaModel: process.env.PRUNA_MODEL || 'prunaai/p-video-avatar',
    prunaResolution: process.env.PRUNA_RESOLUTION || '720p',
    heygenApiKey: process.env.HEYGEN_API_KEY || '',
    heygenAccessToken: process.env.HEYGEN_ACCESS_TOKEN || '',
    heygenEnabled: String(process.env.HEYGEN_ADAPTER_ENABLED || 'false').toLowerCase() !== 'false',

    // Pruna is isolated by default so failures never spill into another paid video provider.
    videoProviderPreference: (process.env.VIDEO_PROVIDER_PREFERENCE || 'pruna').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  }
};
