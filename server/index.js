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
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

const allowedOrigin = process.env.CORS_ORIGIN?.trim();
if (allowedOrigin) app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['content-type', 'x-simulation-token'] }));

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
  res.json({
    ok: true,
    service: 'deepfake-awareness-simulation',
    demoMode: config.demoMode,
    providers: {
      gemini: Boolean(config.providers.geminiKey),
      elevenLabs: Boolean(config.providers.elevenLabsKey),
      did: Boolean(config.providers.didKey)
    }
  });
});

app.use('/api/simulation', simulationRoutes);

if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', etag: true }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
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
    console.log(`Deepfake awareness simulation listening on port ${config.port}${config.demoMode ? ' (DEMO_MODE)' : ''}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
