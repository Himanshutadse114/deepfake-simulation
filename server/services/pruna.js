const fs = require('node:fs/promises');
const Replicate = require('replicate');
const config = require('../config');

function requireReplicate() {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');
  return new Replicate({ auth: config.providers.replicateToken, fileEncodingStrategy: 'upload' });
}

async function generateAvatarVideo(faceFile, speechPath) {
  const replicate = requireReplicate();
  const [image, audio] = await Promise.all([
    fs.readFile(faceFile.path),
    fs.readFile(speechPath)
  ]);

  const output = await replicate.run(config.providers.prunaModel, {
    input: {
      image,
      audio,
      resolution: config.providers.prunaResolution,
      disable_safety_filter: false
    }
  });

  const url = typeof output === 'string' ? output : typeof output?.url === 'function' ? output.url() : output?.url;
  if (!url) throw new Error('Pruna did not return a video URL.');
  return { provider: 'pruna', url };
}

module.exports = { generateAvatarVideo };
