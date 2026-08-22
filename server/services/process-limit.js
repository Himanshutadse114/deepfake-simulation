const config = require('../config');

let active = 0;
const waiters = [];

function release() {
  const next = waiters.shift();
  if (next) {
    // Transfer this exact occupied slot to the oldest waiter. Keep `active`
    // unchanged so a newly arriving task cannot steal the slot between the
    // release and the queued waiter's microtask resuming.
    next();
    return;
  }
  active = Math.max(0, active - 1);
}

async function acquire() {
  const limit = Math.max(1, Number(config.ffmpegConcurrency || 2));
  if (active < limit) {
    active += 1;
    return release;
  }

  // The releaser transfers an already-counted active slot to us, so do not
  // increment `active` again after waking.
  await new Promise((resolve) => waiters.push(resolve));
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
