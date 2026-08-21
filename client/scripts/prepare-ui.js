import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', 'public');

async function decode(name) {
  const encoded = await fs.readFile(path.join(publicDir, `${name}.gz.b64`), 'utf8');
  return gunzipSync(Buffer.from(encoded.trim(), 'base64')).toString('utf8');
}

let html = await decode('ui.html');
const css = await decode('ui.css');
let js = await decode('ui.js');

// The supplied prototype intentionally keeps its original inline event handlers.
// Older prototype functions are still present in the source for visual parity;
// rename only duplicate legacy declarations so the live integration remains active.
const integratedFunctions = [
  'buildInstagramGrid', 'checkMediaReady', 'startGeneration', 'acceptVideoCall',
  'endVideoCall', 'speakAwareness', 'playDeepfakeVideo', 'playVoiceSimulation',
  'finishSimulation', 'resetSimulation', 'startRecording', 'stopRecording',
  'cancelRecording'
];
for (const name of integratedFunctions) {
  const marker = `function ${name}(`;
  if (js.split(marker).length - 1 > 1) js = js.replace(marker, `function legacy_${name}(`);
}

// Small markup normalisations that do not alter the supplied visual design.
html = html.replace(/<section class="screen" data-screen="quiz">([\s\S]*?)<\/section>/, (match) => match);

await Promise.all([
  fs.writeFile(path.join(publicDir, 'ui.html'), html),
  fs.writeFile(path.join(publicDir, 'ui.css'), css),
  fs.writeFile(path.join(publicDir, 'ui.js'), js)
]);

console.log('Prepared supplied deepfake-awareness UI assets.');
