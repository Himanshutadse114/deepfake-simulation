const test = require('node:test');
const assert = require('node:assert/strict');
const { runMediaProcess } = require('../server/services/media-process');

test('media subprocesses are bounded by a hard timeout and release their slot', async () => {
  await assert.rejects(
    runMediaProcess(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      { label: 'Hung media process', timeoutMs: 75 }
    ),
    /timed out/i
  );

  const result = await runMediaProcess(
    process.execPath,
    ['-e', "process.stderr.write('completed')"],
    { label: 'Follow-up media process', timeoutMs: 2000 }
  );
  assert.equal(result.stderr, 'completed');
});
