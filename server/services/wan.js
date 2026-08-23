const config = require('../config');
const { toProviderUri } = require('../storage');
const { runOfficialPrediction } = require('./replicate-prediction');

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (typeof output?.url === 'string') return output.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

async function generateAvatarVideo(faceFile, speechRef, options = {}) {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  let input;
  if (!options.predictionId) {
    const [image, audio] = await Promise.all([
      toProviderUri(faceFile.path, faceFile.mime || 'image/jpeg'),
      toProviderUri(speechRef, 'audio/wav')
    ]);

    input = {
      image,
      audio,
      prompt: config.providers.wanPrompt,
      interpolate: config.providers.wanInterpolate,
      num_frames_per_chunk: config.providers.wanFramesPerChunk
    };
    await options.onBeforePredictionCreate?.();
  }

  const result = await runOfficialPrediction({
    model: config.providers.wanModel,
    input,
    predictionId: options.predictionId,
    label: 'Wan 2.2 S2V avatar video',
    cancelAfter: '10m',
    onPredictionCreated: options.onPredictionCreated,
    onRateLimit: options.onRateLimit
  });

  const url = outputUrl(result.output);
  if (!url) throw new Error('Wan 2.2 S2V did not return a video URL.');
  await options.onProviderOutput?.({ predictionId: result.prediction.id, url });
  return { provider: 'wan', url, predictionId: result.prediction.id };
}

module.exports = { generateAvatarVideo, outputUrl };
