# Innvikta AI Impersonation Awareness Simulation

Consent-gated security-awareness simulation showing how a participant's own photo and voice can be repackaged across a WhatsApp-style cloned voice note, an AI talking-head video and a synthetic social profile.

The active production stack is:

```text
Voice   qwen/qwen3-tts
Video   prunaai/p-video-avatar
Images  black-forest-labs/flux-2-pro
```

All three active AI paths use the server-side `REPLICATE_API_TOKEN`.

## Production architecture

The recommended deployment is intentionally simple: **one Render Web Service + private Cloudflare R2 + Replicate**.

```text
Learners
   │
   ▼
ONE Render Web Service
   ├── UI + API
   ├── disk-staged uploads
   ├── bounded local AI queue
   │     └── 4 complete simulations active by default
   ├── FFmpeg/ffprobe gate
   │     └── 2 media processes active by default
   └── provider orchestration
          │
          ├── Qwen3-TTS
          ├── FLUX.2 Pro
          └── Pruna

Cloudflare R2 (private)
   ├── participant media while required
   ├── generated media
   ├── durable session/checkpoint state
   ├── daily cost reservations
   ├── learner/campaign reservations
   └── admin awareness scripts
```

There is no Redis requirement in the one-service deployment. The in-process queue provides bounded concurrency; R2 is the durable source of truth used to reconstruct unfinished sessions after a Render restart or deploy.

## Cost-safety behavior

The server is deliberately conservative because provider calls are billable.

- A session is queued instead of immediately launching an unbounded generation pipeline.
- Default AI concurrency is `4` complete simulations.
- Default FFmpeg/ffprobe concurrency is `2`.
- Default queue admission limit is `250` jobs.
- Each AI simulation reserves a configurable estimated amount before entering the paid queue.
- Daily reservations are persisted in R2 so a Render restart does not reset the budget counter.
- Pruna receives video audio capped at **10 seconds**, matching the final 10-second video cap.
- WhatsApp cloned audio may be up to **12 seconds**.
- FLUX uses **one** 2 MP 2x2 contact-sheet prediction, not four separate predictions.
- The FLUX-only identity reference is resized to no more than 1024 px per side before the paid request.
- The 2x2 FLUX sheet is split locally into four profile images.
- Paid video fallback is disabled by default, preventing one failed video provider from automatically spilling into another paid provider.
- Provider-result downloads are retried without purchasing another prediction.
- A persisted Replicate prediction ID is reused after a safe interruption/restart.
- Immediately before a new paid Replicate creation request, the stage is saved as `creation_started` in R2.
- If Render stops after that boundary but before a prediction ID is safely stored, automatic recovery fails closed rather than guessing and potentially paying twice.
- Ambiguous provider-creation failures cannot be triggered through the learner's “Retry safely” action.

## Restart recovery

Every session is stored under a private R2 state object:

```text
sessions/<session-id>/state/session.json
```

On startup the single Render service:

1. lists saved session state from R2;
2. removes already-expired sessions;
3. restores collecting/completed/failed sessions for browser continuity;
4. identifies unfinished AI jobs;
5. blocks any stage whose paid-creation state is ambiguous;
6. requeues safe unfinished sessions;
7. reuses existing Qwen, FLUX and Pruna prediction IDs whenever available.

The browser can therefore continue polling the same session ID/token after a Render restart.

## Safety boundary

This project is restricted to authorised participant-facing awareness training.

- All consent confirmations are required before media processing.
- The participant confirms the photograph and voice sample are their own.
- Learners do not control the generated cloned-speech scripts; sessions snapshot the scripts configured by the protected admin page.
- Server-side script policy rejects direct instructions to send/approve money or disclose passwords, OTPs, credentials, PINs, verification codes or similar secrets.
- Scripts are capped at 180 characters.
- Generated video carries the permanent disclosure `AI-GENERATED SECURITY AWARENESS SIMULATION`.
- Generated social images remain inside the awareness module and are not published to a real social network.
- Provider credentials stay server-side.
- The R2 bucket is expected to remain private.
- No biometric identity verification or demographic inference is performed.

## Learner flow

1. Introduction
2. Informed consent
3. Media setup
   - first name and surname
   - JPEG/PNG portrait upload or camera capture
   - voice upload or browser recording
4. Generation queue
5. Qwen WhatsApp voice generation and duration validation
6. Qwen video voice generation and 10-second duration validation
7. Pruna video + one FLUX 2x2 profile-grid prediction
8. Local video watermarking + local FLUX-grid split
9. WhatsApp impersonation simulation
10. Incoming WhatsApp video-call simulation
11. Follow-on QR/payment scam simulation
12. Synthetic Instagram profile simulation
13. Analysis/learning
14. Nine-question knowledge check
15. Completion score and cleanup

