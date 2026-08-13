const config = require('../config');

async function generateFixedAwarenessVideo() {
  if (!config.providers.heygenEnabled) throw new Error('HeyGen adapter is disabled in this build.');
  throw new Error('HeyGen adapter requires final account-specific OAuth/API wiring before it can be enabled.');
}

module.exports = { generateFixedAwarenessVideo };
