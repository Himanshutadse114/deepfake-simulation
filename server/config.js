const path = require('node:path');

const numberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT || 10000),
  root: ROOT,
  uploadRoot: path.join(ROOT, 'uploads'),
  clientDist: path.join(ROOT, 'client', 'dist'),
  maxImageBytes: numberEnv('MAX_IMAGE_SIZE_MB', 8) * 1024 * 1024,
  maxAudioBytes: numberEnv('MAX_AUDIO_SIZE_MB', 20) * 1024 * 1024,
  retentionMs: numberEnv('MEDIA_RETENTION_MINUTES', 30) * 60 * 1000,
  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  // Keep the spoken simulation short so the generated awareness clip is roughly 8-10 seconds.
  awarenessScript: 'This is an AI-generated security awareness simulation. A familiar face or voice can be faked. Verify unusual requests through a trusted channel before acting.',
  providers: {
    replicateToken: process.env.REPLICATE_API_TOKEN || '',
    voiceProvider: String(process.env.VOICE_PROVIDER || 'chatterbox').trim().toLowerCase(),
    chatterboxModel: process.env.CHATTERBOX_MODEL || 'resemble-ai/chatterbox-multilingual:9cfba4c265e685f840612be835424f8c33bdee685d7466ece7684b0d9d4c0b1c',
    chatterboxLanguage: process.env.CHATTERBOX_LANGUAGE || 'en',

    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsModel: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',

    fluxEnabled: String(process.env.FLUX_ENABLED || 'false').toLowerCase() === 'true',
    fluxModel: process.env.FLUX_MODEL || 'black-forest-labs/flux-2-pro',
    fluxGridImages: numberEnv('FLUX_GRID_IMAGES', 4),

    didKey: process.env.DID_API_KEY || '',
    didEnabled: String(process.env.DID_ADAPTER_ENABLED || 'false').toLowerCase() !== 'false',

    prunaModel: process.env.PRUNA_MODEL || 'prunaai/p-video-avatar',
    prunaResolution: process.env.PRUNA_RESOLUTION || '720p',
    heygenApiKey: process.env.HEYGEN_API_KEY || '',
    heygenAccessToken: process.env.HEYGEN_ACCESS_TOKEN || '',
    heygenEnabled: String(process.env.HEYGEN_ADAPTER_ENABLED || 'false').toLowerCase() !== 'false',

    // Keep Pruna isolated during provider testing so a failure never triggers another paid video provider.
    videoProviderPreference: (process.env.VIDEO_PROVIDER_PREFERENCE || 'pruna').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  }
};
