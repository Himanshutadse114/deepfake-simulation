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
  awarenessScript: 'Hello, how are you? This is an AI-generated security awareness simulation. But imagine if this message asked you to transfer money, share an OTP, reveal a password, or disclose confidential information. A familiar face and voice do not always prove who is really behind a message. Verify unusual requests through a trusted channel and stay safe.',
  providers: {
    replicateToken: process.env.REPLICATE_API_TOKEN || '',
    chatterboxModel: process.env.CHATTERBOX_MODEL || 'resemble-ai/chatterbox-multilingual:9cfba4c265e685f840612be835424f8c33bdee685d7466ece7684b0d9d4c0b1c',
    chatterboxLanguage: process.env.CHATTERBOX_LANGUAGE || 'en',

    didKey: process.env.DID_API_KEY || '',
    didEnabled: String(process.env.DID_ADAPTER_ENABLED || 'true').toLowerCase() !== 'false',

    prunaModel: process.env.PRUNA_MODEL || 'prunaai/p-video-avatar',
    prunaResolution: process.env.PRUNA_RESOLUTION || '720p',
    heygenApiKey: process.env.HEYGEN_API_KEY || '',
    heygenAccessToken: process.env.HEYGEN_ACCESS_TOKEN || '',
    heygenEnabled: String(process.env.HEYGEN_ADAPTER_ENABLED || 'true').toLowerCase() !== 'false',

    // Keep D-ID isolated by default during provider testing so failures do not trigger another paid provider.
    videoProviderPreference: (process.env.VIDEO_PROVIDER_PREFERENCE || 'did').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  }
};
