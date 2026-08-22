const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require('../config');
const {
  materialize,
  persistTemporaryProviderFile,
  toProviderUri,
  deleteRef
} = require('../storage');
const { downloadWithRetry } = require('./download');
const { withMediaProcessSlot } = require('./process-limit');
const { runOfficialPrediction } = require('./replicate-prediction');

const GRID_PROMPT = [
  'Using image 1 only as the identity reference, create ONE photorealistic square 2x2 contact sheet containing exactly four equal square photographs of the SAME single person.',
  'Identity consistency is the highest priority: preserve the same distinctive facial features, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance in every panel.',
  'IMPORTANT POSE DIVERSITY: do not copy or repeat the head pose from the reference image across the grid. The four panels must have clearly different head orientations and camera viewpoints while still looking like the exact same person.',
  'Avoid four similar side profiles. At least one panel must show the face nearly straight-on, one must show a natural three-quarter-left view, one must show a natural three-quarter-right view, and one must use a slightly elevated or arm-length selfie viewpoint with the face turned only slightly. Keep both eyes reasonably visible in at least three panels; avoid extreme profile views.',
  'Each panel must contain exactly one person, framed as a believable social-media photo. Do not create extra people, duplicate faces inside a panel, text, captions, labels, logos, watermarks, documents, badges or props that imply credentials or money.',
  'Use a clean edge-to-edge 2x2 layout with four equal panels, aligned precisely in two rows and two columns. No gutters, no borders, no rounded cards, no separators, no decorative frame and no overlap between panels.',
  'TOP LEFT: modern office or coworking space, NEARLY FRONT-FACING head and shoulders, eyes toward the camera, natural expression, soft daylight, casual-professional clothing, realistic smartphone photography.',
  'TOP RIGHT: bright cafe, clear THREE-QUARTER RIGHT head turn, eyes naturally toward or just past the camera, warm window light, everyday clothing, realistic smartphone photography.',
  'BOTTOM LEFT: generic city promenade or public plaza, clear THREE-QUARTER LEFT head turn, natural daylight, relaxed expression, realistic smartphone photography, no recognisable landmark.',
  'BOTTOM RIGHT: green park or neutral outdoor setting, ARM-LENGTH SELFIE or slightly elevated camera angle, face only slightly turned, both eyes visible, slightly wider waist-up framing, soft late-afternoon light, natural expression, realistic smartphone photography.',
  'Vary head direction, camera height, crop, shoulder orientation and expression subtly between all four photographs. Do not mirror or duplicate the same pose. Make all four photographs independently believable while clearly depicting the exact same person.',
  'Keep skin texture realistic and avoid beauty-filter, plastic-skin, illustration, collage-art or poster styling.'
].join(' ');

function runFfmpeg(args, label) {
  return withMediaProcessSlot(() => new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      windowsHide: true
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => reject(new Error(`${label} failed to start: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${label} failed${stderr ? `: ${stderr.trim()}` : ` with exit code ${code}`}`));
    });
  }));
}

async function createFluxReference(sourcePath, targetPath) {
  // FLUX pricing is driven by image megapixels, not JPEG byte size. Keep the
  // original portrait for video generation and create a dedicated <=1024px
  // reference copy only for the one FLUX profile-grid prediction.
  await runFfmpeg([
    '-i', sourcePath,
    '-vf', 'scale=min(1024\\,iw):min(1024\\,ih):force_original_aspect_ratio=decrease',
    '-frames:v', '1',
    '-q:v', '3',
    targetPath
  ], 'FLUX reference resize');
  return targetPath;
}

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (typeof output?.url === 'string') return output.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

async function saveOutput(output, targetPath) {
  const url = outputUrl(output);
  if (!url) throw new Error('FLUX did not return an image URL.');
  return downloadWithRetry(url, targetPath, { label: 'FLUX profile grid', timeoutMs: 90_000 });
}

