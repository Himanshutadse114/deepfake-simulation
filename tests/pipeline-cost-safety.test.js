const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCheckedAudioTracks } = require('../server/pipeline');

test('keeps WhatsApp at twelve seconds but blocks video audio above the ten-second Pruna cap', async () => {
  const session = {
    scripts: {
      whatsapp: 'Administrator WhatsApp script',
      video: 'Administrator video script'
    },
    provider: {},
    stages: {}
  };
  const generated = [];
  const checked = [];
  let prunaCalls = 0;

  await assert.rejects(async () => {
    await generateCheckedAudioTracks(session, {
      whatsappPath: 'whatsapp.wav',
      videoSpeechPath: 'video.wav'
    }, {
      generateVoice: async (_session, outputPath, script) => generated.push([outputPath, script]),
      assertAudioDuration: async (outputPath, options) => {
        checked.push([outputPath, options.maxSeconds]);
        if (outputPath === 'video.wav') throw new Error('Generated video audio exceeds 10 seconds');
      }
    });

    // This represents the next pipeline step and must remain unreachable.
    prunaCalls += 1;
  }, /exceeds 10 seconds/);

  assert.deepEqual(generated, [
    ['whatsapp.wav', 'Administrator WhatsApp script'],
    ['video.wav', 'Administrator video script']
  ]);
  assert.deepEqual(checked, [
    ['whatsapp.wav', 12],
    ['video.wav', 10]
  ]);
  assert.equal(prunaCalls, 0);
  assert.equal(session.whatsappAudioOutput, 'whatsapp.wav');
  assert.equal(session.videoAudioOutput, undefined);
});
