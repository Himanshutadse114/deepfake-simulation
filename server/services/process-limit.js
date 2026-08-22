const config = require('../config');

let active = 0;
const waiters = [];

function release() {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
}

async function acquire() {
  const limit = Math.max(1, Number(config.ffmpegConcurrency || 2));
  if (active < limit) {
    active += 1;
    return release;
  }

  await new Promise((resolve) => waiters.push(resolve));
  active += 1;
  return release;
}

async function withMediaProcessSlot(task) {
  const done = await acquire();
  try {
    return await task();
  } finally {
    done();
  }
}

function mediaProcessStats() {
  return {
    active,
    waiting: waiters.length,
    limit: Math.max(1, Number(config.ffmpegConcurrency || 2))
  };
}

module.exports = { withMediaProcessSlot, mediaProcessStats };
