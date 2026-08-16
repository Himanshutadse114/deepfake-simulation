import { useEffect, useMemo, useRef, useState } from 'react';

const CONSENT_ITEMS = [
  ['faceOwnership', 'I confirm that the photograph I upload is of me.'],
  ['voiceOwnership', 'I confirm that the voice sample I provide is my own voice.'],
  ['processing', 'I consent to temporary processing of my face and voice solely for this security awareness simulation.']
];

const RECORDING_SCRIPT =
  'My voice is being recorded for an authorised cybersecurity awareness simulation. I understand that artificial intelligence can imitate voices and that unexpected requests should always be independently verified.';

const AWARENESS_SCRIPT =
  'Hello, how are you? This is an AI-generated security awareness simulation. But imagine if this message asked you to transfer money, share an OTP, reveal a password, or disclose confidential information. A familiar face and voice do not always prove who is really behind a message. Verify unusual requests through a trusted channel and stay safe.';

const processingLabels = {
  queued: 'Preparing your simulation',
  validating: 'Validating consent and media',
  cloning_voice: 'Creating a temporary voice model',
  generating_audio: 'Generating the fixed awareness message',
  uploading_media: 'Preparing secure animation inputs',
  generating_video: 'Synchronising face and speech',
  watermarking: 'Adding the AI-generated disclosure',
  completed: 'Simulation ready',
  demo_ready: 'Demo mode ready',
  failed: 'Generation failed'
};

