# Innvikta Deepfake Awareness Simulation

A consent-gated security-awareness web application that demonstrates how an AI-generated talking-head video can imitate a participant's **own** face and voice.

The application is intentionally constrained:

- all three participant consent confirmations are mandatory;
- the uploaded photograph must be asserted to be the participant's own image;
- the uploaded/recorded voice must be asserted to be the participant's own voice;
- the generated speech is a **fixed server-side awareness script** and cannot be edited by the participant;
- image validation is performed locally using file-signature, file-size and image-dimension checks;
- the ElevenLabs voice clone is temporary and is deleted after generation;
- D-ID image/audio resources are temporary and are deleted after generation;
- the final MP4 receives a permanent `AI-GENERATED SECURITY AWARENESS SIMULATION` watermark with FFmpeg;
- local media and the final video expire automatically.

## Experience

1. Awareness introduction
2. Explicit informed consent
3. Face image upload and local JPEG/PNG validation
4. Browser microphone recording or audio upload
5. Temporary ElevenLabs Instant Voice Clone
6. Fixed awareness-script TTS
7. D-ID photo animation / lip sync
8. Permanent watermark burned into the MP4
9. Awareness lesson on verification, OTPs, credentials, money requests and reporting
10. Automatic cleanup

## Fixed generated script

The backend is hard-coded to generate only this message:

> Hello, how are you? This is an AI-generated security awareness simulation. But imagine if this message asked you to transfer money, share an OTP, reveal a password, or disclose confidential information. A familiar face and voice do not always prove who is really behind a message. Verify unusual requests through a trusted channel and stay safe.

There is intentionally no API parameter or UI field for arbitrary speech.

## Stack

- React + Vite frontend
- Node.js 20 + Express backend
- Local JPEG/PNG signature, size and dimension validation
- ElevenLabs Instant Voice Cloning + Text to Speech
- D-ID Images, Audios and Talks APIs
- FFmpeg for a permanent disclosure watermark
- Docker
- Render Blueprint (`render.yaml`)

## Required API keys

Copy `.env.example` to `.env`.

Only two AI-provider credentials are required for real generation.

### ElevenLabs

```env
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

The application creates one temporary Instant Voice Clone, generates the fixed script, and then calls the voice-delete endpoint in a `finally` cleanup path.

ElevenLabs IVC documentation: https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/instant-voice-cloning

For better results, record roughly 1 minute of clean, single-speaker audio in a quiet room. Provider account tier, verification or voice-cloning policy requirements still apply.

### D-ID

```env
DID_API_KEY=username:password
```

Paste the API credential generated in D-ID Studio. The server converts `username:password` to an HTTP Basic authorization header. If you already store an encoded Basic value, that is also supported.

D-ID authentication: https://docs.d-id.com/reference/basic-authentication

D-ID Talks API: https://docs.d-id.com/reference/createtalk

## Image validation without Gemini

The application does not require Gemini or another vision API. Uploaded photographs are checked locally for:

- genuine JPEG or PNG binary signature;
- configured file-size limit;
- readable image dimensions;
- minimum dimensions of 256 × 256 pixels;
- maximum dimensions of 12000 × 12000 pixels.

Local validation intentionally does **not** identify the participant and does not attempt biometric recognition. The UI still instructs participants to use a clear, front-facing, single-person photograph because D-ID output quality depends on the source image.

## Environment variables

See `.env.example` for the complete list.

Important values:

```env
PORT=10000
DEMO_MODE=false
MEDIA_RETENTION_MINUTES=30
MAX_IMAGE_SIZE_MB=8
MAX_AUDIO_SIZE_MB=20
RATE_LIMIT_MAX=3
RATE_LIMIT_WINDOW_MINUTES=60
```

Set `DEMO_MODE=true` while developing the UI if you do not want to call ElevenLabs or D-ID. Demo mode still exercises consent, uploads, local file validation and the training experience, but it does not create an AI video.

## Local development

Requirements:

- Node.js 20+
- npm
- modern browser with microphone permissions
- FFmpeg only required for a real provider generation outside Docker

Install:

```bash
cp .env.example .env
npm install
npm --prefix client install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:10000`

Vite proxies `/api` requests to the backend.

### Local real-generation test

Put valid ElevenLabs and D-ID credentials in `.env`, set:

```env
DEMO_MODE=false
```

and ensure `ffmpeg` is available on your PATH. D-ID media is uploaded directly through its resource APIs, so your local laptop does not need to expose the participant image or generated audio publicly.

## Docker

Build:

```bash
docker build -t innvikta-deepfake-awareness .
```

Run:

```bash
docker run --rm -p 10000:10000 --env-file .env innvikta-deepfake-awareness
```

Open `http://localhost:10000`.

