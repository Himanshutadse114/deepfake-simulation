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
    'POST 1 MUST BE VISUALLY DISTINCT FROM THE OTHER PROFILE POSTS.',
    'FRAMING: a close head-and-shoulders or upper-chest portrait, near-front-facing, with both eyes clearly visible and the face large in frame for maximum identity fidelity.',
    'SCENE: a modern office or coworking environment with soft daylight. Use a simple casual-professional top and a relaxed everyday expression.',
    'CAMERA FEEL: ordinary handheld smartphone portrait at eye level, slightly imperfect but believable composition, realistic skin texture and normal depth of field.',
    'Do not use a cafe, outdoor park, full-body framing, fashion pose, studio lighting, glamour styling, cinematic grading, beauty filters or obvious AI-art styling for this post.',
    'Include exactly one person. Keep the background generic and free of readable text, credentials, documents, money, logos or recognisable brand marks.'
  ].join(' '),
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority. Preserve the same distinctive face, facial proportions, approximate age, skin tone, hairstyle, hair colour, eye shape and overall appearance. The face must remain recognisably the same person as image 1.',
    'POST 2 MUST LOOK LIKE A DIFFERENT REAL-LIFE MOMENT, NOT A RECROP OR REPEAT OF POST 1.',
    'FRAMING: a natural half-body photograph from approximately the waist or upper hips upward. Use a relaxed three-quarter angle, with the face turned toward the camera so both eyes and key facial features stay clearly visible.',
    'SCENE: a bright everyday cafe or casual indoor lounge with warm window light. Use a clearly different casual outfit style from the office portrait, while keeping the person believable and natural.',
    'POSE: seated or casually standing with relaxed shoulders and natural posture; no object needs to be held. Use a wider camera distance and different camera height from the close portrait.',
    'CAMERA FEEL: spontaneous smartphone lifestyle post, normal perspective, natural skin, modest background blur and realistic indoor lighting.',
    'Do not use an office-style headshot, outdoor park scene, full-body fashion pose, influencer photoshoot, dramatic lighting, heavy retouching, distorted hands, extra people or an over-polished AI look.',
    'Keep the scene free of readable text, credentials, documents, money, logos or recognisable brand marks.'
  ].join(' '),
  [
    'Using image 1 only as the identity reference, create one photorealistic square social-media photograph of the same single person.',
    'Identity consistency is the highest priority. Preserve the exact recognisable facial identity, approximate age, skin tone, hairstyle, hair colour and key facial features from image 1. Do not alter the face to fit the wider composition.',
    'POST 3 MUST BE OBVIOUSLY DIFFERENT FROM BOTH THE CLOSE OFFICE PORTRAIT AND THE HALF-BODY CAFE POST.',
    'FRAMING: a natural near-full-body or full-body lifestyle photograph, showing the person from head to at least below the knees and preferably to the feet. The person should occupy roughly 65 to 80 percent of the frame so the face remains clear and recognisable.',
    'POSE: relaxed everyday standing posture, shoulders natural, both eyes visible, no extreme profile and no fashion-model pose.',
    'SCENE: an outdoor park path, pedestrian area or generic building entrance in natural daylight. Use a weekend-casual outfit that is visually different from the first two posts and believable body proportions.',
    'CAMERA FEEL: genuine smartphone photo taken by a friend from a few steps away, casual framing, small natural imperfections and an everyday lifestyle feeling.',
    'Do not use an indoor cafe, office headshot, close portrait crop, editorial travel campaign, cinematic lighting, heavy retouching, warped limbs, distorted hands, extra people, readable text, logos or recognisable landmarks.',
    'The face must remain the same person as the reference even at the wider framing.'
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