async function splitGrid(sheetPath, directory) {
  const targets = [1, 2, 3, 4].map((number) => path.join(directory, `variant-${number}.jpg`));
  const filter = [
    '[0:v]split=4[a][b][c][d]',
    '[a]crop=iw/2:ih/2:0:0[v1]',
    '[b]crop=iw/2:ih/2:iw/2:0[v2]',
    '[c]crop=iw/2:ih/2:0:ih/2[v3]',
    '[d]crop=iw/2:ih/2:iw/2:ih/2[v4]'
  ].join(';');

  await runFfmpeg([
    '-i', sheetPath,
    '-filter_complex', filter,
    '-map', '[v1]', '-frames:v', '1', '-q:v', '2', targets[0],
    '-map', '[v2]', '-frames:v', '1', '-q:v', '2', targets[1],
    '-map', '[v3]', '-frames:v', '1', '-q:v', '2', targets[2],
    '-map', '[v4]', '-frames:v', '1', '-q:v', '2', targets[3]
  ], 'FLUX 2x2 grid split');

  return targets;
}

// Kept exported for backwards-compatible tests/helpers even though production
// uses one paid FLUX prediction instead of four independent predictions.
async function collectVariantResults(count, runVariant, onFailure = () => {}) {
  const results = [];
  for (let index = 0; index < count; index += 1) {
    try {
      results.push(await runVariant(index));
    } catch (error) {
      onFailure({ index, error });
    }
  }
  return results;
}

async function generateIdentityVariants(faceFile, sessionId, options = {}) {
  if (!config.providers.fluxEnabled) return { variants: [], predictionId: null, providerOutputUrl: null };
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  const directory = options.workspace || path.join(config.workRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const sourcePath = path.join(directory, 'flux-source-image');
  const referencePath = path.join(directory, 'flux-reference.jpg');
  const sheetPath = path.join(directory, 'flux-profile-grid.jpg');
  let temporaryProviderRef = null;

  try {
    let input;
    if (!options.predictionId) {
      await materialize(faceFile.path, sourcePath);
      await createFluxReference(sourcePath, referencePath);
      temporaryProviderRef = await persistTemporaryProviderFile(
        sessionId,
        'flux-reference.jpg',
        referencePath,
        'image/jpeg'
      );
      input = {
        prompt: GRID_PROMPT,
        input_images: [await toProviderUri(temporaryProviderRef, 'image/jpeg')],
        resolution: '2 MP',
        aspect_ratio: '1:1',
        output_format: 'jpg',
        output_quality: 90,
        safety_tolerance: 2,
        prompt_upsampling: false
      };
      await options.onBeforePredictionCreate?.();
    }

    const result = await runOfficialPrediction({
      model: config.providers.fluxModel,
      input,
      predictionId: options.predictionId,
      label: 'FLUX 2x2 profile grid',
      cancelAfter: '5m',
      onPredictionCreated: options.onPredictionCreated,
      onRateLimit: options.onRateLimit
    });

    const url = outputUrl(result.output);
    if (!url) throw new Error('FLUX did not return a profile-grid URL.');
    await options.onProviderOutput?.({ predictionId: result.prediction.id, url });
    await saveOutput(result.output, sheetPath);
    const variants = await splitGrid(sheetPath, directory);
    console.log(`Generated one FLUX 2x2 profile grid and split it into ${variants.length} images for session ${sessionId.slice(0, 8)}.`);
    return { variants, predictionId: result.prediction.id, providerOutputUrl: url };
  } finally {
    await Promise.allSettled([
      fs.rm(sourcePath, { force: true }),
      fs.rm(referencePath, { force: true }),
      fs.rm(sheetPath, { force: true }),
      temporaryProviderRef ? deleteRef(temporaryProviderRef) : Promise.resolve()
    ]);
  }
}

module.exports = {
  generateIdentityVariants,
  collectVariantResults,
  createFluxReference,
  splitGrid,
  saveOutput,
  outputUrl,
  GRID_PROMPT
};