Questions remain at the end of the simulation.

## WhatsApp replay behavior

Replay is UI-only.

- The learner can play the cloned voice note repeatedly.
- Only the first completed playback in a WhatsApp run advances the story.
- Only the explicit **Replay** button restarts the WhatsApp story.
- Replay does not call `/generate` and does not purchase new Qwen, FLUX or Pruna predictions.
- Completion controls are removed while the replay is running and return only after the fresh conversation completes.

## Active generation flow

```text
Admin WhatsApp script
        │
        ▼
     Qwen3-TTS
        │
        ▼
WhatsApp audio ≤12 s

Admin video script
        │
        ▼
     Qwen3-TTS
        │
        ▼
 Video audio ≤10 s
        │
        ├────────────────────┐
        │                    │
        ▼                    ▼
      Pruna                FLUX.2 Pro
        │                 one 2 MP grid
        ▼                    │
  AI talking head            ▼
        │                local 2x2 split
        ▼                    │
 FFmpeg disclosure       four profile tiles
        │                    │
        └──────────┬─────────┘
                   ▼
             Learner flow
```

## Required production environment

```env
NODE_ENV=production
PORT=10000

REPLICATE_API_TOKEN=...

S3_BUCKET=innvikta-deepfake-media
S3_REGION=auto
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false

AI_WORKER_CONCURRENCY=4
FFMPEG_CONCURRENCY=2
AI_MAX_QUEUED_JOBS=250
AI_DAILY_BUDGET_USD=50
ESTIMATED_SIMULATION_COST_USD=0.35

VOICE_PROVIDER=qwen
QWEN_MODEL=qwen/qwen3-tts
QWEN_LANGUAGE=auto

FLUX_ENABLED=true
FLUX_MODEL=black-forest-labs/flux-2-pro

VIDEO_PROVIDER_PREFERENCE=pruna
PRUNA_MODEL=prunaai/p-video-avatar
PRUNA_RESOLUTION=720p
MAX_VIDEO_SECONDS=10
ALLOW_PAID_VIDEO_FALLBACK=false
```

Do not commit real provider or R2 credentials.

`REDIS_URL` should be left unset in the one-service production architecture.

## Signed platform launch

The app supports a signed tenant/user/campaign launch token. When the main Innvikta platform is ready to issue those tokens, set:

```env
LAUNCH_TOKEN_SECRET=<private shared HMAC secret>
REQUIRE_LAUNCH_TOKEN=true
```

Until that integration is ready, `REQUIRE_LAUNCH_TOKEN=false` preserves standalone simulation access. IP rate limiting is only an abuse backstop because many corporate learners may share one public NAT IP.

## Internal no-AI demo

`/demo` uses the same learner UI and session lifecycle without calling Qwen, FLUX, Pruna or another AI provider. The participant's uploaded media is reused as placeholder content for internal review.

`DEMO_MODE=true` forces all sessions into provider-free demo mode.

## API flow

Create session:

```http
POST /api/simulation/session
```

Upload participant media:

```http
POST /api/simulation/:id/face
POST /api/simulation/:id/voice
```

Queue and monitor generation:

```http
POST /api/simulation/:id/generate
GET  /api/simulation/:id/status
```

A failed session that has only safe reusable checkpoints may use:

```http
POST /api/simulation/:id/retry
```

Private learner assets:

```http
GET /api/simulation/:id/audio/whatsapp?token=...
GET /api/simulation/:id/audio/video?token=...
GET /api/simulation/:id/video?token=...
GET /api/simulation/:id/variant/0?token=...
```

Explicit cleanup:

```http
DELETE /api/simulation/:id
```

All media responses use `private, no-store`.

## Data lifecycle

During an AI simulation the private R2 bucket may temporarily contain:

```text
sessions/<id>/input/face.*
sessions/<id>/input/voice.*
sessions/<id>/state/session.json
sessions/<id>/generated/whatsapp-speech.wav
sessions/<id>/generated/video-speech.wav
sessions/<id>/generated/simulation.mp4
sessions/<id>/generated/variant-1.jpg ... variant-4.jpg
```

Original participant media is deleted after successful provider work. Generated assets and session state remain only for the configured retention period. Expired session prefixes are deleted server-side.

Control objects used for daily cost/learner reservations are stored separately under the private `control/` prefix.

## Build and verification

```bash
npm install
npm --prefix client install
npm test
npm --prefix client run build
```

CI additionally performs Node syntax checks, a Docker build and an FFmpeg watermark smoke test.

## Deployment

Render currently deploys the `feature/consent-aware-simulator` branch. The repository `render.yaml` describes a single Docker web service. The current Render service can be kept; configure the R2/S3 and Replicate secrets directly in that service's Environment settings.
