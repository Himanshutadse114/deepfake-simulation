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

const PROFILE_VARIANT_COUNT = 4;
const FLUX_PROFILE_RESOLUTION = '1 MP';
const FLUX_PROFILE_BATCH_SIZE = 2;

// Restored from the earlier four-post implementation, with stronger wardrobe
// diversity so every post looks like a separate real-life moment. Clothing is
// deliberately matched to each environment while identity remains consistent.
const PROFILE_VARIANT_PROMPTS = [
  [
    'Using image 1 as the identity reference, preserve the same person and distinctive facial features.',
    'Create a realistic square social-media photo of the same person in a modern office or coworking space, three-quarter left camera angle, natural expression, soft daylight and realistic smartphone photography.',
    'CLOTHING: use a smart-casual office-appropriate outfit, such as a neat shirt, blouse, subtle blazer or cardigan. The clothing must look professional and must be clearly different from the clothing in the other three generated posts.',
    'Do not reuse the same top, jacket, garment combination or overall colour palette used in any other post.',
    'Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. No text, logos, badges, documents or other people.'
  ].join(' '),
  [
    'Using image 1 as the identity reference, preserve the same person and distinctive facial features.',
    'Create a realistic square social-media photo of the same person in a bright cafe setting, three-quarter right camera angle, natural expression, warm window light and realistic smartphone photography.',
    'CLOTHING: use a relaxed everyday cafe outfit, such as comfortable knitwear, a casual top, denim layer or other laid-back casual clothing. The outfit must be visibly different from the office look and from the other generated posts.',
    'Use a different garment style and a different overall colour palette from all other posts. Do not repeat the office blazer, shirt or equivalent clothing combination.',
    'Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. No text, logos, badges, documents or other people.'
  ].join(' '),
  [
    'Using image 1 as the identity reference, preserve the same person and distinctive facial features.',
    'Create a realistic square travel-style social photo of the same person outdoors in a generic city promenade or public plaza, front-facing to slight angle, natural daylight, relaxed expression and realistic smartphone photography.',
    'CLOTHING: use an urban outdoor outfit suitable for going out in the city, such as a light jacket, overshirt, casual streetwear layer or smart-casual outdoor combination. The outfit must clearly differ from both the office and cafe looks.',
    'Use a visibly different silhouette, outer layer and overall colour feel from the other three posts. Do not repeat the same top or jacket used elsewhere.',
    'Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. Do not depict a specific landmark. No text, logos, documents or other people.'
  ].join(' '),
  [
    'Using image 1 as the identity reference, preserve the same person and distinctive facial features.',
    'Create a realistic square smartphone selfie of the same person in a green park or neutral outdoor setting. The camera should feel naturally handheld at arm length, with a close head-and-shoulders composition only, showing the face, neck and shoulders and at most the very top of the upper chest.',
    'Do NOT create a full-body, half-body, waist-up or wide portrait. Do not show the person below the upper chest. Keep the face clearly visible and recognisable, with a natural selfie angle, relaxed expression and soft late-afternoon outdoor light.',
    'CLOTHING: use a relaxed weekend or park top or light outdoor layer appropriate for the setting. The visible clothing around the shoulders and neckline must be clearly different from the office, cafe and city outfits, with a distinct garment style and colour palette.',
    'Keep identity, approximate age, skin tone, hairstyle and facial structure consistent. Make it look like a believable personal Instagram selfie, not a studio portrait or fashion shoot. No text, logos, badges, documents or other people.'
  ].join(' ')
];

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
  // Keep the provider reference in the 1 MP billing tier while preserving the
  // original portrait separately for the video provider.
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

async function saveOutput(output, targetPath, label = 'FLUX profile image') {
  const url = outputUrl(output);
  if (!url) throw new Error('FLUX did not return an image URL.');
  return downloadWithRetry(url, targetPath, { label, timeoutMs: 90_000 });
}

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

