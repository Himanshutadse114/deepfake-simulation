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
      resolution: config.providers.prunaResolution,
      disable_safety_filter: false
    };
    await options.onBeforePredictionCreate?.();
  }

  const result = await runOfficialPrediction({
    model: config.providers.prunaModel,
    input,
    predictionId: options.predictionId,
    label: 'Pruna avatar video',
    cancelAfter: '5m',
    onPredictionCreated: options.onPredictionCreated,
    onRateLimit: options.onRateLimit
  });

  const url = outputUrl(result.output);
  if (!url) throw new Error('Pruna did not return a video URL.');
  await options.onProviderOutput?.({ predictionId: result.prediction.id, url });
  return { provider: 'pruna', url, predictionId: result.prediction.id };
}

module.exports = { generateAvatarVideo, outputUrl };
