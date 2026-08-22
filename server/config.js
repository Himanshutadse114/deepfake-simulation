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
const UPLOAD_ROOT = path.join(ROOT, 'uploads');

module.exports = {
  port: Number(process.env.PORT || 10000),
  root: ROOT,
  uploadRoot: UPLOAD_ROOT,
  stagingRoot: path.join(UPLOAD_ROOT, 'staging'),
  workRoot: process.env.WORK_ROOT ? path.resolve(process.env.WORK_ROOT) : path.join(UPLOAD_ROOT, 'work'),
  clientDist: path.join(ROOT, 'client', 'dist'),

  maxImageBytes: numberEnv('MAX_IMAGE_SIZE_MB', 8) * 1024 * 1024,
  maxAudioBytes: numberEnv('MAX_AUDIO_SIZE_MB', 20) * 1024 * 1024,
  maxGeneratedAudioSeconds: 12,
  maxVideoSeconds: Math.min(numberEnv('MAX_VIDEO_SECONDS', 10), 10),
  retentionMs: numberEnv('MEDIA_RETENTION_MINUTES', 30) * 60 * 1000,

  // Single Render service: many learners may queue, while only four complete AI
  // pipelines and two local FFmpeg/ffprobe processes execute concurrently.
  queueName: String(process.env.AI_QUEUE_NAME || 'deepfake-simulation-generation'),
  aiWorkerConcurrency: Math.min(numberEnv('AI_WORKER_CONCURRENCY', 4), 20),
  ffmpegConcurrency: Math.min(numberEnv('FFMPEG_CONCURRENCY', 2), 8),
  maxQueuedJobs: Math.min(numberEnv('AI_MAX_QUEUED_JOBS', 250), 5000),
  dailyAiBudgetUsd: numberEnv('AI_DAILY_BUDGET_USD', 50),
  estimatedSimulationCostUsd: numberEnv('ESTIMATED_SIMULATION_COST_USD', 0.35),

  demoMode: String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true',
  adminKey: String(process.env.ADMIN_KEY || '').trim(),

  // When connected to the main Innvikta platform, enable REQUIRE_LAUNCH_TOKEN
  // so only a signed tenant/user/campaign launch can reserve paid AI work.
  launchTokenSecret: String(process.env.LAUNCH_TOKEN_SECRET || '').trim(),
  requireLaunchToken: booleanEnv('REQUIRE_LAUNCH_TOKEN', false),

  storage: {
    bucket: String(process.env.S3_BUCKET || '').trim(),
    region: String(process.env.S3_REGION || 'auto').trim(),
    endpoint: String(process.env.S3_ENDPOINT || '').trim(),
    accessKeyId: String(process.env.S3_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(process.env.S3_SECRET_ACCESS_KEY || '').trim(),
    forcePathStyle: booleanEnv('S3_FORCE_PATH_STYLE', false)
  },

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

    // Optional fallback/experimentation providers kept available but not active by default.
    chatterboxModel: process.env.CHATTERBOX_MODEL || 'resemble-ai/chatterbox-multilingual:9cfba4c265e685f840612be835424f8c33bdee685d7466ece7684b0d9d4c0b1c',
    chatterboxLanguage: process.env.CHATTERBOX_LANGUAGE || 'en',
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsModel: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',

    // Four profile tiles come from one 2 MP FLUX contact-sheet prediction.
    fluxEnabled: String(process.env.FLUX_ENABLED || 'true').toLowerCase() !== 'false',
    fluxModel: process.env.FLUX_MODEL || 'black-forest-labs/flux-2-pro',
    fluxGridImages: 4,

    didKey: process.env.DID_API_KEY || '',
    didEnabled: String(process.env.DID_ADAPTER_ENABLED || 'false').toLowerCase() !== 'false',

    prunaModel: process.env.PRUNA_MODEL || 'prunaai/p-video-avatar',
    prunaResolution: process.env.PRUNA_RESOLUTION || '720p',
    heygenApiKey: process.env.HEYGEN_API_KEY || '',
    heygenAccessToken: process.env.HEYGEN_ACCESS_TOKEN || '',
    heygenEnabled: String(process.env.HEYGEN_ADAPTER_ENABLED || 'false').toLowerCase() !== 'false',

    // Pruna remains isolated by default so one failed paid provider never
    // automatically spills into another paid provider and multiplies cost.
    allowPaidVideoFallback: booleanEnv('ALLOW_PAID_VIDEO_FALLBACK', false),
    videoProviderPreference: (process.env.VIDEO_PROVIDER_PREFERENCE || 'pruna')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  }
};
