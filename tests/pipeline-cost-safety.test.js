const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCheckedAudioTracks } = require('../server/pipeline');

test('allows full scripts up to twenty seconds but blocks video audio above the Pruna cap', async () => {
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
        if (outputPath === 'video.wav') throw new Error('Generated video audio exceeds 20 seconds');
      }
    });

    // This represents the next pipeline step and must remain unreachable.
    prunaCalls += 1;
  }, /exceeds 20 seconds/);

  assert.deepEqual(generated, [
    ['whatsapp.wav', 'Administrator WhatsApp script'],
    ['video.wav', 'Administrator video script']
  ]);
  assert.deepEqual(checked, [
    ['whatsapp.wav', 20],
    ['video.wav', 20]
  ]);
  assert.equal(prunaCalls, 0);
  assert.equal(session.whatsappAudioOutput, 'whatsapp.wav');
  assert.equal(session.videoAudioOutput, undefined);
});
