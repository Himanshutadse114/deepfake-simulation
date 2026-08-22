const express = require('express');
const crypto = require('node:crypto');
const config = require('./config');
const { getActiveScripts, saveActiveScripts } = require('./admin-settings');
const { objectStorageConfigured, putJson, getJson, deleteKey } = require('./storage');

const router = express.Router();

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function requireAdmin(req, res, next) {
  if (!config.adminKey) {
    return res.status(503).json({ error: 'ADMIN_KEY is not configured on this service.' });
  }
  if (!safeEqual(req.get('x-admin-key'), config.adminKey)) {
    return res.status(401).json({ error: 'Invalid admin key.' });
  }
  next();
}

router.get('/scripts', requireAdmin, async (_req, res, next) => {
  try {
    res.json({
      ...(await getActiveScripts()),
      policy: {
        minChars: config.scriptPolicy.minChars,
        maxChars: config.scriptPolicy.maxChars,
        blockUrls: config.scriptPolicy.blockUrls,
        requireAwarenessContext: config.scriptPolicy.requireAwarenessContext
      }
    });
  } catch (error) { next(error); }
});

router.put('/scripts', requireAdmin, async (req, res, next) => {
  try {
    const saved = await saveActiveScripts(req.body || {});
    res.json({ ok: true, ...saved });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/storage-test', requireAdmin, async (_req, res) => {
  if (!objectStorageConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Cloudflare R2/S3 storage is not fully configured. Check S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.'
    });
  }

  const startedAt = Date.now();
  const nonce = crypto.randomUUID();
  const key = `control/healthchecks/${Date.now()}-${nonce}.json`;
  const probe = {
    nonce,
    service: 'innvikta-deepfake-awareness',
    createdAt: new Date().toISOString()
  };

  try {
    await putJson(key, probe);
    const readBack = await getJson(key);
    if (!readBack || readBack.nonce !== nonce) {
      throw new Error('R2 write succeeded but the verification read did not match the test object.');
    }

    await deleteKey(key);
    const afterDelete = await getJson(key);
    if (afterDelete !== null) {
      throw new Error('R2 write/read succeeded, but the test object could not be deleted. Check delete permission for this bucket.');
    }

    return res.json({
      ok: true,
      connected: true,
      bucket: config.storage.bucket,
      region: config.storage.region || 'auto',
      latencyMs: Date.now() - startedAt,
      checks: ['write', 'read', 'delete', 'delete-verified']
    });
  } catch (error) {
    await deleteKey(key).catch(() => {});
    console.warn(`[storage-test] ${error.stack || error.message}`);
    return res.status(502).json({
      ok: false,
      connected: false,
      bucket: config.storage.bucket || null,
      error: `R2 connection test failed: ${error.message}`
    });
  }
});

function renderAdminPage() {
  const max = config.scriptPolicy.maxChars;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Simulation Script Admin</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#f7f8fb;background:#070a10}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 0,rgba(241,90,36,.14),transparent 28%),#070a10}.wrap{width:min(820px,calc(100% - 32px));margin:48px auto}.top{margin-bottom:22px}.kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ff9d55;font-weight:700}.top h1{font-size:clamp(30px,5vw,48px);margin:8px 0 10px}.muted{color:#9aa4b5;line-height:1.55}.card{background:#111722;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.3)}label{display:block;font-size:13px;font-weight:700;margin:15px 0 7px}input,textarea{width:100%;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#0b1018;color:#fff;padding:12px 14px;outline:none}input:focus,textarea:focus{border-color:#f15a24;box-shadow:0 0 0 3px rgba(241,90,36,.14)}textarea{min-height:118px;resize:vertical;line-height:1.5}.row{display:flex;justify-content:space-between;gap:12px;align-items:center}.count{font-size:11px;color:#7f8a9d}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.btn{border:0;border-radius:9px;padding:11px 16px;font-weight:800;cursor:pointer}.btn:disabled{opacity:.55;cursor:wait}.primary{background:linear-gradient(135deg,#f15a24,#ff6b1a);color:#fff}.secondary{background:#1a2230;color:#fff;border:1px solid rgba(255,255,255,.1)}.storage{margin-top:18px;padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:#0b1018}.storage-title{font-size:13px;font-weight:750;margin-bottom:5px}.storage-copy{font-size:12px;color:#8e9aae;line-height:1.45}.note{margin-top:14px;padding:12px 14px;border-radius:10px;background:#0d1521;border:1px solid rgba(106,168,255,.18);color:#b9c6d8;font-size:12px;line-height:1.5}.status{margin-top:14px;min-height:20px;font-size:12px;color:#aeb8c8}.status.ok{color:#75e0a7}.status.err{color:#ff818a}@media(max-width:640px){.wrap{margin:24px auto}.card{padding:16px}}
</style>
<script src="/admin-ui.js" defer></script>
</head>
<body>
<main class="wrap">
  <div class="top"><div class="kicker">Internal configuration</div><h1>Simulation script admin</h1><p class="muted">Set the two approved awareness scripts and verify the private R2 storage used by the one-service production architecture.</p></div>
  <section class="card">
    <label for="adminKey">Admin key</label>
    <input id="adminKey" type="password" autocomplete="current-password" placeholder="Enter ADMIN_KEY">

    <div class="row"><label for="whatsappScript">WhatsApp audio script</label><span class="count"><b id="whatsappCount">0</b>/${max}</span></div>
    <textarea id="whatsappScript" maxlength="${max}" placeholder="WhatsApp voice-note script"></textarea>

    <div class="row"><label for="videoScript">Deepfake video audio script</label><span class="count"><b id="videoCount">0</b>/${max}</span></div>
    <textarea id="videoScript" maxlength="${max}" placeholder="Deepfake video script"></textarea>

    <div class="actions"><button class="btn secondary" id="loadScripts" type="button">Load current</button><button class="btn primary" id="saveScripts" type="button">Save scripts</button></div>

    <div class="storage">
      <div class="storage-title">Private storage</div>
      <div class="storage-copy">Runs a real write → read → delete → verify-deleted probe against the configured Cloudflare R2 bucket. No credentials are sent to the browser.</div>
      <div class="actions"><button class="btn secondary" id="testStorage" type="button">Test R2 connection</button></div>
      <div class="status" id="storageStatus"></div>
    </div>

    <div class="note">Keep WhatsApp speech within 12 seconds and video speech within 10 seconds. Sensitive payment and credential requests remain blocked by the core simulation safeguard.</div>
    <div class="status" id="adminStatus"></div>
  </section>
</main>
</body>
</html>`;
}

module.exports = { router, renderAdminPage };
