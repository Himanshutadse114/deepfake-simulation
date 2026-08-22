(() => {
  let audioContext = null;
  let masterGain = null;
  let ringTimer = null;
  let ringing = false;
  let restartTimer = null;

  function incomingCallScreenActive() {
    const screen = document.querySelector('.screen[data-screen="waVideoCall"]');
    return Boolean(screen && screen.classList.contains('active') && !screen.hidden);
  }

  function ensureAudioContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.095;
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  async function unlockAudio() {
    const context = ensureAudioContext();
    if (!context) return;
    if (context.state === 'suspended') {
      try { await context.resume(); } catch (_) {}
    }
  }

  function playTone(frequency, offset, duration, level = 0.7) {
    const context = ensureAudioContext();
    if (!context || context.state !== 'running' || !masterGain) return;

    const startAt = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(level, startAt + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.04);
  }

  function playRingPhrase() {
    if (!ringing || !incomingCallScreenActive()) return;

    // A short, original smartphone-style incoming-call pattern. It is generated
    // locally with Web Audio, so there is no external ringtone asset or provider.
    playTone(659.25, 0.00, 0.20, 0.48);
    playTone(783.99, 0.22, 0.20, 0.55);
    playTone(987.77, 0.44, 0.28, 0.62);
    playTone(659.25, 0.92, 0.20, 0.48);
    playTone(783.99, 1.14, 0.20, 0.55);
    playTone(987.77, 1.36, 0.28, 0.62);
  }

  async function startRingtone() {
    clearTimeout(restartTimer);
    restartTimer = null;
    if (ringing) return;
    ringing = true;

    await unlockAudio();
    if (!ringing || !incomingCallScreenActive()) return;

    document.documentElement.classList.add('wa-call-ringing');
    playRingPhrase();
    clearInterval(ringTimer);
    ringTimer = setInterval(playRingPhrase, 2200);

    if (navigator.vibrate) {
      try { navigator.vibrate([180, 100, 180, 1200]); } catch (_) {}
    }
  }

  function stopRingtone() {
    ringing = false;
    clearInterval(ringTimer);
    ringTimer = null;
    clearTimeout(restartTimer);
    restartTimer = null;
    document.documentElement.classList.remove('wa-call-ringing');
    if (navigator.vibrate) {
      try { navigator.vibrate(0); } catch (_) {}
    }
  }

  function scheduleRepeatCall() {
    stopRingtone();
    restartTimer = setTimeout(() => {
      if (incomingCallScreenActive()) startRingtone();
    }, 1200);
  }

  // Unlock Web Audio during an earlier learner gesture. The incoming call is
  // triggered later by timers, which would otherwise be blocked by autoplay
  // policies in several mobile/desktop browsers.
  ['pointerdown', 'touchstart', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, unlockAudio, { capture: true, passive: true });
  });

  if (typeof window.triggerIncomingVideoCall === 'function') {
    const originalTriggerIncomingVideoCall = window.triggerIncomingVideoCall;
    window.triggerIncomingVideoCall = function triggerIncomingVideoCallWithRingtone(...args) {
      const result = originalTriggerIncomingVideoCall.apply(this, args);
      queueMicrotask(() => startRingtone());
      return result;
    };
  }

  if (typeof window.acceptVideoCall === 'function') {
    const originalAcceptVideoCall = window.acceptVideoCall;
    window.acceptVideoCall = function acceptVideoCallWithRingtoneStop(...args) {
      stopRingtone();
      return originalAcceptVideoCall.apply(this, args);
    };
  }

  if (typeof window.declineVideoCall === 'function') {
    const originalDeclineVideoCall = window.declineVideoCall;
    window.declineVideoCall = function declineVideoCallWithRingtoneRepeat(...args) {
      const result = originalDeclineVideoCall.apply(this, args);
      scheduleRepeatCall();
      return result;
    };
  }

  if (typeof window.go === 'function') {
    const originalGo = window.go;
    window.go = function goWithCallRingtoneCleanup(name, ...args) {
      if (name !== 'waVideoCall') stopRingtone();
      const result = originalGo.call(this, name, ...args);
      if (name === 'waVideoCall') queueMicrotask(() => startRingtone());
      return result;
    };
  }

  if (typeof window.resetSimulation === 'function') {
    const originalResetSimulation = window.resetSimulation;
    window.resetSimulation = async function resetSimulationWithRingtoneCleanup(...args) {
      stopRingtone();
      return originalResetSimulation.apply(this, args);
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRingtone();
    } else if (incomingCallScreenActive()) {
      startRingtone();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    html.wa-call-ringing .screen[data-screen="waVideoCall"] .phone,
    html.wa-call-ringing .screen[data-screen="waVideoCall"] .call-card,
    html.wa-call-ringing .screen[data-screen="waVideoCall"] .call-avatar{
      animation:waIncomingCallPulse 1.1s ease-in-out infinite;
      transform-origin:center;
    }
    @keyframes waIncomingCallPulse{
      0%,100%{transform:scale(1)}
      50%{transform:scale(1.012)}
    }
    @media (prefers-reduced-motion: reduce){
      html.wa-call-ringing .screen[data-screen="waVideoCall"] .phone,
      html.wa-call-ringing .screen[data-screen="waVideoCall"] .call-card,
      html.wa-call-ringing .screen[data-screen="waVideoCall"] .call-avatar{animation:none!important}
    }
  `;
  document.head.appendChild(style);

  window.startWhatsAppCallRingtone = startRingtone;
  window.stopWhatsAppCallRingtone = stopRingtone;
})();
