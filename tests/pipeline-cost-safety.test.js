const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateCheckedAudioTracks,
  validateParticipantVoice
} = require('../server/pipeline');

test('passes the uploaded participant voice directly to the provider after the upload-level silence guard', async () => {
  const session = {
    voice: {
      path: 'object://sessions/test/input/voice.webm',
      mime: 'audio/webm',
      referenceText: 'Optional words shown while recording.'
    }
  };

  const result = await validateParticipantVoice(session);
  assert.deepEqual(result, {
    status: 'completed',
    method: 'direct-provider-pass-through'
  });
  assert.equal(session.voice.path, 'object://sessions/test/input/voice.webm');
  assert.equal(session.voice.mime, 'audio/webm');
});

test('creates both complete admin-script audio tracks without a duration or transcription gate', async () => {
  const session = {
    scripts: {
      whatsapp: 'Administrator WhatsApp script with its complete intended wording.',
      video: 'Administrator video script with its complete intended wording.'
    },
    provider: {},
    stages: {}
  };
  const generated = [];

  await generateCheckedAudioTracks(session, {
    whatsappPath: 'whatsapp.wav',
    videoSpeechPath: 'video.wav'
  }, {
    generateVoice: async (_session, outputPath, script, status, stageKey) => {
      generated.push({ outputPath, script, status, stageKey });
    }
  });

  assert.deepEqual(generated, [
    {
      outputPath: 'whatsapp.wav',
      script: session.scripts.whatsapp,
      status: 'cloning_whatsapp',
      stageKey: 'whatsappAudio'
    },
    {
      outputPath: 'video.wav',
      script: session.scripts.video,
      status: 'cloning_video',
      stageKey: 'videoAudio'
    }
  ]);
  assert.equal(session.whatsappAudioOutput, 'whatsapp.wav');
  assert.equal(session.videoAudioOutput, 'video.wav');
  assert.equal(session.stages.whatsappAudio.status, 'completed');
  assert.equal(session.stages.videoAudio.status, 'completed');
});
