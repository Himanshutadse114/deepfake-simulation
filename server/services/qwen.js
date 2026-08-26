const fs = require('node:fs/promises');
const config = require('../config');
const { toProviderUri } = require('../storage');
const { downloadWithRetry } = require('./download');
const { runOfficialPrediction } = require('./replicate-prediction');

const EXACT_SCRIPT_STYLE = [
  'Read the entire provided text verbatim from the first word through the final word.',
  'Do not add, omit, repeat, paraphrase, preface, append, shorten, summarize, or improvise any words.',
  'Do not stop early. Finish only after speaking the final word of the provided text.',
  'Speak naturally, clearly and at a steady pace.'
].join(' ');

// Qwen can occasionally spend much longer starting a worker than actually
// synthesizing speech. Do not confuse provider queue/startup time with model
// runtime: give starting predictions room to begin, then cap actual processing.
const QWEN_PROVIDER_DEADLINE = '3m';
const QWEN_QUEUE_TIMEOUT_MS = 90_000;
const QWEN_PROCESSING_TIMEOUTS_MS = [30_000, 45_000];

function outputUrl(output) {
  if (typeof output === 'string') return output;
  if (typeof output?.url === 'string') return output.url;
  if (Array.isArray(output) && typeof output[0] === 'string') return output[0];
  return null;
}

function buildVoiceCloneInput({ text, language, referenceAudio, referenceText = '' }) {
  // Preserve the complete administrator script exactly. No trimming, slicing,
  // summarising or client-supplied replacement is performed here.
  const exactText = String(text ?? '');
  if (!exactText.trim()) throw new Error('Qwen3-TTS text is empty.');
  if (!referenceAudio) throw new Error('Qwen3-TTS reference audio is missing.');

  const input = {
    mode: 'voice_clone',
    text: exactText,
    language: language || 'auto',
    reference_audio: referenceAudio,
    style_instruction: EXACT_SCRIPT_STYLE
  };

  // Replicate/Qwen recommends supplying the transcript when it is known. We
  // only send it for the guided in-app recording where the transcript is exact;
  // arbitrary uploads are still accepted without inspecting/verifying speech.
  const transcript = String(referenceText || '').trim();
  if (transcript) input.reference_text = transcript.slice(0, 1200);
  return input;
}

async function saveOutput(output, targetPath) {
  if (!output) throw new Error('Qwen3-TTS did not return audio output.');
  const url = outputUrl(output);
  if (url) return downloadWithRetry(url, targetPath, { label: 'Qwen3-TTS output', timeoutMs: 90_000 });

  if (typeof output?.arrayBuffer === 'function') {
    await fs.writeFile(targetPath, Buffer.from(await output.arrayBuffer()), { mode: 0o600 });
    return targetPath;
  }
  if (Buffer.isBuffer(output) || output instanceof Uint8Array) {
    await fs.writeFile(targetPath, output, { mode: 0o600 });
    return targetPath;
  }
  throw new Error('Qwen3-TTS returned an unsupported audio output shape.');
}

function isRetryableQwenAttemptError(error) {
  return [
    'REPLICATE_STARTING_TIMEOUT',
    'REPLICATE_PROCESSING_TIMEOUT',
    'REPLICATE_PREDICTION_CANCELED',
    'REPLICATE_PREDICTION_ABORTED'
  ].includes(error?.code);
}

function normalizeAttempt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(2, Math.max(1, Math.trunc(parsed)));
}

async function runStateAwareQwenPrediction({ input, predictionId, options }) {
  let attempt = normalizeAttempt(options.attemptNumber);
  let durablePredictionId = predictionId || null;

  for (;;) {
    const processingTimeoutMs = QWEN_PROCESSING_TIMEOUTS_MS[attempt - 1];
    try {
      return await runOfficialPrediction({
        model: config.providers.qwenModel,
        input: durablePredictionId ? undefined : input,
        predictionId: durablePredictionId,
        label: `Qwen3-TTS voice clone · attempt ${attempt}`,
        cancelAfter: QWEN_PROVIDER_DEADLINE,
        waitOptions: {
          startingTimeoutMs: QWEN_QUEUE_TIMEOUT_MS,
          processingTimeoutMs,
          cancelOnStateTimeout: true
        },
        onPredictionCreated: async (prediction) => {
          await options.onPredictionCreated?.(prediction, { attempt });
        },
        onRateLimit: options.onRateLimit
      });
    } catch (error) {
      if (!isRetryableQwenAttemptError(error) || attempt >= 2) throw error;

      const nextAttempt = attempt + 1;
      console.warn(
        `Qwen3-TTS attempt ${attempt} did not complete within the state-aware limit; retrying once with a ${Math.round(QWEN_PROCESSING_TIMEOUTS_MS[nextAttempt - 1] / 1000)}s processing budget.`,
        { predictionId: error.predictionId, code: error.code, status: error.predictionStatus }
      );

      await options.onBeforePredictionCreate?.({
        retry: true,
        attempt: nextAttempt,
        priorPredictionId: error.predictionId || durablePredictionId || null
      });
      attempt = nextAttempt;
      durablePredictionId = null;
    }
  }
}

async function synthesizeScript(voiceFile, outputPath, referenceText = '', text = config.awarenessScript, options = {}) {
  if (!config.providers.replicateToken) throw new Error('REPLICATE_API_TOKEN is not configured.');

  // Build the input even when resuming a durable prediction id. If that resumed
  // first attempt reaches the controlled timeout, the same exact input can be
  // used for the single permitted retry without losing restart safety.
  const referenceAudio = await toProviderUri(voiceFile.path, voiceFile.mime || 'audio/webm');
  const input = buildVoiceCloneInput({
    text,
    language: config.providers.qwenLanguage,
    referenceAudio,
    referenceText
  });

  if (!options.predictionId) {
    await options.onBeforePredictionCreate?.({ attempt: normalizeAttempt(options.attemptNumber) });
  }

  const result = await runStateAwareQwenPrediction({
    input,
    predictionId: options.predictionId,
    options
  });

  await options.onProviderOutput?.({
    predictionId: result.prediction.id,
    output: result.output
  });
  await saveOutput(result.output, outputPath);
  return { path: outputPath, predictionId: result.prediction.id, providerOutput: result.output };
}

const synthesizeFixedScript = (voiceFile, outputPath, referenceText = '') =>
  synthesizeScript(voiceFile, outputPath, referenceText, config.awarenessScript);

module.exports = {
  synthesizeScript,
  synthesizeFixedScript,
  buildVoiceCloneInput,
  saveOutput,
  outputUrl,
  EXACT_SCRIPT_STYLE,
  QWEN_PROVIDER_DEADLINE,
  QWEN_QUEUE_TIMEOUT_MS,
  QWEN_PROCESSING_TIMEOUTS_MS,
  isRetryableQwenAttemptError,
  runStateAwareQwenPrediction,
  normalizeAttempt
};
