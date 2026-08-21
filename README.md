# Innvikta AI Impersonation Awareness Simulation

A consent-gated security-awareness module that demonstrates how a participant's **own** photo and voice can be repackaged across a cloned WhatsApp-style voice note, an AI talking-head video, and a synthetic social profile.

The production UI follows the supplied `Innvikta_Deepfake_Awareness_UI_Updated (2).html` flow. The active AI stack is Qwen3-TTS + Pruna + FLUX.2 Pro on Replicate.

## Safety boundary

This project is intentionally restricted to authorised participant-facing awareness training:

- all consent confirmations are required before media upload;
- the participant confirms the photograph and voice sample are their own;
- administrator-configured scripts are accepted only when they pass the awareness and sensitive-request policy;
- server-side policy rejects direct instructions to send/approve money or disclose passwords, OTPs, credentials, security codes, payment approvals, etc.;
- scripts are capped at 180 characters so generated clips remain short;
- reference audio is capped at 45 seconds; the separate WhatsApp and video audio tracks must each be 10 seconds or less or generation stops before Pruna is called; the delivered video is hard-capped at 10 seconds;
- paid predictions are not automatically retried;
- generated video carries a permanent `AI-GENERATED SECURITY AWARENESS SIMULATION` disclosure;
- generated social images remain inside the module and are not published to a real social network;
- provider secrets stay server-side;
- participant media and generated outputs are temporary and removed on completion/expiry;
- no biometric identity verification or demographic inference is performed.

## Learner flow

1. Introduction
2. Informed consent
3. Media setup
   - first name and surname
   - JPEG/PNG portrait upload or camera capture
   - voice upload or browser recording
   - **WhatsApp audio script**
   - **Deepfake video audio script**
4. Generation
   - Qwen creates two checked voice-clone tracks: one from the admin WhatsApp script and one from the admin video script
   - each track is verified at 10 seconds or less before Pruna can be called
   - FFmpeg burns the permanent AI disclosure
   - FLUX.2 Pro is not called during initial generation
5. WhatsApp-style voice impersonation experience
6. Incoming WhatsApp video-call experience using the Pruna MP4
7. Follow-on social-engineering chat context
8. Optional, separately confirmed FLUX profile generation, or a no-cost profile lesson using the uploaded portrait
9. Unified learning/analysis screen
10. Nine-question knowledge check (video, voice, profile)
11. Completion score and cleanup

## Internal demo mode

The first screen includes **Internal demo mode · no AI**.

It uses the same UI and backend session lifecycle but does **not** call Qwen, Pruna, FLUX, D-ID, HeyGen, ElevenLabs or any other AI provider. The uploaded participant photo is used as the visual placeholder, the uploaded voice sample is played in the audio positions, and the profile grid reuses the uploaded portrait. This makes it possible to review the complete production flow without spending provider credits.

`DEMO_MODE=true` still exists as a global server-side override and forces every session into no-AI mode. The UI button is a per-session demo mode and works even when the server is normally configured for real generation.

## Active AI stack

```text
Admin WhatsApp script ──→ Qwen3-TTS ──→ checked WhatsApp audio (≤10 s)

Admin video script ─────→ Qwen3-TTS ──→ checked video audio (≤10 s)
                                                │
Participant-owned portrait ─────────────────────┤
                                                ↓
                                        Pruna p-video-avatar
                                      ↓
                              FFmpeg disclosure
                                      ↓
                               Deepfake video

Participant separately approves optional paid profile generation
        ↓
Participant-owned portrait
        ↓
FLUX.2 Pro (4 sequential images)
        ↓
Synthetic Instagram-style profile
```

### Models

```text
Voice:  qwen/qwen3-tts
Video:  prunaai/p-video-avatar
Images: black-forest-labs/flux-2-pro
```

All three active services use the same `REPLICATE_API_TOKEN`.

## Environment

Copy `.env.example` to `.env` and configure at minimum:

```env
DEMO_MODE=false
REPLICATE_API_TOKEN=your_fresh_replicate_token

VOICE_PROVIDER=qwen
QWEN_MODEL=qwen/qwen3-tts
QWEN_LANGUAGE=auto
MAX_REFERENCE_AUDIO_SECONDS=45
MAX_GENERATED_AUDIO_SECONDS=10
MAX_VIDEO_SECONDS=10

VIDEO_PROVIDER_PREFERENCE=pruna
PRUNA_MODEL=prunaai/p-video-avatar
PRUNA_RESOLUTION=720p

FLUX_ENABLED=true
FLUX_MODEL=black-forest-labs/flux-2-pro
FLUX_GRID_IMAGES=4
```

The initial AI confirmation covers two Qwen predictions and one Pruna prediction. Pruna is not called if either generated audio track exceeds 10 seconds. The four FLUX calls have their own confirmation later in the learner flow; declining continues with the original portrait at no additional provider cost.

Optional legacy/fallback providers remain in the codebase but are disabled by default.

## API flow

### Create a session

```http
POST /api/simulation/session
Content-Type: application/json
```

```json
{
  "mode": "ai",
  "consents": {
    "faceOwnership": true,
    "voiceOwnership": true,
    "processing": true
  },
  "participant": {
    "firstName": "Alex",
    "lastName": "Morgan"
  },
  "scripts": {
    "whatsapp": "This is an AI voice-clone awareness demo. A familiar voice can be faked, so verify unusual requests through a trusted channel.",
    "video": "This is an AI-generated deepfake security simulation. A familiar face and voice are not proof of identity; verify before acting."
  }
}
```

Use `"mode":"demo"` for the internal no-AI path.

Subsequent routes require `x-simulation-token` or the token query parameter for media playback.

### Upload media

```http
POST /api/simulation/:id/face
POST /api/simulation/:id/voice
```

### Generate

```http
POST /api/simulation/:id/generate
GET  /api/simulation/:id/status
```

### Private generated assets

```http
GET /api/simulation/:id/audio/whatsapp?token=...
GET /api/simulation/:id/audio/video?token=...
GET /api/simulation/:id/video?token=...
GET /api/simulation/:id/variant/0?token=...
```

All media responses use `private, no-store`. The video endpoint is intentionally unavailable for no-AI demo sessions because no synthetic video is created.

### Cleanup

```http
DELETE /api/simulation/:id
```

The UI calls this on module completion/reset. Expiry cleanup is also enforced server-side.

## Local development

```bash
npm install
npm --prefix client install
npm run dev
```

Backend defaults to `http://localhost:10000`; Vite handles the client development server.

For provider-free review, click **Internal demo mode · no AI** in the UI, or set `DEMO_MODE=true` globally.

## Build and test

```bash
npm test
npm --prefix client run build
```

CI additionally performs Node syntax checks, a Docker build, and the FFmpeg watermark smoke test.

## Data lifecycle

A real session can temporarily contain:

```text
face.jpg / face.png
voice.webm / voice.wav / voice.mp3 / voice.m4a
whatsapp-speech.wav
video-speech.wav
raw.mp4
simulation.mp4
variant-1.jpg ... variant-4.jpg
```

After successful real generation, the original participant photo/voice and raw video are removed; only the generated learner assets remain until completion or expiry. In internal demo mode the uploaded media is retained only for the lifetime of that demo session because it is itself the placeholder media.

## Deployment

Render should deploy the `main` branch. No new secret is required for the UI or per-session demo mode. Real Qwen + Pruna + FLUX generation requires a valid Replicate token.
