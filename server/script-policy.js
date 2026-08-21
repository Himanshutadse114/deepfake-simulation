const config = require('./config');

const MAX_SCRIPT_CHARS = config.scriptPolicy.maxChars;
const MIN_SCRIPT_CHARS = config.scriptPolicy.minChars;

const awarenessTerms = /\b(ai|deepfake|voice clone|synthetic|security awareness|verify|verification|simulation)\b/i;
const urlPattern = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|in|co)\b)/i;
const secretPattern = /\b(password|passcode|otp|one[- ]time password|verification code|security code|recovery code|credential(?:s)?|login code)\b/i;
const secretRequest = new RegExp(`\\b(send|share|tell|give|provide|read|enter|forward|reveal)\\b[\\s\\S]{0,45}${secretPattern.source}`, 'i');
const moneyRequest = /\b(send|transfer|wire|approve|authorise|authorize|pay)\b[\s\S]{0,35}\b(money|funds|payment|invoice|bank transfer|crypto|cryptocurrency)\b/i;
const warningContext = /\b(do not|don't|never|avoid|refuse|report|warning|beware|if someone|someone asks|cannot|can't|should not|shouldn't)\b/i;

function normalizeScript(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sentenceContainsUnsafeInstruction(sentence) {
  const sensitive = secretRequest.test(sentence) || moneyRequest.test(sentence);
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

  // Core safeguard: cloned speech cannot directly request sensitive credentials or payments.
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
  validateScriptPair
};
