const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCheckedAudioTracks, prepareVoiceReference } = require('../server/pipeline');

test('uses a server transcription of the normalized reference audio', async () => {
  const session = {
    voice: {
      path: 'uploaded.webm',
      mime: 'audio/webm',
      referenceText: 'untrusted client transcript'
    }
  };
  let normalizedInput;

  await prepareVoiceReference(session, 'session-directory', {
    normalizeReferenceAudio: async (inputPath, outputPath) => {
      normalizedInput = inputPath;
      assert.match(outputPath, /reference-voice\.wav$/);
    },
    assertAudioDuration: async (_path, options) => {
      assert.equal(options.minSeconds, 3);
      assert.equal(options.maxSeconds, 15);
      return 8;
    },
    transcribeAudio: async () => 'The words actually spoken in the normalized recording.'
  });

  assert.equal(normalizedInput, 'uploaded.webm');
  assert.equal(session.voice.mime, 'audio/wav');
  assert.equal(session.voice.duration, 8);
  assert.equal(session.voice.referenceText, 'The words actually spoken in the normalized recording.');
  assert.equal(session.voice.transcriptSource, 'server-whisper');
});

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
        return 8;
      },
      verifyGeneratedSpeech: async () => ({
        matches: true,
        wordErrorRate: 0,
        expectedWordCount: 3,
        actualWordCount: 3
      }),
      maxAttempts: 1
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

test('rejects generated speech that does not match the administrator script', async () => {
  const session = {
    id: 'verification-test',
    scripts: {
      whatsapp: 'Use only this administrator approved message',
      video: 'Use only this administrator approved video message'
    }
  };
  let verificationCalls = 0;

  await assert.rejects(
    generateCheckedAudioTracks(session, {
      whatsappPath: 'whatsapp.wav',
      videoSpeechPath: 'video.wav'
    }, {
      generateVoice: async () => {},
      assertAudioDuration: async () => 7,
      verifyGeneratedSpeech: async () => {
        verificationCalls += 1;
        return {
          matches: false,
          wordErrorRate: 0.5,
          expectedWordCount: 6,
          actualWordCount: 9
        };
      },
      maxAttempts: 2
    }),
    /did not match the administrator script.*rejected before video generation/
  );

  assert.equal(verificationCalls, 2);
  assert.equal(session.whatsappAudioOutput, undefined);
  assert.equal(session.videoAudioOutput, undefined);
});