async function api(path, options = {}, token) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('x-simulation-token', token);
  if (!(options.body instanceof FormData) && options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

function Stepper({ step }) {
  const labels = ['Consent', 'Face', 'Voice', 'Simulation', 'Learn'];
  return (
    <div className="stepper" aria-label="Simulation progress">
      {labels.map((label, index) => (
        <div className={`step ${step - 1 >= index ? 'active' : ''}`} key={label}>
          <span>{index + 1}</span><small>{label}</small>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState({ faceOwnership: false, voiceOwnership: false, processing: false });
  const [session, setSession] = useState(null);
  const [faceFile, setFaceFile] = useState(null);
  const [facePreview, setFacePreview] = useState('');
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voicePreview, setVoicePreview] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('queued');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const consentComplete = useMemo(() => Object.values(consent).every(Boolean), [consent]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    if (facePreview) URL.revokeObjectURL(facePreview);
    if (voicePreview) URL.revokeObjectURL(voicePreview);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [facePreview, voicePreview]);

  useEffect(() => {
    if (step !== 4 || !session || ['completed', 'failed', 'demo_ready'].includes(status)) return undefined;
    const poll = setInterval(async () => {
      try {
        const result = await api(`/api/simulation/${session.id}/status`, {}, session.token);
        setStatus(result.status);
        setDetail(result.detail || '');
        if (result.status === 'completed' || result.status === 'demo_ready' || result.status === 'failed') clearInterval(poll);
      } catch (pollError) {
        setError(pollError.message);
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [step, session, status]);

  async function beginConsentSession() {
    setError('');
    setBusy(true);
    try {
      const result = await api('/api/simulation/session', {
        method: 'POST',
        body: JSON.stringify({ consents: consent })
      });
      setSession(result);
      setStep(2);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function selectFace(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (facePreview) URL.revokeObjectURL(facePreview);
    setFaceFile(file);
    setFacePreview(URL.createObjectURL(file));
    setError('');
  }

  async function uploadFace() {
    if (!faceFile || !session) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('face', faceFile);
    try {
      const result = await api(`/api/simulation/${session.id}/face`, { method: 'POST', body: form }, session.token);
      if (!result.validation?.usable) throw new Error(result.validation?.reason || 'Please choose a clearer photograph.');
      setStep(3);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferred = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (voicePreview) URL.revokeObjectURL(voicePreview);
        setVoiceBlob(blob);
        setVoicePreview(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      setSeconds(0);
      setRecording(true);
      recorder.start(500);
    } catch {
      setError('Microphone access was not available. You can upload an audio recording instead.');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function uploadVoiceFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (voicePreview) URL.revokeObjectURL(voicePreview);
    setVoiceBlob(file);
    setVoicePreview(URL.createObjectURL(file));
    setSeconds(0);
    setError('');
  }

  async function submitVoiceAndGenerate() {
    if (!voiceBlob || !session) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    const extension = voiceBlob.type.includes('wav') ? 'wav' : voiceBlob.type.includes('mpeg') ? 'mp3' : 'webm';
    form.append('voice', voiceBlob, `voice.${extension}`);
    try {
      await api(`/api/simulation/${session.id}/voice`, { method: 'POST', body: form }, session.token);
      const result = await api(`/api/simulation/${session.id}/generate`, { method: 'POST', body: JSON.stringify({}) }, session.token);
      setStatus(result.status || 'queued');
      setStep(4);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  const reset = async () => {
    if (session) {
      await api(`/api/simulation/${session.id}`, { method: 'DELETE' }, session.token).catch(() => {});
    }
    window.location.reload();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">I</span><div><strong>INNVIKTA</strong><small>Security Awareness</small></div></div>
        <div className="safe-badge">CONSENT-GATED SIMULATION</div>
      </header>

      <section className="stage">
        {step > 0 && <Stepper step={step} />}
        {error && <div className="alert" role="alert">{error}</div>}

        {step === 0 && (
          <div className="hero card">
            <div className="eyebrow">AI IMPERSONATION AWARENESS</div>
            <h1>Would you trust a video that <em>looks and sounds like you?</em></h1>
            <p>This authorised simulation temporarily uses your own photo and voice to demonstrate how convincing AI impersonation can become.</p>
            <div className="hero-grid">
              <div><b>01</b><span>You explicitly consent</span></div>
              <div><b>02</b><span>AI creates a restricted demo</span></div>
              <div><b>03</b><span>You learn how to verify</span></div>
            </div>
            <button className="primary" onClick={() => setStep(1)}>Start Simulation <span>→</span></button>
            <p className="privacy-note">Your media is used only for this simulation and is automatically cleaned up. The generated speech is fixed and cannot be edited.</p>
          </div>
        )}

        {step === 1 && (
          <div className="card narrow">
            <div className="eyebrow">STEP 1 — INFORMED CONSENT</div>
            <h2>Your face. Your voice. Your permission.</h2>
            <p className="muted">All confirmations are required before any media can be uploaded.</p>
            <div className="consent-list">
              {CONSENT_ITEMS.map(([key, text]) => (
                <label className="consent-row" key={key}>
                  <input type="checkbox" checked={consent[key]} onChange={(event) => setConsent({ ...consent, [key]: event.target.checked })} />
                  <span className="checkmark">✓</span><span>{text}</span>
                </label>
              ))}
            </div>
            <div className="notice"><strong>Restricted simulation:</strong> the generated video can say only the pre-approved awareness message shown later. No custom impersonation text is accepted.</div>
            <button className="primary" disabled={!consentComplete || busy} onClick={beginConsentSession}>{busy ? 'Creating secure session…' : 'I Consent — Continue'}</button>
          </div>
        )}

        {step === 2 && (
          <div className="card narrow">
            <div className="eyebrow">STEP 2 — YOUR PHOTO</div>
            <h2>Upload a clear photograph of yourself.</h2>
            <div className={`upload-box ${facePreview ? 'has-preview' : ''}`}>
              {facePreview ? <img src={facePreview} alt="Selected face preview" /> : <div className="upload-icon">◎</div>}
              <div><strong>{faceFile ? faceFile.name : 'Choose a JPG or PNG'}</strong><small>One person · front-facing · good lighting · max 8 MB</small></div>
              <label className="secondary file-button">Choose photo<input type="file" accept="image/jpeg,image/png" onChange={selectFace} /></label>
            </div>
            <button className="primary" disabled={!faceFile || busy} onClick={uploadFace}>{busy ? 'Checking photo…' : 'Use This Photo'}</button>
          </div>
        )}

        {step === 3 && (
          <div className="card narrow">
            <div className="eyebrow">STEP 3 — YOUR VOICE</div>
            <h2>Record a clean sample of your own voice.</h2>
            <p className="muted">For a better clone, aim for about 60 seconds in a quiet room. Read the consent-aware sample below naturally.</p>
            <blockquote>{RECORDING_SCRIPT}</blockquote>
            <div className={`recorder ${recording ? 'recording' : ''}`}>
              <div className="mic">{recording ? '●' : '◉'}</div>
              <div><strong>{recording ? `Recording ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : voiceBlob ? 'Voice sample ready' : 'Microphone ready'}</strong><small>{recording ? 'Speak clearly and naturally' : 'You can re-record before continuing'}</small></div>
              {!recording ? <button className="secondary" onClick={startRecording}>{voiceBlob ? 'Re-record' : 'Record'}</button> : <button className="danger" onClick={stopRecording}>Stop</button>}
            </div>
            <div className="or"><span>or upload an existing recording</span></div>
            <label className="upload-audio">Upload MP3, WAV or WebM<input type="file" accept="audio/*" onChange={uploadVoiceFile} /></label>
            {voicePreview && <audio controls src={voicePreview} className="audio-preview" />}
            <button className="primary" disabled={!voiceBlob || recording || busy} onClick={submitVoiceAndGenerate}>{busy ? 'Uploading securely…' : 'Create My Awareness Simulation'}</button>
          </div>
        )}

        {step === 4 && (
          <div className="card result-card">
            {!['completed', 'demo_ready', 'failed'].includes(status) && (
              <div className="processing">
                <div className="scanner"><div className="scan-line" /></div>
                <div className="eyebrow">GENERATING AUTHORISED SIMULATION</div>
                <h2>{processingLabels[status] || 'Processing'}</h2>
                <p className="muted">{detail || 'Your uploads are being processed temporarily. Do not close this page.'}</p>
                <div className="progress-track"><div className="progress-indeterminate" /></div>
              </div>
            )}
            {status === 'completed' && (
              <>
                <div className="eyebrow warning-text">AI-GENERATED RESULT</div>
                <h2>That looks like you. It is synthetic.</h2>
                <div className="video-frame">
                  <video controls autoPlay playsInline src={`/api/simulation/${session.id}/video?token=${encodeURIComponent(session.token)}`} />
                  <div className="video-watermark">AI-GENERATED SECURITY AWARENESS SIMULATION</div>
                </div>
                <p className="script-note"><strong>The only permitted generated script:</strong> “{AWARENESS_SCRIPT}”</p>
                <button className="primary" onClick={() => setStep(5)}>What just happened? <span>→</span></button>
              </>
            )}
            {status === 'demo_ready' && (
              <>
                <div className="eyebrow">DEMO MODE</div><h2>The workflow completed without calling paid AI providers.</h2>
                <p className="muted">Add the ElevenLabs and D-ID keys and set DEMO_MODE=false to generate the actual talking-head video.</p>
                <button className="primary" onClick={() => setStep(5)}>Continue to Awareness Lesson</button>
              </>
            )}
            {status === 'failed' && (
              <><div className="eyebrow warning-text">GENERATION STOPPED</div><h2>We could not complete this simulation.</h2><p className="muted">{detail || 'The temporary assets have been scheduled for cleanup. Check the server provider configuration and try again.'}</p><button className="secondary" onClick={reset}>Start Again</button></>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="card lesson">
            <div className="eyebrow">THE LESSON</div>
            <h2>A familiar face and voice are no longer enough to prove identity.</h2>
            <div className="lesson-grid">
              <article><b>01</b><h3>Verify requests</h3><p>Contact the person through a known number or a trusted internal channel.</p></article>
              <article><b>02</b><h3>Protect secrets</h3><p>Never share passwords, OTPs, recovery codes or confidential data because a video looks convincing.</p></article>
              <article><b>03</b><h3>Slow down money requests</h3><p>Urgent transfer or gift-card requests deserve independent verification and established approval controls.</p></article>
              <article><b>04</b><h3>Report anomalies</h3><p>Unexpected tone, context, payment details or secrecy requests can be stronger signals than appearance.</p></article>
            </div>
            <div className="final-callout"><strong>Verify the request — not just the face.</strong><span>AI can imitate appearance and voice. Your verification process is the defence.</span></div>
            <button className="primary" onClick={reset}>Complete Simulation</button>
          </div>
        )}
      </section>
      <footer>Authorised security awareness simulation · No arbitrary speech generation · Temporary media processing</footer>
    </main>
  );
}