The Docker image includes FFmpeg and DejaVu fonts so the permanent watermark step works consistently.

## Render deployment

The repository includes `render.yaml` and a Dockerfile.

### Blueprint deployment

1. In Render, create a new Blueprint.
2. Connect this GitHub repository.
3. Use `main` after this feature branch is merged, or select `feature/consent-aware-simulator` for a temporary live test.
4. Render reads `render.yaml`.
5. Provide the two `sync: false` secrets when prompted:
   - `ELEVENLABS_API_KEY`
   - `DID_API_KEY`
6. Deploy.
7. Check `/api/health`.
8. Confirm the health payload reports both configured providers as `true`.

The application listens on `0.0.0.0:$PORT` and defaults to port `10000`.

Do **not** add a persistent disk for the MVP. Participant uploads are intentionally temporary. Render's local filesystem is treated only as short-lived processing space.

## Health endpoint

```http
GET /api/health
```

Example:

```json
{
  "ok": true,
  "service": "deepfake-awareness-simulation",
  "demoMode": false,
  "providers": {
    "elevenLabs": true,
    "did": true
  }
}
```

No key values are returned.

## API flow

### Create consented session

```http
POST /api/simulation/session
Content-Type: application/json
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

The response includes a random session ID and client token. All subsequent API requests require:

```http
x-simulation-token: <token>
```

### Upload face

```http
POST /api/simulation/:id/face
Content-Type: multipart/form-data
```

Form field: `face`

### Upload voice

```http
POST /api/simulation/:id/voice
Content-Type: multipart/form-data
```

Form field: `voice`

### Start generation

```http
POST /api/simulation/:id/generate
```

This starts the provider pipeline and immediately returns a generation status. The frontend polls the status endpoint.

### Poll

```http
GET /api/simulation/:id/status
```

### Stream final watermarked MP4

```http
GET /api/simulation/:id/video?token=<session-token>
```

The response is marked `private, no-store`.

### Delete immediately

```http
DELETE /api/simulation/:id
```

The final UI calls this when the participant completes the lesson.

## Data lifecycle

Local temporary directory:

```text
uploads/<random-session-id>/
```

During a real generation it can temporarily contain:

```text
face.jpg / face.png
voice.webm / voice.wav / voice.mp3 / voice.m4a
speech.mp3
raw.mp4
simulation.mp4
```

After successful generation, only `simulation.mp4` remains until the session expires or the participant completes the simulation. On failure, local media is removed. The cleanup timer removes expired session directories.

Provider cleanup is attempted whether generation succeeds or fails:

- ElevenLabs temporary voice: DELETE
- D-ID uploaded image: DELETE
- D-ID uploaded audio: DELETE

## Security controls included

- explicit consent gate
- fixed server-side generated text
- no arbitrary text-generation route
- no public uploads directory
- random 256-bit session token
- token required on participant-session endpoints
- upload size limits
- binary magic-byte validation rather than trusting filename/MIME alone
- local image-dimension validation
- JPEG/PNG only for images
- WAV/MP3/WebM/M4A only for audio
- rate limiting for new simulation sessions
- Helmet security headers / CSP
- no API keys in client JavaScript
- no provider key values in health output
- final-video `no-store` response
- permanent MP4 watermark plus an additional UI disclosure overlay
- provider cleanup in `finally`
- automatic local expiry

## CI

`.github/workflows/ci.yml` checks:

- dependency installation
- media validation unit tests
- Node syntax for backend files
- Vite production build
- complete Docker image build

## Integration with the main security-awareness platform

For the MVP this is a standalone simulator. The next production integration should add a **signed launch token** from the parent platform rather than allowing anonymous public session creation.

Recommended parent-platform claims:

```json
{
  "userId": "EMP1048",
  "campaignId": "CAM2026",
  "module": "deepfake-awareness",
  "tenantId": "TENANT001",
  "exp": 1786600000
}
```

After the awareness lesson, the simulator can call an authenticated completion callback on the parent platform. Do not put employee PII into D-ID `user_data` or provider resource names.

## MVP limitations before enterprise production

The current implementation is intentionally suitable for a single-instance Render proof of concept. Before large-scale tenant deployment, add:

- Redis or a database for session state if horizontally scaling;
- encrypted object storage with short TTLs if jobs can outlive a web instance;
- signed launch tokens from the main awareness platform;
- authenticated completion callbacks;
- tenant-aware quotas and rate limits;
- central audit events that store consent metadata but **not** biometric media;
- provider DPA/privacy review for your target jurisdictions;
- organisation-specific retention policy;
- monitoring and alerting for provider failures;
- queue/worker separation for high concurrency.

## Safety boundary

This project is for authorised participant-facing awareness training. Do not remove the consent gate, fixed-script restriction, cleanup logic or AI-generated disclosure in downstream deployments.
