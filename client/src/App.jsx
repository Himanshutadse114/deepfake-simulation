import { useEffect, useMemo, useRef, useState } from 'react';

const CONSENT_ITEMS = [
  ['faceOwnership', 'I confirm that the photograph I upload is of me.'],
  ['voiceOwnership', 'I confirm that the voice sample I provide is my own voice.'],
  ['processing', 'I consent to temporary processing of my face and voice solely for this security awareness simulation.']
];

const RECORDING_SCRIPT =
  'My voice is being recorded for an authorised cybersecurity awareness simulation. I understand that AI can imitate voices, and unexpected requests should be independently verified.';

const AWARENESS_SCRIPT =
  'This is an AI-generated security awareness simulation. A familiar face or voice can be faked. Verify unusual requests through a trusted channel before acting.';

const DEEPFAKE_QUESTIONS = [
  {
    question: 'A video call looks and sounds exactly like your manager and asks for an urgent transfer. What should you do first?',
    options: [
      'Act quickly because the face and voice match',
      'Verify the request through a known, independent channel',
      'Ask the caller to repeat the request twice'
    ],
    answer: 1,
    explanation: 'Appearance and voice are no longer reliable proof of identity. Independent verification is stronger.'
  },
  {
    question: 'Which signal is the safest basis for deciding whether a sensitive request is genuine?',
    options: [
      'Perfect lip-sync',
      'A familiar speaking style',
      'A trusted verification process outside the message or call'
    ],
    answer: 2,
    explanation: 'Deepfakes can imitate visual and vocal cues. A known verification process is harder to fake.'
  },
  {
    question: 'What should you do if a familiar-looking video asks for a password, OTP or recovery code?',
    options: [
      'Share it only if the video quality is high',
      'Never share it and report the unusual request',
      'Send part of the code first to test the person'
    ],
    answer: 1,
    explanation: 'Passwords, OTPs and recovery codes should not be shared because of a video or voice request.'
  }
];

const PROFILE_QUESTIONS = [
  {
    question: 'Why can a synthetic social profile become convincing even when it started from only one real photograph?',
    options: [
      'AI can create a consistent-looking set of new images and social context',
      'Follower counts automatically prove identity',
      'A profile photo is verified by default'
    ],
    answer: 0,
    explanation: 'A believable set of photos, bio and social proof can manufacture familiarity even when the account is fake.'
  },
  {
    question: 'A new profile using a colleague’s face messages you for confidential information. What is the safest response?',
    options: [
      'Reply because the photos look authentic',
      'Verify with the colleague through a known channel and report the suspicious account',
      'Check whether the account has more than 1,000 followers'
    ],
    answer: 1,
    explanation: 'Verify the person through a channel you already trust, then report the suspected impersonation.'
  },
  {
    question: 'Which habit best reduces impersonation risk?',
    options: [
      'Trust profiles with professional photos',
      'Publish more personal details so people can recognise you',
      'Limit unnecessary public personal data and verify unusual requests independently'
    ],
    answer: 2,
    explanation: 'Reducing exposed personal material and using independent verification makes impersonation harder to exploit.'
  }
];