async function runVariantBatches(count, batchSize, runVariant) {
  const results = new Array(count);
  const size = Math.max(1, Math.trunc(batchSize) || 1);
  for (let start = 0; start < count; start += size) {
    const indexes = Array.from({ length: Math.min(size, count - start) }, (_, offset) => start + offset);
    const batch = await Promise.all(indexes.map(async (index) => ({
      index,
      value: await runVariant(index)
    })));
    batch.forEach(({ index, value }) => { results[index] = value; });
  }
  return results;
}

async function generateIdentityVariants(faceFile, sessionId, options = {}) {
  if (!config.providers.fluxEnabled) return { variants: [], predictionIds: [], providerOutputUrls: [] };
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  const directory = options.workspace || path.join(config.workRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const sourcePath = path.join(directory, 'flux-source-image');
  const referencePath = path.join(directory, 'flux-reference.jpg');
  let temporaryProviderRef = null;
  let providerReferenceUri = null;
  let providerReferencePromise = null;

  const ensureProviderReference = async () => {
    if (providerReferenceUri) return providerReferenceUri;
    if (!providerReferencePromise) {
      providerReferencePromise = (async () => {
        await materialize(faceFile.path, sourcePath);
        await createFluxReference(sourcePath, referencePath);
        temporaryProviderRef = await persistTemporaryProviderFile(
          sessionId,
          'flux-reference.jpg',
          referencePath,
          'image/jpeg'
        );
        providerReferenceUri = await toProviderUri(temporaryProviderRef, 'image/jpeg');
        return providerReferenceUri;
      })();
    }
    return providerReferencePromise;
  };

  try {
    // Keep each paid prediction independent and resumable, but run only two at
    // a time. This reduces the critical path without opening four simultaneous
    // FLUX predictions from one simulation.
    const generated = await runVariantBatches(
      PROFILE_VARIANT_COUNT,
      FLUX_PROFILE_BATCH_SIZE,
      async (index) => {
        const callbacks = typeof options.itemCallbacks === 'function'
          ? options.itemCallbacks(index)
          : {};
        let input;

        if (!callbacks.predictionId) {
          input = {
            prompt: PROFILE_VARIANT_PROMPTS[index],
            input_images: [await ensureProviderReference()],
            resolution: FLUX_PROFILE_RESOLUTION,
            aspect_ratio: '1:1',
            output_format: 'jpg',
            output_quality: 85,
            safety_tolerance: 2,
            prompt_upsampling: false
          };
          await callbacks.onBeforePredictionCreate?.();
        }

        const result = await runOfficialPrediction({
          model: config.providers.fluxModel,
          input,
          predictionId: callbacks.predictionId,
          label: `FLUX profile image ${index + 1}`,
          cancelAfter: '5m',
          onPredictionCreated: callbacks.onPredictionCreated,
          onRateLimit: options.onRateLimit
        });

        const url = outputUrl(result.output);
        if (!url) throw new Error(`FLUX profile image ${index + 1} did not return an image URL.`);
        await callbacks.onProviderOutput?.({ predictionId: result.prediction.id, url, index });

        const target = path.join(directory, `variant-${index + 1}.jpg`);
        await saveOutput(result.output, target, `FLUX profile image ${index + 1}`);
        return { target, predictionId: result.prediction.id, url };
      }
    );

    const variants = generated.map((item) => item.target);
    const predictionIds = generated.map((item) => item.predictionId);
    const providerOutputUrls = generated.map((item) => item.url);

    console.log(`Generated ${variants.length} independent FLUX 1 MP profile images for session ${sessionId.slice(0, 8)} in batches of ${FLUX_PROFILE_BATCH_SIZE}.`);
    return { variants, predictionIds, providerOutputUrls };
  } finally {
    await Promise.allSettled([
      fs.rm(sourcePath, { force: true }),
      fs.rm(referencePath, { force: true }),
      temporaryProviderRef ? deleteRef(temporaryProviderRef) : Promise.resolve()
    ]);
  }
}

module.exports = {
  generateIdentityVariants,
  collectVariantResults,
  runVariantBatches,
  createFluxReference,
  saveOutput,
  outputUrl,
  PROFILE_VARIANT_COUNT,
  FLUX_PROFILE_RESOLUTION,
  FLUX_PROFILE_BATCH_SIZE,
  PROFILE_VARIANT_PROMPTS
};
