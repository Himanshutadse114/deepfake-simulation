require('dotenv').config();

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const config = require('./config');
const simulationRoutes = require('./routes');
const { router: adminRouter, renderAdminPage } = require('./admin');
const { router: authRouter, requireProjectAuth, isAuthConfigured } = require('./auth');
const { renderDemoPage } = require('./demo');
const { startExpiryCleanup } = require('./store');
const { redisConfigured, closeRedisClient } = require('./redis-client');
const { objectStorageConfigured } = require('./storage');
const { getQueueStats, closeQueue, recoverDurableLocalQueue } = require('./queue');
const { mediaProcessStats } = require('./services/process-limit');

const app = express();
let startupRecoveryState = { attempted: false, ok: null, error: null };

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'", 'blob:', "'wasm-unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      workerSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com']
    }
  }
}));

const allowedOrigin = process.env.CORS_ORIGIN?.trim();
if (allowedOrigin) {
  app.use(cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'x-simulation-token', 'x-admin-key', 'x-innvikta-launch-token']
  }));
}

app.use(express.json({ limit: '1mb' }));

const createLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 250),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many simulation sessions were created from this network. Please try again later.' }
});

app.use('/api/simulation/session', createLimiter);

// Keep the health endpoint public so Render can continue checking the service.
// Every learner/admin/demo route below this point is protected by the private
// Innvikta username/password login.
app.get('/api/health', async (_req, res) => {
  const heygenConfigured = config.providers.heygenEnabled && Boolean(config.providers.heygenAccessToken || config.providers.heygenApiKey);
  const didConfigured = config.providers.didEnabled && Boolean(config.providers.didKey);
  const replicateConfigured = Boolean(config.providers.replicateToken);
  const redisReady = redisConfigured();
  const storageReady = objectStorageConfigured();
  const recoveryHealthy = startupRecoveryState.ok !== false;
  const queue = await getQueueStats().catch((error) => ({ mode: redisReady ? 'unavailable' : 'bounded-local', error: error.message }));

  res.json({
    ok: true,
    service: 'deepfake-awareness-simulation',
    authentication: {
      required: true,
      configured: isAuthConfigured(),
      usernamePasswordRequired: true,
      googleRequired: false
    },
    demoMode: config.demoMode,
    sessionDemoMode: true,
    demoInstancePath: '/demo',
    customAwarenessScripts: true,
    productionReadiness: {
      singleServiceMode: !redisReady,
      durableR2State: !redisReady && storageReady && recoveryHealthy,
      storageRecovery: startupRecoveryState,
      replicateConfigured,
      readyForSingleServiceAi: !redisReady && storageReady && recoveryHealthy && replicateConfigured,
      distributedQueue: redisReady,
      privateObjectStorage: storageReady,
      signedLaunchRequired: config.requireLaunchToken,
      signedLaunchConfigured: Boolean(config.launchTokenSecret),
      readyForMultiInstanceAi: redisReady && storageReady && recoveryHealthy && replicateConfigured
    },
    concurrency: {
      worker: config.aiWorkerConcurrency,
      mediaProcesses: config.ffmpegConcurrency,
      maxQueuedJobs: config.maxQueuedJobs,
      queue
    },
    costGuard: {
      dailyBudgetUsd: config.dailyAiBudgetUsd,
      estimatedReservationPerSimulationUsd: config.estimatedSimulationCostUsd,
      paidVideoFallbackEnabled: false
    },
    mediaProcesses: mediaProcessStats(),
    audioTracks: ['whatsapp', 'video'],
    durationLimits: {
      whatsappAudioSeconds: config.maxGeneratedAudioSeconds,
      videoAudioSeconds: config.maxVideoSeconds,
      videoSeconds: config.maxVideoSeconds
    },
    scriptPolicy: {
      minChars: config.scriptPolicy.minChars,
      maxChars: config.scriptPolicy.maxChars,
      blockUrls: config.scriptPolicy.blockUrls,
      requireAwarenessContext: config.scriptPolicy.requireAwarenessContext,
      sensitiveRequestProtection: true,
      exactProviderTextAudit: true
    },
    stack: {
      voice: config.providers.voiceProvider,
      images: config.providers.fluxEnabled ? 'flux-2-pro-4x-1mp-original-prompts' : 'disabled',
      video: ['pruna']
    },
    providers: {
      replicate: replicateConfigured,
      qwen: replicateConfigured,
      chatterbox: replicateConfigured,
      elevenlabs: Boolean(config.providers.elevenLabsApiKey),
      flux: config.providers.fluxEnabled && replicateConfigured,
      did: didConfigured,
      heygen: heygenConfigured,
      pruna: replicateConfigured
    },
    qwenModel: config.providers.qwenModel,
    qwenLanguage: config.providers.qwenLanguage,
    fluxEnabled: config.providers.fluxEnabled,
    fluxProfileImages: config.providers.fluxProfileImages,
    fluxProfileResolution: config.providers.fluxProfileResolution,
    fluxGridImages: config.providers.fluxGridImages,
    instagramPostCount: 4,
    instagramGeneratedPostCount: 4,
    instagramFramings: ['office', 'cafe', 'city-promenade', 'park-lifestyle'],
    videoProviderPreference: config.providers.videoProviderPreference
  });
});

// Authentication endpoints must remain reachable before the project guard.
app.use('/auth', authRouter);
app.use(requireProjectAuth);

app.use('/api/admin', adminRouter);
app.get('/admin', (_req, res) => res.type('html').send(renderAdminPage()));
app.get('/demo', (_req, res) => res.type('html').send(renderDemoPage()));
app.use('/api/simulation', simulationRoutes);

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', etag: true }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path === '/admin' || req.path === '/demo') return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded media exceeds the configured size limit.' : error.message });
  }
  const status = Number(error.status || 500);
  if (status >= 500) console.error('[simulation-error]', error.stack || error.message);
  else console.warn('[simulation-request]', error.message);
  res.status(status).json({ error: error.message || 'Unexpected server error.', code: error.code });
});

async function start() {
  await Promise.all([
    fsp.mkdir(config.uploadRoot, { recursive: true }),
    fsp.mkdir(config.stagingRoot, { recursive: true }),
    fsp.mkdir(config.workRoot, { recursive: true })
  ]);

  startupRecoveryState = { attempted: true, ok: null, error: null };
  try {
    const recovery = await recoverDurableLocalQueue();
    startupRecoveryState = { attempted: true, ok: true, error: null, ...recovery };
    console.log(`[startup-recovery] mode=${recovery.mode} sessions=${recovery.recoveredSessions} requeued=${recovery.requeued} blocked=${recovery.blocked} expired=${recovery.expired}`);
  } catch (error) {
    startupRecoveryState = { attempted: true, ok: false, error: error.message };
    console.error(`[startup-recovery] R2 recovery failed: ${error.stack || error.message}`);
  }

  startExpiryCleanup();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Deepfake awareness simulation listening on port ${config.port}${config.demoMode ? ' (GLOBAL DEMO_MODE)' : ''}`);
  });

  const shutdown = async (signal) => {
    console.log(`Web service received ${signal}; stopping new HTTP work. Durable queue/session checkpoints are already stored in R2.`);
    server.close();
    await closeQueue().catch(() => {});
    await closeRedisClient().catch(() => {});
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
