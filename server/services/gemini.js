const fs = require('node:fs/promises');
const config = require('../config');

async function validateFaceImage(face) {
  if (!config.providers.geminiKey) {
    return { usable: true, reason: 'Gemini validation is not configured; binary image validation passed.', source: 'basic' };
  }
  const bytes = await fs.readFile(face.path);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.providers.geminiModel)}:generateContent?key=${encodeURIComponent(config.providers.geminiKey)}`;
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'This is a consented security-awareness simulation. Assess only whether this uploaded photo is technically suitable for a talking-head animation. Do not identify the person. Return usable=true only when exactly one clearly visible human face is present, reasonably front-facing, unobstructed, and the image is not explicit or graphic. Give a short non-sensitive reason.' },
        { inlineData: { mimeType: face.mime, data: bytes.toString('base64') } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          usable: { type: 'BOOLEAN' },
          reason: { type: 'STRING' }
        },
        required: ['usable', 'reason']
      }
    }
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini validation failed (${response.status}).`);
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  try {
    const parsed = JSON.parse(text);
    return { usable: Boolean(parsed.usable), reason: String(parsed.reason || ''), source: 'gemini' };
  } catch {
    throw new Error('Gemini returned an unexpected validation response.');
  }
}

module.exports = { validateFaceImage };