const processingLabels = {
  queued: 'Preparing your simulation',
  validating: 'Validating consent and media',
  cloning_voice: 'Cloning the consented voice sample',
  generating_audio: 'Generating the fixed awareness message',
  uploading_media: 'Preparing secure animation inputs',
  generating_video: 'Synchronising face and speech',
  watermarking: 'Adding the AI-generated disclosure',
  completed: 'Deepfake demo ready',
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

function stageIndex(step) {
  if (step <= 1) return 0;
  if (step === 2) return 1;
  if (step === 3) return 2;
  if (step <= 5) return 3;
  if (step === 6) return 4;
  return 5;
}

function Stepper({ step }) {
  const labels = ['Consent', 'Photo', 'Voice', 'Deepfake', 'Impersonation', 'Complete'];
  const activeIndex = stageIndex(step);
  return (
    <div className="stepper" aria-label="Module progress">
      {labels.map((label, index) => (
        <div className={`step ${activeIndex >= index ? 'active' : ''}`} key={label}>
          <span>{index + 1}</span><small>{label}</small>
        </div>
      ))}
    </div>
  );
}

function scoreQuestions(questions, answers) {
  return questions.reduce((score, item, index) => score + (answers[index] === item.answer ? 1 : 0), 0);
}

function KnowledgeCheck({ title, intro, questions, answers, setAnswers, submitted, onSubmit }) {
  const allAnswered = questions.every((_, index) => Number.isInteger(answers[index]));
  const score = scoreQuestions(questions, answers);

  return (
    <section className="knowledge-card">
      <div className="quiz-heading">
        <div>
          <span className="micro-label">KNOWLEDGE CHECK</span>
          <h3>{title}</h3>
          <p>{intro}</p>
        </div>
        {submitted && <div className="score-chip">{score}/{questions.length}</div>}
      </div>

      <div className="question-list">
        {questions.map((item, questionIndex) => (
          <article className="question" key={item.question}>
            <div className="question-number">{String(questionIndex + 1).padStart(2, '0')}</div>
            <div className="question-body">
              <strong>{item.question}</strong>
              <div className="answer-options">
                {item.options.map((option, optionIndex) => {
                  const selected = answers[questionIndex] === optionIndex;
                  const correct = submitted && optionIndex === item.answer;
                  const wrongSelected = submitted && selected && optionIndex !== item.answer;
                  return (
                    <button
                      type="button"
                      key={option}
                      disabled={submitted}
                      className={`answer-option ${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrongSelected ? 'wrong' : ''}`}
                      onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))}
                    >
                      <span className="answer-dot">{selected ? '●' : '○'}</span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className={`answer-explanation ${answers[questionIndex] === item.answer ? 'good' : 'review'}`}>
                  {answers[questionIndex] === item.answer ? 'Correct. ' : 'Review: '}{item.explanation}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      {!submitted ? (
        <button className="primary" disabled={!allAnswered} onClick={onSubmit}>Check My Answers</button>
      ) : (
        <div className="quiz-complete">Knowledge check complete · {score} of {questions.length} correct</div>
      )}
    </section>
  );
}

function DeepfakeLearningPanel() {
  return (
    <div className="learning-panel">
      <span className="micro-label danger-label">DEEPFAKE VIDEO + AUDIO</span>
      <h2>This demo warned you. A real deepfake probably will not.</h2>
      <p className="lead-copy">
        Your consented voice sample was cloned and your portrait was animated to deliver a fixed message. A criminal can use the same idea to create urgency, trust or authority around a fraudulent request.
      </p>

      <div className="threat-flow">
        <div><b>1</b><span>Collect public photo or audio</span></div>
        <i>→</i>
        <div><b>2</b><span>Create synthetic face or voice</span></div>
        <i>→</i>
        <div><b>3</b><span>Attach a high-pressure request</span></div>
      </div>

      <div className="learning-block">
        <h3>What could a real attacker try?</h3>
        <ul>
          <li>Impersonate an executive, colleague, family member or trusted supplier.</li>
          <li>Ask for money, OTPs, credentials, confidential files or a change in payment details.</li>
          <li>Use a convincing video or voice call to bypass the doubt you would normally have about a text message.</li>
        </ul>
      </div>

      <div className="defence-box">
        <span>THE DEFENCE</span>
        <strong>Verify the request, not the face.</strong>
        <p>Use a known phone number, approved internal channel or established approval process before acting on an unusual request.</p>
      </div>

      <div className="tip-row">
        <div><b>Do not rely on glitches</b><span>Good deepfakes may have no obvious visual or audio mistakes.</span></div>
        <div><b>Slow down urgency</b><span>Pressure, secrecy and unusual timing are signals to verify.</span></div>
        <div><b>Protect secrets</b><span>Never disclose passwords, OTPs or recovery codes because someone looks familiar.</span></div>
      </div>
    </div>
  );
}

function SocialProfile({ session, facePreview, variantCount }) {
  const token = encodeURIComponent(session.token);
  const variantUrl = (index) => `/api/simulation/${session.id}/variant/${index}?token=${token}`;
  const avatar = facePreview || (variantCount ? variantUrl(0) : '');

  return (
    <div className="social-device" aria-label="Simulated social-media impersonation profile">
      <div className="social-safety-banner">SIMULATED PROFILE · AI-GENERATED AWARENESS DEMO</div>
      <div className="social-toolbar"><span>‹</span><strong>yourname.ai_demo</strong><span>•••</span></div>
      <div className="social-profile-head">
        <div className="avatar-ring">{avatar ? <img src={avatar} alt="Consented participant profile preview" /> : <span>AI</span>}</div>
        <div className="social-stat"><b>{variantCount}</b><small>posts</small></div>
        <div className="social-stat"><b>12.8K</b><small>followers</small></div>
        <div className="social-stat"><b>642</b><small>following</small></div>
      </div>
      <div className="social-bio">
        <strong>Demo Profile</strong>
        <span>Work · Travel · Everyday life</span>
        <span className="social-link">example.invalid/synthetic-profile</span>
      </div>
      <div className="social-actions"><button type="button">Follow</button><button type="button">Message</button></div>
      <div className="social-tabs"><span className="active">▦ POSTS</span><span>▱ TAGGED</span></div>
      <div className="social-grid">
        {Array.from({ length: variantCount }, (_, index) => (
          <div className="social-post" key={index}>
            <img src={variantUrl(index)} alt={`AI-generated synthetic social profile variant ${index + 1}`} />
            <span>AI</span>
          </div>
        ))}
      </div>
      <div className="social-caption"><b>Awareness demo:</b> these posts were generated from one consented photograph and were never published to a real social network.</div>
    </div>
  );
}

function ProfileLearningPanel() {
  return (
    <div className="learning-panel profile-learning">
      <span className="micro-label">PROFILE IMPERSONATION</span>
      <h2>One photo can be turned into a believable online identity.</h2>
      <p className="lead-copy">
        FLUX created four synthetic photos with different settings from the single image you provided. Combined with a bio, follower count and messages, that visual consistency can make a fake account feel familiar.
      </p>

      <div className="profile-risk-cards">
        <article><span>01</span><h3>Manufacture familiarity</h3><p>Multiple believable photos can make a new account look established rather than newly created.</p></article>
        <article><span>02</span><h3>Build social proof</h3><p>Names, bios, follower counts and copied public information can be arranged to look credible.</p></article>
        <article><span>03</span><h3>Move to the scam</h3><p>Once trust is established, the impersonator may request data, money, access or a move to another channel.</p></article>
      </div>

      <div className="learning-block">
        <h3>How to stay safer</h3>
        <ul>
          <li>Verify unexpected accounts or messages with the person through a channel you already know.</li>
          <li>Review privacy settings and avoid publishing unnecessary personal details that make impersonation easier to enrich.</li>
          <li>Do not treat follower counts, profile photos or a familiar biography as proof of identity.</li>
          <li>Report fake profiles and suspicious outreach through your organisation’s reporting process and the platform’s impersonation tools.</li>
        </ul>
      </div>

      <div className="defence-box compact">
        <span>REMEMBER</span>
        <strong>Digital familiarity can be manufactured.</strong>
        <p>Use identity verification and trusted communication paths when a request matters.</p>
      </div>
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
  const [voiceSource, setVoiceSource] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState('queued');
  const [detail, setDetail] = useState('');
  const [profileStatus, setProfileStatus] = useState('idle');
  const [profileDetail, setProfileDetail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [variantCount, setVariantCount] = useState(0);
  const [deepfakeAnswers, setDeepfakeAnswers] = useState({});
  const [profileAnswers, setProfileAnswers] = useState({});
  const [deepfakeSubmitted, setDeepfakeSubmitted] = useState(false);
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const consentComplete = useMemo(() => Object.values(consent).every(Boolean), [consent]);
  const deepfakeScore = useMemo(() => scoreQuestions(DEEPFAKE_QUESTIONS, deepfakeAnswers), [deepfakeAnswers]);
  const profileScore = useMemo(() => scoreQuestions(PROFILE_QUESTIONS, profileAnswers), [profileAnswers]);
  const totalScore = deepfakeScore + profileScore;
  const maxScore = DEEPFAKE_QUESTIONS.length + PROFILE_QUESTIONS.length;

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
    if (!session) return undefined;
    const videoNeedsPolling = step === 4 && !['completed', 'failed', 'demo_ready'].includes(status);
    const profileNeedsPolling = step === 6 && ['queued', 'generating'].includes(profileStatus);
    if (!videoNeedsPolling && !profileNeedsPolling) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api(`/api/simulation/${session.id}/status`, {}, session.token);
        if (cancelled) return;
        setStatus(result.status);
        setDetail(result.detail || '');
        setProfileStatus(result.profileStatus || 'idle');
        setProfileDetail(result.profileDetail || '');
        setProfileError(result.profileError || '');
        setVariantCount(Number(result.variantCount || 0));
      } catch (pollError) {
        if (!cancelled) setError(pollError.message);
      }
    };

    poll();
    const timer = setInterval(poll, 2200);
    return () => { cancelled = true; clearInterval(timer); };
  }, [step, session, status, profileStatus]);

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
        setVoiceSource('recorded');
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
    if (seconds < 5) setError('A longer sample usually gives a stronger voice match. Aim for at least 10 seconds if possible.');
  }

  function uploadVoiceFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (voicePreview) URL.revokeObjectURL(voicePreview);
    setVoiceBlob(file);
    setVoicePreview(URL.createObjectURL(file));
    setVoiceSource('uploaded');
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
    if (voiceSource === 'recorded') form.append('referenceText', RECORDING_SCRIPT);

    try {
      await api(`/api/simulation/${session.id}/voice`, { method: 'POST', body: form }, session.token);
      const result = await api(`/api/simulation/${session.id}/generate`, { method: 'POST', body: JSON.stringify({}) }, session.token);
      setStatus(result.status || 'queued');
      setDetail('Your restricted deepfake demo is being generated.');
      setStep(4);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function beginProfileStage() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/simulation/${session.id}/profile/generate`, { method: 'POST', body: JSON.stringify({}) }, session.token);
      setProfileStatus(result.profileStatus || 'queued');
      if (Number.isFinite(result.variantCount)) setVariantCount(result.variantCount);
      setProfileDetail('Creating four synthetic social-profile images from your consented portrait.');
      setProfileError('');
      setStep(6);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function retryProfileGeneration() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/api/simulation/${session.id}/profile/generate`, { method: 'POST', body: JSON.stringify({}) }, session.token);
      setProfileStatus(result.profileStatus || 'queued');
      setProfileError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishModule() {
    setBusy(true);
    if (session) {
      await api(`/api/simulation/${session.id}`, { method: 'DELETE' }, session.token).catch(() => {});
    }
    setSession(null);
    setBusy(false);
    setStep(7);
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
        <div className="brand"><span className="brand-mark">I</span><div><strong>INNVIKTA</strong><small>AI IMPERSONATION AWARENESS</small></div></div>
        <div className="safe-badge">CONSENT-GATED · FIXED SCRIPT · TEMPORARY MEDIA</div>
      </header>

      <section className="stage">
        {step > 0 && <Stepper step={step} />}
        {error && <div className="alert" role="alert">{error}</div>}

        {step === 0 && (
          <div className="hero card">
            <div className="eyebrow">INTERACTIVE DEEPFAKE AWARENESS</div>
            <h1>See how quickly <em>digital trust can be manufactured.</em></h1>
            <p>Use your own photo and voice, with explicit consent, to experience two controlled demonstrations: a synthetic talking-head video and a simulated impersonation profile.</p>
            <div className="hero-grid four">
              <div><b>01</b><span>Give informed consent</span></div>
              <div><b>02</b><span>Experience a deepfake demo</span></div>
              <div><b>03</b><span>See a synthetic profile</span></div>
              <div><b>04</b><span>Learn how to verify safely</span></div>
            </div>
            <button className="primary hero-cta" onClick={() => setStep(1)}>Start Awareness Module <span>→</span></button>
            <p className="privacy-note">The generated speech is fixed and benign. Your media is processed only for this authorised module and is automatically cleaned up.</p>
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
            <div className="notice"><strong>Restricted simulation:</strong> the video can say only the pre-approved awareness message. The synthetic profile is displayed only inside this module and is never published.</div>
            <button className="primary" disabled={!consentComplete || busy} onClick={beginConsentSession}>{busy ? 'Creating secure session…' : 'I Consent — Continue'}</button>
          </div>
        )}

        {step === 2 && (
          <div className="card narrow">
            <div className="eyebrow">STEP 2 — YOUR PHOTO</div>
            <h2>Upload one clear photograph of yourself.</h2>
            <p className="muted">This same consented portrait will later demonstrate how AI can manufacture additional social-profile photos.</p>
            <div className={`upload-box ${facePreview ? 'has-preview' : ''}`}>
              {facePreview ? <img src={facePreview} alt="Selected participant preview" /> : <div className="upload-icon">◎</div>}
              <div><strong>{faceFile ? faceFile.name : 'Choose a JPG or PNG'}</strong><small>One person · front-facing preferred · good lighting · max 8 MB</small></div>
              <label className="secondary file-button">Choose photo<input type="file" accept="image/jpeg,image/png" onChange={selectFace} /></label>
            </div>
            <button className="primary" disabled={!faceFile || busy} onClick={uploadFace}>{busy ? 'Checking photo…' : 'Use This Photo'}</button>
          </div>
        )}

        {step === 3 && (
          <div className="card narrow">
            <div className="eyebrow">STEP 3 — YOUR VOICE</div>
            <h2>Record a short, clean sample of your own voice.</h2>
            <p className="muted">Qwen3-TTS can clone from short reference audio. For better consistency, aim for around 10–20 seconds in a quiet room and read the sample below naturally.</p>
            <blockquote>{RECORDING_SCRIPT}</blockquote>
            <div className={`recorder ${recording ? 'recording' : ''}`}>
              <div className="mic">{recording ? '●' : '◉'}</div>
              <div><strong>{recording ? `Recording ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : voiceBlob ? 'Voice sample ready' : 'Microphone ready'}</strong><small>{recording ? 'Speak clearly and naturally' : 'You can re-record before continuing'}</small></div>
              {!recording ? <button className="secondary" onClick={startRecording}>{voiceBlob ? 'Re-record' : 'Record'}</button> : <button className="danger" onClick={stopRecording}>Stop</button>}
            </div>
            <div className="or"><span>or upload an existing recording</span></div>
            <label className="upload-audio">Upload MP3, WAV or WebM<input type="file" accept="audio/*" onChange={uploadVoiceFile} /></label>
            {voicePreview && <audio controls src={voicePreview} className="audio-preview" />}
            <div className="fixed-script-preview"><span>THE GENERATED VIDEO CAN ONLY SAY</span><p>“{AWARENESS_SCRIPT}”</p></div>
            <button className="primary" disabled={!voiceBlob || recording || busy} onClick={submitVoiceAndGenerate}>{busy ? 'Uploading securely…' : 'Generate My Deepfake Demo'}</button>
          </div>
        )}

        {step === 4 && (
          <div className="card result-card generation-card">
            {!['completed', 'demo_ready', 'failed'].includes(status) && (
              <div className="processing" aria-live="polite">
                <div className="scanner"><div className="scan-line" /></div>
                <div className="eyebrow">GENERATING AUTHORISED DEEPFAKE DEMO</div>
                <h2>{processingLabels[status] || 'Processing'}</h2>
                <p className="muted">{detail || 'Your uploads are being processed temporarily. Keep this page open.'}</p>
                <div className="provider-track">
                  <span className={['cloning_voice', 'generating_video', 'watermarking', 'completed'].includes(status) ? 'done' : ''}>Qwen voice clone</span>
                  <i>→</i>
                  <span className={['generating_video', 'watermarking', 'completed'].includes(status) ? 'done' : ''}>Pruna video</span>
                  <i>→</i>
                  <span className={['watermarking', 'completed'].includes(status) ? 'done' : ''}>Permanent disclosure</span>
                </div>
                <div className="progress-track"><div className="progress-indeterminate" /></div>
              </div>
            )}
            {status === 'completed' && (
              <div className="ready-state">
                <div className="ready-icon">✓</div>
                <div className="eyebrow">DEEPFAKE DEMO READY</div>
                <h2>The video is only the beginning of the lesson.</h2>
                <p className="muted">Next, compare what you just generated with the risks of real-world voice and video impersonation.</p>
                <button className="primary" onClick={() => setStep(5)}>View Demo & Learn <span>→</span></button>
              </div>
            )}
            {status === 'demo_ready' && (
              <div className="ready-state">
                <div className="eyebrow">DEMO MODE</div><h2>The workflow completed without calling paid AI providers.</h2>
                <p className="muted">Set DEMO_MODE=false and configure the Replicate token to generate Qwen voice, Pruna video and FLUX profile assets.</p>
                <button className="secondary" onClick={reset}>Start Again</button>
              </div>
            )}
            {status === 'failed' && (
              <div className="ready-state"><div className="eyebrow warning-text">GENERATION STOPPED</div><h2>We could not complete the deepfake demo.</h2><p className="muted">{detail || 'Temporary assets have been cleaned up. Check provider configuration and try again.'}</p><button className="secondary" onClick={reset}>Start Again</button></div>
            )}
          </div>
        )}

        {step === 5 && status === 'completed' && session && (
          <div className="module-page">
            <div className="module-title-row">
              <div><div className="eyebrow">MODULE 1 — DEEPFAKE VIDEO & AUDIO</div><h1 className="module-title">Looks familiar. Sounds familiar. <em>Still not proof.</em></h1></div>
              <div className="module-tag">QWEN + PRUNA DEMO</div>
            </div>

            <div className="demo-learning-grid">
              <div className="demo-column">
                <div className="video-frame large">
                  <video controls autoPlay playsInline src={`/api/simulation/${session.id}/video?token=${encodeURIComponent(session.token)}`} />
                  <div className="video-watermark">AI-GENERATED SECURITY AWARENESS SIMULATION</div>
                </div>
                <div className="demo-evidence">
                  <div><span>VOICE</span><b>Qwen3-TTS</b><small>Cloned speaker characteristics from your consented reference sample.</small></div>
                  <div><span>VIDEO</span><b>Pruna</b><small>Animated your original portrait to match the synthetic fixed audio.</small></div>
                  <div><span>SAFEGUARD</span><b>Permanent disclosure</b><small>This training output is visibly marked as AI-generated.</small></div>
                </div>
                <p className="script-note"><strong>Fixed generated script:</strong> “{AWARENESS_SCRIPT}”</p>
              </div>
              <DeepfakeLearningPanel />
            </div>

            <KnowledgeCheck
              title="Could you respond safely to a convincing deepfake?"
              intro="Answer all three questions. There is no pass/fail here—the aim is to practise the verification habit."
              questions={DEEPFAKE_QUESTIONS}
              answers={deepfakeAnswers}
              setAnswers={setDeepfakeAnswers}
              submitted={deepfakeSubmitted}
              onSubmit={() => setDeepfakeSubmitted(true)}
            />

            {deepfakeSubmitted && (
              <div className="module-next">
                <div><span>NEXT DEMONSTRATION</span><strong>What if one photograph became an entire social profile?</strong></div>
                <button className="primary" disabled={busy} onClick={beginProfileStage}>{busy ? 'Starting FLUX…' : 'Create Synthetic Profile Demo'} <span>→</span></button>
              </div>
            )}
          </div>
        )}

        {step === 6 && session && (
          <div className="module-page">
            {['idle', 'queued', 'generating'].includes(profileStatus) && (
              <div className="card profile-processing" aria-live="polite">
                <div className="social-skeleton">
                  <div className="skeleton-avatar" />
                  <div className="skeleton-lines"><i /><i /><i /></div>
                  <div className="skeleton-grid">{[0, 1, 2, 3].map((item) => <span key={item} />)}</div>
                </div>
                <div>
                  <div className="eyebrow">MODULE 2 — BUILDING THE IMPERSONATION DEMO</div>
                  <h2>One photo is becoming four synthetic social photos.</h2>
                  <p className="muted">{profileDetail || 'FLUX.2 Pro is creating identity-consistent images in different generic settings. Requests are made sequentially to reduce unnecessary provider throttling.'}</p>
                  <div className="progress-track left"><div className="progress-indeterminate" /></div>
                </div>
              </div>
            )}

            {profileStatus === 'failed' && (
              <div className="card result-card">
                <div className="eyebrow warning-text">PROFILE DEMO STOPPED</div>
                <h2>FLUX could not complete the synthetic profile images.</h2>
                <p className="muted">{profileError || profileDetail || 'The video learning module is still complete. You can retry the profile image stage.'}</p>
                <button className="primary" disabled={busy} onClick={retryProfileGeneration}>{busy ? 'Retrying…' : 'Retry FLUX Generation'}</button>
              </div>
            )}

            {profileStatus === 'completed' && (
              <>
                <div className="module-title-row">
                  <div><div className="eyebrow">MODULE 2 — SYNTHETIC PROFILE IMPERSONATION</div><h1 className="module-title">One real photo. <em>Four invented moments.</em></h1></div>
                  <div className="module-tag">FLUX.2 PRO DEMO</div>
                </div>

                <div className="profile-learning-grid">
                  <SocialProfile session={session} facePreview={facePreview} variantCount={variantCount} />
                  <ProfileLearningPanel />
                </div>

                <KnowledgeCheck
                  title="Can you recognise the trust tricks around a fake profile?"
                  intro="Focus on verification behaviour, not just whether an image looks artificial."
                  questions={PROFILE_QUESTIONS}
                  answers={profileAnswers}
                  setAnswers={setProfileAnswers}
                  submitted={profileSubmitted}
                  onSubmit={() => setProfileSubmitted(true)}
                />

                {profileSubmitted && (
                  <div className="module-next finish-next">
                    <div><span>MODULE SCORE</span><strong>{totalScore} / {maxScore} knowledge-check answers correct</strong><small>No pass/fail is declared here. The key outcome is knowing when and how to verify.</small></div>
                    <button className="primary" disabled={busy} onClick={finishModule}>{busy ? 'Cleaning temporary media…' : 'Complete Module'} <span>→</span></button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 7 && (
          <div className="card completion-card">
            <div className="completion-orbit"><span>✓</span></div>
            <div className="eyebrow">AI IMPERSONATION AWARENESS COMPLETE</div>
            <h1 className="completion-title">Trust the process, <em>not just the pixels.</em></h1>
            <p>You experienced how a voice, a talking-head video and a believable social profile can be synthesised from limited personal media. Temporary server-side simulation assets have been cleaned up.</p>
            <div className="completion-score"><span>KNOWLEDGE CHECK</span><strong>{totalScore}<small>/{maxScore}</small></strong></div>
            <div className="takeaway-grid">
              <article><b>01</b><h3>Verify unusual requests</h3><p>Use a known phone number, trusted internal channel or established approval process.</p></article>
              <article><b>02</b><h3>Protect sensitive information</h3><p>Never provide passwords, OTPs, recovery codes, payment approvals or confidential data because a face or voice seems familiar.</p></article>
              <article><b>03</b><h3>Question manufactured familiarity</h3><p>Photos, bios, follower counts and even live-looking video can be synthetic or copied.</p></article>
              <article><b>04</b><h3>Report impersonation</h3><p>Escalate suspicious accounts, unusual calls and synthetic-media scams through approved reporting channels.</p></article>
            </div>
            <div className="final-callout"><strong>Verify the request — not just the face.</strong><span>AI can imitate appearance and voice. A trusted verification process is your defence.</span></div>
            <button className="secondary restart-button" onClick={() => window.location.reload()}>Restart Module</button>
          </div>
        )}
      </section>
      <footer>Authorised security awareness simulation · Participant-owned media only · Fixed benign speech · Temporary processing · AI-generated outputs disclosed</footer>
    </main>
  );
}
