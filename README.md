# Innvikta AI Impersonation Awareness Module

A consent-gated security-awareness experience that lets a participant see how their **own** photo and voice can be transformed into synthetic media, then teaches them how to verify identity safely.

The module is deliberately restricted to awareness use:

- all participant consent confirmations are mandatory;
- the participant must confirm the uploaded photograph and voice are their own;
- generated speech is a short, fixed server-side awareness message;
- there is no arbitrary text-to-impersonation field or API route;
- the talking-head result has a permanent `AI-GENERATED SECURITY AWARENESS SIMULATION` watermark;
- the synthetic social profile exists only inside the module and is never posted to a real social network;
- provider keys stay server-side;
- media is temporary and is deleted at module completion or session expiry;
- no biometric identity verification, demographic inference or face recognition is performed.

## Final learner experience

1. **Introduction** — explain the purpose of the authorised simulation.
2. **Informed consent** — participant confirms ownership and temporary processing of face and voice media.
3. **Photo upload** — locally validate a clear JPEG/PNG portrait.
4. **Voice sample** — record or upload a short consented voice reference.
5. **Deepfake video generation**
   - Qwen3-TTS clones the participant voice from reference audio.
   - The fixed ~10-second awareness script is synthesised.
   - Pruna `p-video-avatar` animates the original portrait with the synthetic audio.
   - FFmpeg burns the permanent AI disclosure into the MP4.
6. **Deepfake learning screen** — video is shown on the left and a learning panel on the right explaining video/voice impersonation, real-world scam scenarios, red flags and verification habits.
7. **Knowledge check 1** — three questions reinforce safe responses to synthetic video and voice.
8. **Synthetic profile generation** — only after the first knowledge check, FLUX.2 Pro turns the single consented portrait into four synthetic social-style photos in different generic settings.
9. **Profile impersonation screen** — a clearly labelled simulated Instagram-style profile shows a profile picture, bio, follower/following counts and the four AI-generated images.
10. **Profile impersonation learning** — explain manufactured familiarity, social proof, impersonation outreach and how to verify suspicious accounts.
11. **Knowledge check 2** — three questions reinforce safe behaviour around fake profiles and messages.
12. **Completion** — show the combined knowledge-check score without declaring pass/fail and immediately delete temporary server-side session assets.

## Active AI stack

```text
Participant-owned voice
        ↓
Qwen3-TTS voice_clone on Replicate
        ↓
Fixed awareness speech
        ↓
Pruna p-video-avatar on Replicate
        ↓
Permanent FFmpeg watermark
        ↓
Deepfake video + learning + quiz
        ↓
FLUX.2 Pro on Replicate
        ↓
4 synthetic social-profile images
        ↓
Profile impersonation learning + quiz
        ↓
Completion + cleanup
```

The active production path therefore requires only one AI-provider credential: a Replicate API token.

## Fixed generated script

The backend is hard-coded to generate only:

> This is an AI-generated security awareness simulation. A familiar face or voice can be faked. Verify unusual requests through a trusted channel before acting.

There is intentionally no participant-editable generated script.

## Models

### Voice — Qwen3-TTS

Replicate model:

```text
qwen/qwen3-tts
```

The application uses:

```text
mode=voice_clone
reference_audio=<participant-owned sample>
reference_text=<known recording transcript when recorded in-app>
text=<fixed awareness script>
language=auto
```

A new reference voice is supplied for each simulation; no persistent participant voice profile is created by the application.

### Video — Pruna

Replicate model:

```text
prunaai/p-video-avatar
```

The original consented portrait plus the Qwen-generated audio are sent to Pruna. The default resolution is 720p.

### Images — FLUX.2 Pro

Replicate model:

```text
black-forest-labs/flux-2-pro
```

FLUX generation is deliberately deferred until the learner completes the first deepfake knowledge check. Four square synthetic images are created sequentially from the original consented portrait. Prompts are restricted to benign office, cafe, generic public-space and park/lifestyle settings and explicitly avoid documents, badges, brands or other people.

## Environment variables

Copy `.env.example` to `.env`.

Required for real generation:

```env
REPLICATE_API_TOKEN=your_replicate_token
DEMO_MODE=false

VOICE_PROVIDER=qwen
QWEN_MODEL=qwen/qwen3-tts
QWEN_LANGUAGE=auto

FLUX_ENABLED=true
FLUX_MODEL=black-forest-labs/flux-2-pro
FLUX_GRID_IMAGES=4

VIDEO_PROVIDER_PREFERENCE=pruna
PRUNA_MODEL=prunaai/p-video-avatar
PRUNA_RESOLUTION=720p
```

Operational values:

```env
MAX_IMAGE_SIZE_MB=8
MAX_AUDIO_SIZE_MB=20
MEDIA_RETENTION_MINUTES=30
RATE_LIMIT_MAX=3
RATE_LIMIT_WINDOW_MINUTES=60
```

Optional legacy/experimental provider adapters remain in the repository but are disabled by default.

## Local development

Requirements:

- Node.js 20+
- npm
- modern browser with microphone permissions
- FFmpeg for real video generation outside Docker

