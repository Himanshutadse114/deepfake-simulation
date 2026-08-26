const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../server/config');
const {
  PROFILE_VARIANT_COUNT,
  FLUX_PROFILE_RESOLUTION,
  FLUX_PROFILE_BATCH_SIZE,
  PROFILE_VARIANT_PROMPTS,
  collectVariantResults,
  runVariantBatches
} = require('../server/services/flux');
const {
  runInitialGeneration,
  generateCheckedAudioTracks
} = require('../server/pipeline');

test('starts paid video and profile work together after audio validation', async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  const running = runInitialGeneration(
    async () => { started.push('video'); await gate; },
    async () => { started.push('profile'); await gate; }
  );

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started.sort(), ['profile', 'video']);
  release();
  await running;
});

test('WhatsApp and video Qwen tracks start in parallel', async () => {
  const started = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const session = {
    scripts: { whatsapp: 'whatsapp script', video: 'video script' },
    stages: {},
    provider: {},
    variants: []
  };

  const running = generateCheckedAudioTracks(
    session,
    { whatsappPath: '/tmp/wa.wav', videoSpeechPath: '/tmp/video.wav' },
    {
      generateVoice: async (_session, _path, _text, _status, stageKey) => {
        started.push(stageKey);
        await gate;
      },
      assertAudioDuration: async () => 1
    }
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started.sort(), ['videoAudio', 'whatsappAudio']);
  release();
  await running;
  assert.equal(session.stages.whatsappAudio.status, 'completed');
  assert.equal(session.stages.videoAudio.status, 'completed');
});

test('profile generation is exactly four 1 MP social photos using the original prompt set', () => {
  assert.equal(PROFILE_VARIANT_COUNT, 4);
  assert.equal(config.providers.fluxProfileImages, 4);
  assert.equal(config.providers.fluxGridImages, 4);
  assert.equal(FLUX_PROFILE_RESOLUTION, '1 MP');
  assert.equal(FLUX_PROFILE_BATCH_SIZE, 2);
  assert.equal(PROFILE_VARIANT_PROMPTS.length, 4);
  assert.match(PROFILE_VARIANT_PROMPTS[0], /office|coworking/i);
  assert.match(PROFILE_VARIANT_PROMPTS[1], /cafe/i);
  assert.match(PROFILE_VARIANT_PROMPTS[2], /city promenade|public plaza/i);
  assert.match(PROFILE_VARIANT_PROMPTS[3], /green park|outdoor setting/i);
});

test('FLUX helper never runs more than two profile predictions at once and keeps output order', async () => {
  let active = 0;
  let maxActive = 0;
  const output = await runVariantBatches(4, 2, async (index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return `variant-${index + 1}`;
  });

  assert.equal(maxActive, 2);
  assert.deepEqual(output, ['variant-1', 'variant-2', 'variant-3', 'variant-4']);
});

test('legacy result collector remains tolerant of partial helper failures', async () => {
  const failures = [];
  const results = await collectVariantResults(4, async (index) => {
    if (index !== 1) throw new Error(`image ${index + 1} interrupted`);
    return 'variant-2.jpg';
  }, ({ index }) => failures.push(index));

  assert.deepEqual(results, ['variant-2.jpg']);
  assert.deepEqual(failures, [0, 2, 3]);
});
