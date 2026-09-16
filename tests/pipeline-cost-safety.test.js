const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateCheckedAudioTracks,
  validateParticipantVoice,
  verifyGeneratedSpeech
} = require('../server/pipeline');

test('uses a server transcription of the normalized reference audio', async () => {
  const session = {
    voice: { path: 'uploaded.webm', mime: 'audio/webm', referenceText: 'untrusted client text' },
    provider: {},
    stages: {}
  };

  await validateParticipantVoice(session, 'session-directory', {
    materialize: async () => {},
    normalizeReferenceAudio: async (_input, output) => output,
    assertAudioDuration: async (_path, options) => {
      assert.equal(options.minSeconds, 3);
      assert.equal(options.maxSeconds, 15);
      return 8;
    },
    persistTemporaryProviderFile: async () => 'object://sessions/test/provider-temp/reference-voice.wav',
    transcribeAudio: async () => 'The words actually spoken in the recording.'
  });

  assert.equal(session.voice.normalizedPath, 'object://sessions/test/provider-temp/reference-voice.wav');
  assert.equal(session.voice.referenceText, 'The words actually spoken in the recording.');
  assert.equal(session.voice.transcriptSource, 'server-whisper');
  assert.equal(session.stages.referenceVoice.status, 'completed');
});

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
      },
      verifyGeneratedSpeech: async () => ({ matches: true })
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

test('rejects generated speech with words outside the administrator script', async () => {
  const session = {
    scripts: {
      whatsapp: 'Use only this administrator approved message',
      video: 'Use only this administrator approved video message'
    },
    provider: {},
    stages: {}
  };

  await assert.rejects(
    generateCheckedAudioTracks(session, {
      whatsappPath: 'whatsapp.wav',
      videoSpeechPath: 'video.wav'
    }, {
      generateVoice: async () => {},
      assertAudioDuration: async () => 7,
      verifyGeneratedSpeech: async () => {
        const error = new Error('Generated speech did not match the administrator script. Audio was rejected before video generation.');
        error.nonRetryable = true;
        throw error;
      }
    }),
    /did not match the administrator script/
  );
  assert.equal(session.whatsappAudioOutput, undefined);
  assert.equal(session.videoAudioOutput, undefined);
});

test('the transcript gate marks mismatched provider audio as non-retryable', async () => {
  const session = { scripts: {}, provider: {}, stages: {} };
  await assert.rejects(
    verifyGeneratedSpeech(
      session,
      'whatsappAudio',
      'generated.wav',
      'Speak only these administrator words',
      {
        transcribeAudio: async () => 'Speak only these administrator words plus unrelated content',
        compareTranscripts: () => ({
          matches: false,
          wordErrorRate: 0.4,
          expectedWordCount: 5,
          actualWordCount: 8
        })
      }
    ),
    (error) => error.code === 'GENERATED_TRANSCRIPT_MISMATCH' && error.nonRetryable === true
  );
  assert.equal(session.stages.whatsappVerification.status, 'validation_failed');
  assert.equal(session.stages.whatsappAudio.status, 'validation_failed');
});