```bash
cp .env.example .env
npm install
npm --prefix client install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:10000`

## Docker

```bash
docker build -t innvikta-deepfake-awareness .
docker run --rm -p 10000:10000 --env-file .env innvikta-deepfake-awareness
```

The production image includes FFmpeg and the font used by the permanent disclosure watermark.

## Render deployment

The repository includes `render.yaml`.

For the existing Render service:

1. Deploy branch `main`.
2. Add a freshly rotated `REPLICATE_API_TOKEN` secret directly in Render.
3. Confirm these environment values:

```env
VOICE_PROVIDER=qwen
QWEN_MODEL=qwen/qwen3-tts
QWEN_LANGUAGE=auto
FLUX_ENABLED=true
FLUX_MODEL=black-forest-labs/flux-2-pro
FLUX_GRID_IMAGES=4
VIDEO_PROVIDER_PREFERENCE=pruna
PRUNA_RESOLUTION=720p
DID_ADAPTER_ENABLED=false
HEYGEN_ADAPTER_ENABLED=false
DEMO_MODE=false
```

4. Use **Clear build cache & deploy** after changing the provider stack.
5. Check `/api/health` before spending on a simulation.

Do not paste live provider secrets into source control, issue threads or chat messages.

## Health endpoint

```http
GET /api/health
```

Expected active stack fields include:

```json
{
  "ok": true,
  "demoMode": false,
  "stack": {
    "voice": "qwen",
    "images": "flux-2-pro",
    "video": ["pruna"]
  },
  "providers": {
    "replicate": true,
    "qwen": true,
    "flux": true,
    "pruna": true
  },
  "fluxGridImages": 4,
  "videoProviderPreference": ["pruna"]
}
```

No secret values are returned.

## API flow

### Create a consented session

```http
POST /api/simulation/session
```

```json
{
  "consents": {
    "faceOwnership": true,
    "voiceOwnership": true,
    "processing": true
  }
}
```

The response contains a random session ID and token. Subsequent requests require `x-simulation-token` or the token query parameter for media elements.

### Upload face

```http
POST /api/simulation/:id/face
Content-Type: multipart/form-data
```

Form field: `face`.

### Upload voice

```http
POST /api/simulation/:id/voice
Content-Type: multipart/form-data
```

Form fields:

- `voice` — audio file;
- `referenceText` — optional transcript. The browser recorder automatically sends the known sample transcript so Qwen can use it for stronger cloning.

### Generate deepfake awareness video

```http
POST /api/simulation/:id/generate
```

The frontend polls:

```http
GET /api/simulation/:id/status
```

and streams the final watermarked result from:

```http
GET /api/simulation/:id/video?token=<session-token>
```

### Generate synthetic profile after learning checkpoint

```http
POST /api/simulation/:id/profile/generate
```

The same status endpoint exposes `profileStatus`, `profileDetail`, `profileError` and `variantCount`.

Synthetic lesson images are served privately from:

```http
GET /api/simulation/:id/variant/:index?token=<session-token>
```

### Delete immediately

```http
DELETE /api/simulation/:id
```

The completion action calls this endpoint before showing the final completion screen.

## Data lifecycle

During the first stage the local session directory may temporarily contain the uploaded face and voice, generated speech, raw video and watermarked result. After the watermarked video is ready, the voice sample, synthetic speech and raw video are removed. The original portrait is retained only until the learner starts the FLUX profile exercise.

After FLUX finishes, the original server-side portrait is removed and only the watermarked training video plus the four synthetic lesson images remain. At module completion those remaining files are deleted immediately. Abandoned sessions are removed by the expiry timer.

## Security controls

- explicit informed-consent gate;
- participant ownership assertions for face and voice media;
- fixed benign server-side generated text;
- no arbitrary impersonation-script route;
- local JPEG/PNG signature, dimension and size validation;
- restricted audio types and upload sizes;
- random 256-bit session token;
- no public uploads directory;
- session-token protection for video and image responses;
- `private, no-store` media responses;
- server-side provider credentials only;
- session creation rate limiting;
- Helmet/CSP security headers;
- permanent MP4 AI disclosure plus UI disclosures;
- FLUX profile clearly marked as simulated and never posted externally;
- sequential Replicate calls with 429 retry handling;
- staged media deletion and automatic expiry;
- no biometric identity recognition or demographic inference.

## CI

`.github/workflows/ci.yml` validates:

- server and client dependencies;
- media validation tests;
- Node syntax for Qwen, FLUX, Pruna and the rest of the backend;
- Vite production build;
- Docker image build;
- FFmpeg watermark smoke test inside the production image.

## Production scaling notes

The current session store is in memory and local files are intentionally ephemeral. Before horizontally scaling, add a queue plus shared short-TTL state/object storage, signed launch tokens from the parent awareness platform, authenticated completion callbacks, tenant-aware quotas and audit events that record consent metadata without storing biometric media.

## Safety boundary

This project is for authorised participant-facing security awareness. Do not remove the ownership/consent checks, fixed-script restriction, temporary-media cleanup, synthetic-profile disclosure or permanent AI watermark in downstream deployments.
