const { spawn } = require('node:child_process');
const { withMediaProcessSlot } = require('./process-limit');

function runMediaProcess(command, args, {
  label = command,
  timeoutMs = 120_000,
  stderrLimit = 16_000,
  windowsHide = true
} = {}) {
  return withMediaProcessSlot(() => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide
    });
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve({ stderr });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, Math.max(1000, Number(timeoutMs || 120_000)));
    timer.unref?.();

    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-stderrLimit);
    });
    child.on('error', (error) => finish(new Error(`${label} failed to start: ${error.message}`)));
    child.on('close', (code) => {
      if (timedOut) return finish(new Error(`${label} timed out after ${Math.ceil(timeoutMs / 1000)} seconds.`));
      if (code === 0) return finish();
      const detail = stderr.trim();
      return finish(new Error(`${label} failed${detail ? `: ${detail}` : ` with exit code ${code}`}`));
    });
  }));
}

module.exports = { runMediaProcess };
