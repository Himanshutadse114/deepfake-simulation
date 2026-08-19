import './voice-deepfake.css';

export const VOICE_QUESTIONS = [
  {
    question: 'A voice note sounds exactly like someone you know and asks for an urgent payment. What is the safest first action?',
    options: [
      'Pay quickly because the voice sounds genuine',
      'Verify the request through a known, independent channel',
      'Ask for another voice note as proof'
    ],
    answer: 1,
    explanation: 'A familiar voice is no longer reliable identity proof. Verify using a channel or process you already trust.'
  },
  {
    question: 'Why can an AI-cloned voice note be especially convincing?',
    options: [
      'People often associate a familiar voice with trust and urgency',
      'Messaging apps automatically verify every speaker',
      'Synthetic audio always contains an obvious robotic sound'
    ],
    answer: 0,
    explanation: 'A familiar voice can create immediate trust, while high-quality synthetic audio may not contain obvious warning signs.'
  },
  {
    question: 'A familiar-sounding voice message asks for an OTP, password or recovery code. What should you do?',
    options: [
      'Share it if the caller knows personal details',
      'Share only part of the code',
      'Do not share it; verify separately and report the suspicious request'
    ],
    answer: 2,
    explanation: 'Passwords, OTPs and recovery codes should never be disclosed because a voice sounds familiar.'
  }
];

export function WhatsAppVoiceDemo({ session }) {
  const audioUrl = `/api/simulation/${session.id}/audio?token=${encodeURIComponent(session.token)}`;

  return (
    <div className="wa-phone" aria-label="Simulated messaging-app voice deepfake demonstration">
      <div className="wa-safety">SIMULATED CHAT · AI-GENERATED AWARENESS DEMO</div>
      <div className="wa-header">
        <span className="wa-back">‹</span>
        <div className="wa-avatar">AI</div>
        <div className="wa-contact"><strong>Familiar Contact</strong><small>online</small></div>
        <span className="wa-actions">⌕ ⋮</span>
      </div>
      <div className="wa-chat">
        <div className="wa-date">TODAY</div>
        <div className="wa-bubble received">
          <p>Hey, I’m sending you a quick voice note.</p>
          <span>10:41</span>
        </div>
        <div className="wa-bubble voice received">
          <div className="wa-voice-row">
            <div className="wa-play">▶</div>
            <div className="wa-wave" aria-hidden="true">
              {Array.from({ length: 28 }, (_, index) => <i key={index} style={{ height: `${8 + ((index * 7) % 25)}px` }} />)}
            </div>
            <div className="wa-mic">◉</div>
          </div>
          <audio controls preload="metadata" src={audioUrl} className="wa-audio" />
          <div className="wa-meta"><span>AI-cloned fixed awareness audio</span><span>10:42 ✓✓</span></div>
        </div>
        <div className="wa-bubble warning-bubble">
          <strong>Imagine the same familiar voice saying:</strong>
          <p>“This is urgent. Please transfer money now, send an OTP, or share confidential information.”</p>
          <small>This text is educational context only. The generated audio remains the fixed benign awareness script.</small>
        </div>
      </div>
      <div className="wa-compose"><span>＋</span><div>Message</div><span>◉</span></div>
    </div>
  );
}

export function VoiceDeepfakeLearningPanel() {
  return (
    <div className="learning-panel voice-learning-panel">
      <span className="micro-label voice-label">VOICE DEEPFAKE</span>
      <h2>What if this voice note asked you for money?</h2>
      <p className="lead-copy">
        The voice note you just heard was generated from your consented reference sample. The words are a harmless fixed awareness message, but the same cloning technique can make a fraudulent request sound familiar and believable.
      </p>

      <div className="voice-risk-callout">
        <span>WHY THIS MATTERS</span>
        <strong>We naturally trust voices we recognise.</strong>
        <p>If a convincing clone arrives in a normal chat and creates urgency, secrecy or authority, a recipient may act before questioning whether the speaker is real.</p>
      </div>

      <div className="voice-scenario-grid">
        <article><b>01</b><h3>Familiarity</h3><p>The attacker tries to sound like a manager, colleague, supplier, friend or family member.</p></article>
        <article><b>02</b><h3>Pressure</h3><p>The message may claim that money, an OTP, credentials or a confidential file is urgently required.</p></article>
        <article><b>03</b><h3>Channel trust</h3><p>A normal-looking voice note inside a familiar messaging interface can make the request feel routine.</p></article>
      </div>

      <div className="defence-box voice-defence">
        <span>THE SAFE RESPONSE</span>
        <strong>Do not verify a voice with more voice.</strong>
        <p>Contact the person through a known number, trusted internal channel or established approval process. For sensitive requests, verification should happen outside the suspicious message.</p>
      </div>

      <div className="voice-rule-list">
        <div><span>01</span><p><b>Pause on urgency.</b> Pressure to act immediately is a reason to verify, not a reason to skip controls.</p></div>
        <div><span>02</span><p><b>Protect secrets.</b> Never share passwords, OTPs, recovery codes or confidential data because a voice sounds familiar.</p></div>
        <div><span>03</span><p><b>Report suspicious outreach.</b> Escalate unusual voice notes, calls or payment requests through your organisation’s reporting process.</p></div>
      </div>
    </div>
  );
}
