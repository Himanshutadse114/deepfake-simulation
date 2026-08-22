const config = require('./config');

const MAX_SCRIPT_CHARS = config.scriptPolicy.maxChars;
const MIN_SCRIPT_CHARS = config.scriptPolicy.minChars;

const awarenessTerms = /\b()\b/i;
const urlPattern = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|in|co)\b)/i;
const secretPattern = /\b()\b/i;
const requestVerb = /\b()\b/i;
const moneyRequest = /\b()\b[\s\S]{0,45}\b()\b/i;
const warningContext = /\b()\b/i;

function normalizeScript(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sentenceContainsUnsafeInstruction(sentence) {
  const secretRequest = requestVerb.test(sentence) && secretPattern.test(sentence);
  const sensitive = secretRequest || moneyRequest.test(sentence);
  return sensitive && !warningContext.test(sentence);
}

function validateAwarenessScript(value, label = 'Script') {
  const text = normalizeScript(value);
  if (text.length < MIN_SCRIPT_CHARS) {
    throw new Error(`${label} must be at least ${MIN_SCRIPT_CHARS} characters.`);
  }
  if (text.length > MAX_SCRIPT_CHARS) {
    throw new Error(`${label} must be ${MAX_SCRIPT_CHARS} characters or fewer so the simulation stays short.`);
  }
  if (config.scriptPolicy.requireAwarenessContext && !awarenessTerms.test(text)) {
    throw new Error(`${label} must clearly be framed as AI/deepfake security-awareness or verification content.`);
  }
  if (config.scriptPolicy.blockUrls && urlPattern.test(text)) {
    throw new Error(`${label} cannot contain links or domains.`);
  }

  // Core safeguard: cloned speech cannot directly request sensitive credentials
  // or payments. Educational warnings are allowed only when the same sentence
  // clearly tells the learner not to comply, to verify, or to report the request.
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  if (sentences.some(sentenceContainsUnsafeInstruction)) {
    throw new Error(`${label} cannot directly instruct the listener to send money, approve payments, or disclose passwords, OTPs, credentials or security codes.`);
  }
  return text;
}

function validateScriptPair(scripts = {}) {
  return {
    whatsapp: validateAwarenessScript(scripts.whatsapp, 'WhatsApp audio script'),
    video: validateAwarenessScript(scripts.video, 'Deepfake video audio script')
  };
}

module.exports = {
  MAX_SCRIPT_CHARS,
  MIN_SCRIPT_CHARS,
  normalizeScript,
  validateAwarenessScript,
  validateScriptPair,
  sentenceContainsUnsafeInstruction
};
