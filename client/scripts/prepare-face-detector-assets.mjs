import { cp, copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const packageRoot = path.join(clientRoot, 'node_modules', '@mediapipe', 'tasks-vision');
const targetRoot = path.join(clientRoot, 'public', 'vendor', 'mediapipe');
const wasmSource = path.join(packageRoot, 'wasm');
const wasmTarget = path.join(targetRoot, 'wasm');
const bundleSource = path.join(packageRoot, 'vision_bundle.mjs');
const bundleTarget = path.join(targetRoot, 'vision_bundle.mjs');
const modelTarget = path.join(targetRoot, 'blaze_face_short_range.tflite');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

await mkdir(targetRoot, { recursive: true });
await cp(wasmSource, wasmTarget, { recursive: true, force: true });
await copyFile(bundleSource, bundleTarget);

let modelReady = false;
try {
  const info = await stat(modelTarget);
  modelReady = info.size > 100_000;
} catch (_) {}

if (!modelReady) {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Face detector model download failed (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 100_000) throw new Error('Face detector model download was unexpectedly small.');
  await writeFile(modelTarget, bytes);
}

console.log('Prepared local MediaPipe face detector runtime and model.');
