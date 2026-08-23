# Innvikta AI Impersonation Awareness Simulation

Consent-gated security-awareness simulation showing how a participant's own photo and voice can be repackaged across a WhatsApp-style cloned voice note, an AI talking-head video and a synthetic social profile.

The active production stack is:

```text
Voice   qwen/qwen3-tts
Video   prunaai/p-video-avatar
Images  black-forest-labs/flux-2-pro
```

All active AI paths use the server-side `REPLICATE_API_TOKEN`.

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

## Active AI flow

The simulation uses two Qwen voice-clone predictions, three FLUX profile-image predictions and one Pruna talking-head prediction.

```text
Admin WhatsApp script ──→ Qwen3-TTS ──→ WhatsApp cloned audio ≤12 s

Admin video script ─────→ Qwen3-TTS ──→ video cloned audio ≤10 s
                                             │
Consented portrait ──────────────────────────┤
                                             ▼
                                           Pruna
                                             │
                                             ▼
                                 talking-head awareness video
                                             │
                                             ▼
                                   permanent disclosure

Consented portrait ──→ FLUX.2 Pro × 3 at 1 MP
                        ├── close portrait
                        ├── half-body lifestyle post
                        └── near-full-body lifestyle post
```

The Instagram simulation displays **exactly three photo posts**. The deepfake video remains in the video-call part of the experience and is not reused as a social-media post.

## Instagram realism

Each FLUX generation is an independent square `1 MP` request using the same private identity reference. The reference is resized to no more than 1024 px on either side before provider use.

The three prompts deliberately use different framing while prioritising the same recognisable face:

1. close head-and-shoulders / upper-chest portrait;
2. natural waist-up / half-body social photo;
3. near-full-body or full-body lifestyle photo, with the person kept large enough in frame for the face to remain clear.

Prompts avoid studio, fashion-editorial and cinematic styling so the results resemble ordinary smartphone Instagram posts rather than three repeated AI portraits.

## Generation-time UI

When a learner starts generation, the loading screen explains that the complete simulation **usually takes about two minutes to prepare** and shows an estimated `02:00` countdown.

The timer is an expectation aid rather than a hard provider timeout. If generation takes longer, the UI changes to `Finishing up…` and continues polling normally. Queueing and provider rate limits can make real completion time longer than two minutes.

## Script integrity

Learners do not directly control the generated cloned-speech text. New sessions snapshot the two scripts saved through the protected admin page.

Before Qwen is called, the server records a privacy-safe script audit containing the script length and SHA-256 hash. The exact session script is passed to Replicate as Qwen's `text` input. The TTS style instruction explicitly asks Qwen not to add, omit, repeat, paraphrase, preface, append or improvise words.

For browser-recorded reference audio, the matching teleprompter transcript is also supplied as `reference_text`.

## Cost-safety behaviour

The server is deliberately conservative because provider calls are billable.

- A session is queued instead of immediately launching an unbounded generation pipeline.
- Default AI concurrency is `4` complete simulations.
- Default FFmpeg/ffprobe concurrency is `2`.
- Default queue admission limit is `250` jobs.
- Each AI simulation reserves a configurable estimated amount before entering the paid queue.
- The current default reservation is `$0.40` per simulation.
- Daily reservations are persisted in R2 so a Render restart does not reset the budget counter.
- Pruna receives video audio capped at **10 seconds**, matching the final video cap.
- WhatsApp cloned audio may be up to **12 seconds**.
- FLUX makes exactly **three independent 1 MP predictions**.
- Each FLUX prediction has its own durable creation/prediction checkpoint so a restart does not blindly repurchase successful sibling images.
- Paid video fallback is disabled.
- Production video selection is locked to **Pruna only**, even if a stale hosting environment still contains an older provider preference.
- Provider-result downloads are retried without purchasing another prediction.
- Existing Replicate prediction IDs are reused after a safe interruption/restart.
- Immediately before each new paid Replicate creation request, its stage is persisted as `creation_started` in R2.
- Ambiguous provider-creation failures fail closed rather than automatically purchasing another attempt.

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
5. blocks paid stages whose creation state is ambiguous;
6. requeues safe unfinished sessions;
7. reuses existing Qwen, FLUX and Pruna prediction IDs whenever available.

## Safety boundary

This project is restricted to authorised participant-facing awareness training.

- All consent confirmations are required before media processing.
- The participant confirms the photograph and voice sample are their own.
- Learners do not control the generated cloned-speech scripts; sessions snapshot scripts configured by the protected admin page.
- Server-side script policy rejects direct instructions to send/approve money or disclose passwords, OTPs, credentials, PINs, verification codes or similar secrets.
- Scripts are capped at 180 characters in production.
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
4. Generation queue and approximately two-minute loading estimate
5. Qwen WhatsApp voice generation and duration validation
6. Qwen video voice generation and 10-second duration validation
7. Pruna talking-head video + three independent FLUX 1 MP profile images
8. Local video watermarking
9. WhatsApp impersonation simulation
10. Incoming WhatsApp video-call simulation
11. Follow-on QR/payment scam simulation
12. Three-post synthetic Instagram profile simulation
13. Analysis/learning
14. Nine-question knowledge check
15. Completion score and cleanup

Questions remain at the end of the simulation.

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
ESTIMATED_SIMULATION_COST_USD=0.40

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

Do not commit real provider or R2 credentials. `REDIS_URL` should be left unset in the one-service production architecture.

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
GET /api/simulation/:id/variant/1?token=...
GET /api/simulation/:id/variant/2?token=...
```

Explicit cleanup:

```http
DELETE /api/simulation/:id
```

All media responses use private/no-store delivery.

## Data lifecycle

During an AI simulation the private R2 bucket may temporarily contain:

```text
sessions/<id>/input/face.*
sessions/<id>/input/voice.*
sessions/<id>/state/session.json
sessions/<id>/generated/whatsapp-speech.wav
sessions/<id>/generated/video-speech.wav
sessions/<id>/generated/simulation.mp4
sessions/<id>/generated/variant-1.jpg
sessions/<id>/generated/variant-2.jpg
sessions/<id>/generated/variant-3.jpg
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

Render deploys the `feature/consent-aware-simulator` branch. The repository `render.yaml` describes a single Docker web service. Configure the R2/S3 and Replicate secrets directly in that service's Environment settings.
