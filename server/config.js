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
    geminiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsModel: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    didKey: process.env.DID_API_KEY || ''
  }
};
