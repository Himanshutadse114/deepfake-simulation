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

const PROFILE_VARIANT_COUNT = 3;
const FLUX_PROFILE_RESOLUTION = '1 MP';

const PROFILE_VARIANT_PROMPTS = [
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority. Preserve the same distinctive face, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance. Do not beautify, stylise or change the identity.',
    'FRAMING: a natural head-and-shoulders or upper-chest portrait, near-front-facing, with both eyes clearly visible and the face large enough for strong identity fidelity.',
    'SCENE: an ordinary modern office or coworking environment. Use casual-professional clothing, soft natural daylight and a relaxed everyday expression.',
    'The photograph must feel like a normal smartphone photo someone would casually post to Instagram: believable composition, realistic skin texture, normal depth of field, no perfect studio symmetry and no cinematic grading.',
    'Do not make it look like a studio portrait, glamour campaign, beauty-filter image, influencer shoot, illustration or obvious AI artwork.',
    'Include exactly one person. Keep the background generic and free of readable text, credentials, documents, money, logos or recognisable brand marks.'
  ].join(' '),
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority. Preserve the same distinctive face, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance. The face must remain recognisably the same person as image 1.',
    'FRAMING: a natural half-body photograph from approximately the waist or upper hips upward. Use a relaxed three-quarter angle, with the face turned enough toward the camera that both eyes and key facial features remain clearly visible.',
    'SCENE: a bright everyday cafe, office lounge or casual indoor setting. Use ordinary casual clothing, natural posture, realistic hands if visible and warm window light.',
    'The image should feel like an independently captured phone photo from a real personal Instagram account, not a repeated portrait. Use a slightly wider camera distance and different shoulder orientation from the first image.',
    'Avoid model poses, fashion photography, exaggerated background blur, dramatic lighting, excessive skin smoothing, distorted hands, additional people or an over-polished AI look.',
    'Keep the scene free of readable text, credentials, documents, money, logos or recognisable brand marks.'
  ].join(' '),
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority. Preserve the exact recognisable facial identity, approximate age, skin tone, hairstyle, hair colour and key facial features from image 1. Do not alter the face to fit the wider composition.',
    'FRAMING: a natural near-full-body or full-body lifestyle photograph, showing the person standing from head to at least below the knees and preferably to the feet. The person should occupy roughly 65 to 80 percent of the frame so the face remains clear, sharp and recognisable.',
    'POSE: relaxed everyday standing posture, shoulders natural, both eyes visible, no extreme profile and no fashion-model pose.',
    'SCENE: a generic park path, pedestrian area, building entrance or other ordinary outdoor public setting in natural daylight. Use believable casual clothing and realistic body proportions.',
    'The result should look like a genuine smartphone Instagram post taken by a friend: casual framing, small natural imperfections and an everyday lifestyle feeling. It must not look like an editorial, travel campaign or professional photoshoot.',
    'Avoid identity drift, face replacement, warped limbs, distorted hands, extra people, dramatic cinematic lighting, heavy retouching, readable text, logos or recognisable landmarks.'
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
  // FLUX.2 Pro bills reference images by megapixels. Keep the original portrait
  // for the video provider and create a dedicated reference bounded to 1024px
  // on both axes so every profile request stays in the 1 MP reference tier.
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

// Kept exported for backwards-compatible tests/helpers. Production creates
// three independent 1 MP photos with deliberately different social framings.
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
  if (!config.providers.fluxEnabled) return { variants: [], predictionIds: [], providerOutputUrls: [] };
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  const directory = options.workspace || path.join(config.workRoot, sessionId);
  await fs.mkdir(directory, { recursive: true });
  const sourcePath = path.join(directory, 'flux-source-image');
  const referencePath = path.join(directory, 'flux-reference.jpg');
  let temporaryProviderRef = null;
  let providerReferenceUri = null;

  const ensureProviderReference = async () => {
    if (providerReferenceUri) return providerReferenceUri;
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
  };

  try {
    const variants = [];
    const predictionIds = [];
    const providerOutputUrls = [];

    // Run sequentially to avoid burst rate limits and keep each paid creation
    // independently resumable from its durable R2 prediction checkpoint.
    for (let index = 0; index < PROFILE_VARIANT_COUNT; index += 1) {
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
          output_quality: 90,
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
      variants.push(target);
      predictionIds.push(result.prediction.id);
      providerOutputUrls.push(url);
    }

    console.log(`Generated ${variants.length} independent FLUX 1 MP profile images for session ${sessionId.slice(0, 8)}.`);
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
  createFluxReference,
  saveOutput,
  outputUrl,
  PROFILE_VARIANT_COUNT,
  FLUX_PROFILE_RESOLUTION,
  PROFILE_VARIANT_PROMPTS
};
