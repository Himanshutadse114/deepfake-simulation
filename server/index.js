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
const { startExpiryCleanup } = require('./store');

const app = express();
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
      scriptSrc: ["'self'", 'blob:'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com']
    }
  }
}));

const allowedOrigin = process.env.CORS_ORIGIN?.trim();
if (allowedOrigin) app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['content-type', 'x-simulation-token', 'x-admin-key'] }));

app.use(express.json({ limit: '1mb' }));

const createLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 60) * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 3),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many simulation sessions were created from this network. Please try again later.' }
});

app.use('/api/simulation/session', createLimiter);

app.get('/api/health', (_req, res) => {
  const heygenConfigured = config.providers.heygenEnabled && Boolean(config.providers.heygenAccessToken || config.providers.heygenApiKey);
  const didConfigured = config.providers.didEnabled && Boolean(config.providers.didKey);
  const replicateConfigured = Boolean(config.providers.replicateToken);

  res.json({
    ok: true,
    service: 'deepfake-awareness-simulation',
    demoMode: config.demoMode,
    sessionDemoMode: true,
    customAwarenessScripts: true,
    audioTracks: ['whatsapp', 'video'],
    scriptPolicy: {
      minChars: config.scriptPolicy.minChars,
      maxChars: config.scriptPolicy.maxChars,
      blockUrls: config.scriptPolicy.blockUrls,
      requireAwarenessContext: config.scriptPolicy.requireAwarenessContext,
      sensitiveRequestProtection: true
    },
    stack: {
      voice: config.providers.voiceProvider,
      images: config.providers.fluxEnabled ? 'flux-2-pro' : 'disabled',
      video: config.providers.videoProviderPreference
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
    fluxGridImages: config.providers.fluxGridImages,
    videoProviderPreference: config.providers.videoProviderPreference
  });
});

app.use('/api/admin', adminRouter);
app.get('/admin', (_req, res) => res.type('html').send(renderAdminPage()));
app.use('/api/simulation', simulationRoutes);

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', etag: true }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path === '/admin') return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded media exceeds the configured size limit.' : error.message });
  }
  console.error('[simulation-error]', error.message);
  res.status(500).json({ error: error.message || 'Unexpected server error.' });
});

async function start() {
  await fsp.mkdir(config.uploadRoot, { recursive: true });
  startExpiryCleanup();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Deepfake awareness simulation listening on port ${config.port}${config.demoMode ? ' (GLOBAL DEMO_MODE)' : ''}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
