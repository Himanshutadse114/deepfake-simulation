const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCheckedAudioTracks } = require('../server/pipeline');

test('creates both complete admin-script audio tracks without duration or transcription checks', async () => {
  const session = {
    voice: {
      path: 'uploaded.webm',
      mime: 'audio/webm',
      referenceText: 'Optional recording prompt.'
    },
    scripts: {
      whatsapp: 'Administrator WhatsApp script with its complete intended wording.',
      video: 'Administrator video script with its complete intended wording.'
    }
  };
  const generated = [];

  await generateCheckedAudioTracks(session, {
    whatsappPath: 'whatsapp.wav',
    videoSpeechPath: 'video.wav'
  }, {
    generateVoice: async (receivedSession, outputPath, script, stage) => {
      assert.equal(receivedSession.voice.path, 'uploaded.webm');
      assert.equal(receivedSession.voice.mime, 'audio/webm');
      generated.push({ outputPath, script, stage });
    }
  });

  assert.deepEqual(generated, [
    {
      outputPath: 'whatsapp.wav',
      script: session.scripts.whatsapp,
      stage: 'cloning_whatsapp'
    },
    {
      outputPath: 'video.wav',
      script: session.scripts.video,
      stage: 'cloning_video'
    }
  ]);
  assert.equal(session.whatsappAudioOutput, 'whatsapp.wav');
  assert.equal(session.videoAudioOutput, 'video.wav');
});
