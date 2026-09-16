const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCheckedAudioTracks } = require('../server/pipeline');

test('uses the ten-second generated-audio ceiling before Pruna', async () => {
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
        assert.equal(options.maxSeconds, 10);
        if (outputPath === 'video.wav') throw new Error('Generated video audio could not be normalised to 10 seconds');
      }
    });

    // This represents the next pipeline step and must remain unreachable when
    // local normalisation/validation itself fails.
    prunaCalls += 1;
  }, /normalised to 10 seconds/);

  assert.deepEqual(generated, [
    ['whatsapp.wav', 'Administrator WhatsApp script'],
    ['video.wav', 'Administrator video script']
  ]);
  assert.equal(prunaCalls, 0);
  assert.equal(session.whatsappAudioOutput, 'whatsapp.wav');
  assert.equal(session.videoAudioOutput, undefined);
});
