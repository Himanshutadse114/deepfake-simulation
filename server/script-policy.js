const MAX_SCRIPT_CHARS = 180;
const MIN_SCRIPT_CHARS = 20;

const awarenessTerms = /\b(ai|deepfake|synthetic|clone|cloned|voice clone|security|cybersecurity|awareness|simulation|verify|verification|impersonation|faked|fake)\b/i;
const urlPattern = /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|in|co)\b)/i;
const secretPattern = /\b(otp|one[- ]time password|password|passcode|pin|cvv|credential(?:s)?|recovery code|verification code|card number|account number|security code|login code)\b/i;
const secretRequest = new RegExp(`\\b(?:send|share|provide|give|tell|reveal|disclose|enter|forward|read out)\\b[\\s\\S]{0,45}${secretPattern.source}`, 'i');
const moneyRequest = /\b(?:send|transfer|wire|pay|deposit|approve|authori[sz]e|purchase|buy)\b[\s\S]{0,45}\b(?:money|funds?|payment|transfer|transaction|cash|crypto|bitcoin|gift card|voucher|rupees?|dollars?|usd|inr|invoice)\b/i;
const warningContext = /\b(?:never|do not|don't|avoid|refuse|report|verify(?: first| before)?|should not|shouldn't|attackers?|scammers?|criminals?|fraudsters?|if someone|when someone|if a (?:caller|voice|message|profile|account)|when a (?:caller|voice|message|profile|account))\b/i;

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
  if (!awarenessTerms.test(text)) {
    throw new Error(`${label} must clearly be framed as AI/deepfake security-awareness or verification content.`);
  }
  if (urlPattern.test(text)) {
    throw new Error(`${label} cannot contain links or domains.`);
  }

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
