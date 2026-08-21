const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCheckedAudioTracks } = require('../server/pipeline');

test('does not continue to Pruna when either generated audio exceeds twelve seconds', async () => {
  const session = {
    scripts: {
      whatsapp: 'Administrator WhatsApp script',
      video: 'Administrator video script'
    }
  };
  const generated = [];
  let prunaCalls = 0;

  await assert.rejects(async () => {
    await generateCheckedAudioTracks(session, {
      whatsappPath: 'whatsapp.wav',
      videoSpeechPath: 'video.wav'
    }, {
      generateVoice: async (_session, outputPath, script) => generated.push([outputPath, script]),
      assertAudioDuration: async (outputPath, options) => {
        assert.equal(options.maxSeconds, 12);
        if (outputPath === 'video.wav') throw new Error('Generated video audio exceeds 12 seconds');
      }
    });

    // This represents the next pipeline step and must remain unreachable.
    prunaCalls += 1;
  }, /exceeds 12 seconds/);

  assert.deepEqual(generated, [
    ['whatsapp.wav', 'Administrator WhatsApp script'],
    ['video.wav', 'Administrator video script']
  ]);
  assert.equal(prunaCalls, 0);
  assert.equal(session.whatsappAudioOutput, 'whatsapp.wav');
  assert.equal(session.videoAudioOutput, undefined);
});
