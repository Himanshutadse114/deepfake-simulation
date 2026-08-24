(() => {
  const VERSION = 2;
  if (window.__innviktaDesktopExperienceFixesVersion === VERSION) return;
  window.__innviktaDesktopExperienceFixesVersion = VERSION;

  const AUTO_RECORD_SECONDS = 22;
  let activeStream = null;
  let activeRecorder = null;
  let recordingChunks = [];
  let recordingTimer = null;
  let countdownTimer = null;
  let autoStopTimer = null;
  let recordingSeconds = 0;
  let recordingCancelled = false;
  let recordingBusy = false;
  let waAudioContext = null;

  const byId = (id) => document.getElementById(id);

  function stopTracks() {
    if (!activeStream) return;
    try { activeStream.getTracks().forEach((track) => track.stop()); } catch (_) {}
    activeStream = null;
  }

  function clearRecordingTimers() {
    clearInterval(recordingTimer);
    clearInterval(countdownTimer);
    clearTimeout(autoStopTimer);
    recordingTimer = null;
    countdownTimer = null;
    autoStopTimer = null;
  }

  function ensureTeleprompterEnhancements() {
    const container = byId('recordContainer');
    if (!container) return false;

    const stage = container.querySelector('.voice-teleprompter-stage');
    if (stage && !byId('voiceCountdownOverlay')) {
      const countdown = document.createElement('div');
      countdown.id = 'voiceCountdownOverlay';
      countdown.className = 'voice-countdown-overlay';
      countdown.hidden = true;
      countdown.setAttribute('aria-live', 'assertive');
      countdown.innerHTML = '<span>Get ready</span><b id="voiceCountdownNumber">3</b><small>Recording starts automatically</small>';
      stage.appendChild(countdown);
    }

    const actions = container.querySelector('.voice-teleprompter-actions');
    if (actions && actions.dataset.autoRecordingActions !== 'true') {
      actions.dataset.autoRecordingActions = 'true';
      actions.innerHTML = `
        <div class="voice-auto-save-copy">
          <strong id="voiceAutoSaveTitle">Your recording will save automatically</strong>
          <span id="voiceAutoSaveStatus">Read the full script at your normal pace.</span>
        </div>
        <button type="button" class="secondary voice-cancel-recording">Cancel</button>
      `;
      actions.querySelector('.voice-cancel-recording')?.addEventListener('click', (event) => window.cancelRecording?.(event));
    }

    return true;
  }

  function setTeleprompterMode(mode, countdownValue) {
    const container = byId('recordContainer');
    if (!container) return;
    const countdown = byId('voiceCountdownOverlay');
    const countdownNumber = byId('voiceCountdownNumber');
    const script = container.querySelector('.voice-teleprompter-script');
    const tips = container.querySelector('.voice-teleprompter-tip');
    const pill = container.querySelector('.voice-recording-pill');
    const status = byId('voiceAutoSaveStatus');

    container.dataset.voiceMode = mode;
    if (mode === 'countdown') {
      if (countdown) countdown.hidden = false;
      if (countdownNumber) countdownNumber.textContent = String(countdownValue || 3);
      if (script) script.style.visibility = 'hidden';
      if (tips) tips.style.visibility = 'hidden';
      if (pill) pill.style.visibility = 'hidden';
      if (status) status.textContent = 'Get ready. Recording begins after the countdown.';
      return;
    }

    if (countdown) countdown.hidden = true;
    if (script) script.style.visibility = 'visible';
    if (tips) tips.style.visibility = 'visible';
    if (pill) pill.style.visibility = 'visible';
    if (status) status.textContent = `Recording will finish automatically after ${AUTO_RECORD_SECONDS} seconds.`;
  }

  function updateRecordingTimer() {
    recordingSeconds += 1;
    const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
    const secs = String(recordingSeconds % 60).padStart(2, '0');
    const timer = byId('recordTimer');
    if (timer) timer.textContent = `${mins}:${secs}`;
    const status = byId('voiceAutoSaveStatus');
    if (status) {
      const remaining = Math.max(0, AUTO_RECORD_SECONDS - recordingSeconds);
      status.textContent = remaining > 0
        ? `Keep reading naturally · auto-save in 00:${String(remaining).padStart(2, '0')}`
        : 'Saving your recording…';
    }
  }

  function applyRecordedAudio(blob, mime) {
    if (!blob || !blob.size) return;
    const audioInputEl = byId('audioInput');
    const preview = byId('audioPreview');
    if (!audioInputEl || !preview) return;

    const extension = mime.includes('webm') ? 'webm' : mime.includes('mpeg') ? 'mp3' : mime.includes('ogg') ? 'ogg' : 'wav';
    const file = new File([blob], `recorded-voice.${extension}`, { type: mime || 'audio/webm' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    audioInputEl.files = transfer.files;

    const objectUrl = URL.createObjectURL(blob);
    try {
      if (typeof uploadedAudioUrl !== 'undefined' && uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
      uploadedAudioUrl = objectUrl;
    } catch (_) {}

    preview.src = objectUrl;
    const prompt = byId('audioPrompt');
    const ready = byId('audioReady');
    const fileName = byId('audioFileName');
    const status = byId('audioStatus');
    if (prompt) prompt.style.display = 'none';
    ready?.classList.add('show');
    if (fileName) fileName.textContent = file.name;
    if (status) {
      status.textContent = 'Voice ready';
      status.classList.add('ready');
    }
    try { recordedInApp = true; } catch (_) {}
    try { recordingCancelled = false; } catch (_) {}
    try { window.checkMediaReady?.(); } catch (_) {
      try { checkMediaReady(); } catch (_) {}
    }
  }

  function finishRecording(cancelled = false) {
    if (!recordingBusy && !activeRecorder && !activeStream) return;
    recordingCancelled = cancelled;
    clearRecordingTimers();

    if (activeRecorder && activeRecorder.state !== 'inactive') {
      try { activeRecorder.stop(); } catch (_) { stopTracks(); }
    } else {
      stopTracks();
    }

    const container = byId('recordContainer');
    if (container) container.style.display = 'none';
    recordingBusy = false;
  }

  async function startRecordingWithCountdown(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (recordingBusy) return;
    recordingBusy = true;
    recordingCancelled = false;
    recordingChunks = [];
    clearRecordingTimers();
    ensureTeleprompterEnhancements();

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (error) {
      recordingBusy = false;
      try { window.toast?.('Microphone access denied or unavailable.'); } catch (_) {}
      console.error(error);
      return;
    }

    const container = byId('recordContainer');
    if (!container) {
      stopTracks();
      recordingBusy = false;
      return;
    }

    container.style.display = 'flex';
    recordingSeconds = 0;
    const timer = byId('recordTimer');
    if (timer) timer.textContent = '00:00';

    let count = 3;
    setTeleprompterMode('countdown', count);
    countdownTimer = setInterval(() => {
      count -= 1;
      const number = byId('voiceCountdownNumber');
      if (count > 0) {
        if (number) number.textContent = String(count);
        return;
      }

      clearInterval(countdownTimer);
      countdownTimer = null;
      if (number) number.textContent = 'GO';

      setTimeout(() => {
        if (!recordingBusy || !activeStream) return;
        const preferred = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : '';
        activeRecorder = new MediaRecorder(activeStream, preferred ? { mimeType: preferred } : undefined);
        activeRecorder.ondataavailable = (chunkEvent) => {
          if (chunkEvent.data?.size) recordingChunks.push(chunkEvent.data);
        };
        activeRecorder.onstop = () => {
          const mime = activeRecorder?.mimeType || 'audio/webm';
          const blob = !recordingCancelled && recordingChunks.length
            ? new Blob(recordingChunks, { type: mime })
            : null;
          if (blob) applyRecordedAudio(blob, mime);
          stopTracks();
          activeRecorder = null;
          recordingChunks = [];
        };
        activeRecorder.start(500);
        setTeleprompterMode('recording');
        recordingSeconds = 0;
        if (timer) timer.textContent = '00:00';
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        autoStopTimer = setTimeout(() => finishRecording(false), AUTO_RECORD_SECONDS * 1000);
      }, 420);
    }, 850);
  }

  function installRecordingOverride() {
    ensureTeleprompterEnhancements();
    window.startRecording = startRecordingWithCountdown;
    window.stopRecording = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      finishRecording(false);
    };
    window.cancelRecording = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      finishRecording(true);
    };
  }

  function playWhatsAppNotification() {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      waAudioContext = waAudioContext || new AudioContextCtor();
      if (waAudioContext.state === 'suspended') waAudioContext.resume().catch(() => {});
      const now = waAudioContext.currentTime;
      const gain = waAudioContext.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      gain.connect(waAudioContext.destination);

      [880, 1175].forEach((frequency, index) => {
        const oscillator = waAudioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.07);
        oscillator.connect(gain);
        oscillator.start(now + index * 0.07);
        oscillator.stop(now + 0.16 + index * 0.07);
      });
    } catch (_) {}
  }

  function installWhatsAppBrandingAndSound() {
    const sidehead = document.querySelector('.wa-sidehead');
    if (sidehead && sidehead.dataset.innviktaBrand !== 'true') {
      sidehead.dataset.innviktaBrand = 'true';
      sidehead.innerHTML = `
        <strong class="wa-desktop-wordmark">WhatsApp</strong>
        <div style="flex:1"></div>
        <span class="wa-side-action" title="New chat">◌</span>
        <span class="wa-side-action" title="Menu">⋮</span>
      `;
    }

    const currentAppend = window.appendWaBubble;
    if (typeof currentAppend === 'function' && !currentAppend.__innviktaNotificationSound) {
      const wrappedAppend = function appendWaBubbleWithSound(text, direction) {
        const result = currentAppend.apply(this, arguments);
        if (direction === 'in') setTimeout(playWhatsAppNotification, 40);
        return result;
      };
      wrappedAppend.__innviktaNotificationSound = true;
      window.appendWaBubble = wrappedAppend;
    }

    const currentQr = window.appendQrBubble;
    if (typeof currentQr === 'function' && !currentQr.__innviktaNotificationSound) {
      const wrappedQr = function appendQrBubbleWithSound() {
        const result = currentQr.apply(this, arguments);
        setTimeout(playWhatsAppNotification, 40);
        return result;
      };
      wrappedQr.__innviktaNotificationSound = true;
      window.appendQrBubble = wrappedQr;
    }
  }

  function generationFactsMarkup() {
    return `
      <div class="generation-facts" id="generationFacts" aria-label="Deepfake awareness facts">
        <article class="generation-fact-card">
          <div class="generation-fact-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><circle cx="19" cy="18" r="9"/><path d="M6 40c1-9 7-14 13-14s12 5 13 14"/><path d="M35 10v16M40 13v10M45 16v4"/></svg>
          </div>
          <div><b>Familiar can still be fake</b><span>AI-manipulated media can imitate recognisable facial and voice cues.</span></div>
        </article>
        <article class="generation-fact-card">
          <div class="generation-fact-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M24 5l15 6v10c0 10-6 17-15 22C15 38 9 31 9 21V11l15-6z"/><path d="M17 24l5 5 10-12"/></svg>
          </div>
          <div><b>Change the channel</b><span>Verify unusual requests using a saved number or another trusted route.</span></div>
        </article>
        <article class="generation-fact-card">
          <div class="generation-fact-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48"><rect x="10" y="20" width="28" height="21" rx="4"/><path d="M16 20v-6a8 8 0 0116 0v6"/><circle cx="24" cy="30" r="3"/><path d="M24 33v4"/></svg>
          </div>
          <div><b>Protect security secrets</b><span>Never share OTPs, passwords or approval codes because a face or voice feels familiar.</span></div>
        </article>
      </div>`;
  }

  function installGenerationFacts() {
    const copy = document.querySelector('.screen[data-screen="generate"] .generate-copy');
    const eta = byId('genEta');
    if (!copy || !eta || byId('generationFacts')) return;
    eta.insertAdjacentHTML('afterend', generationFactsMarkup());
  }

  function installStyles() {
    if (byId('innviktaRetainedDesktopFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'innviktaRetainedDesktopFixStyles';
    style.textContent = `
      /* Keep only the requested teleprompter, WhatsApp and generation-facts polish. */
      #recordContainer .voice-teleprompter-shell{
        height:100%!important;
        min-height:0!important;
        display:grid!important;
        grid-template-rows:auto minmax(0,1fr) auto!important;
        overflow:hidden!important;
      }
      #recordContainer .voice-teleprompter-head{
        position:relative!important;
        z-index:5!important;
        flex:none!important;
        padding:max(20px,env(safe-area-inset-top)) clamp(24px,4vw,64px) 16px!important;
      }
      #recordContainer .voice-teleprompter-stage{
        position:relative!important;
        z-index:1!important;
        min-height:0!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        justify-content:center!important;
        padding:clamp(20px,3.5vh,42px) clamp(28px,7vw,110px)!important;
        scrollbar-width:thin;
      }
      #recordContainer .voice-teleprompter-script{
        width:min(1080px,100%)!important;
        margin:0 auto!important;
        font-size:clamp(27px,3vw,46px)!important;
        line-height:1.34!important;
      }
      #recordContainer .voice-teleprompter-actions{
        position:relative!important;
        z-index:5!important;
        flex:none!important;
        min-height:72px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:18px!important;
      }
      .voice-auto-save-copy{display:flex;flex-direction:column;gap:3px;text-align:left;max-width:560px}
      .voice-auto-save-copy strong{font-size:13px;color:#fff}
      .voice-auto-save-copy span{font-size:10.5px;line-height:1.4;color:#98a2b4}
      .voice-countdown-overlay{
        position:absolute;inset:0;z-index:20;display:grid;place-content:center;justify-items:center;gap:8px;
        background:radial-gradient(circle,rgba(241,90,36,.15),rgba(5,7,12,.97) 58%);text-align:center
      }
      .voice-countdown-overlay[hidden]{display:none!important}
      .voice-countdown-overlay span{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ff9d55}
      .voice-countdown-overlay b{font:900 clamp(88px,17vh,160px)/.9 Inter,system-ui,sans-serif;color:#fff;text-shadow:0 0 55px rgba(241,90,36,.42)}
      .voice-countdown-overlay small{font-size:12px;color:#aeb7c5}
      @media(min-width:701px) and (max-height:780px){
        #recordContainer .voice-teleprompter-head{padding-top:14px!important;padding-bottom:10px!important}
        #recordContainer .voice-teleprompter-head h2{font-size:clamp(22px,2.2vw,30px)!important}
        #recordContainer .voice-teleprompter-head p{margin-top:5px!important;font-size:10.5px!important}
        #recordContainer .voice-teleprompter-stage{padding:12px clamp(28px,6vw,90px)!important}
        #recordContainer .voice-teleprompter-script{font-size:clamp(22px,2.5vw,34px)!important;line-height:1.28!important}
        #recordContainer .voice-teleprompter-tip{display:none!important}
        #recordContainer .voice-teleprompter-actions{min-height:58px!important;padding-top:9px!important;padding-bottom:9px!important}
      }
      @media(min-width:701px) and (max-height:620px){
        #recordContainer .voice-teleprompter-head p{display:none!important}
        #recordContainer .voice-teleprompter-script{font-size:clamp(19px,2.35vw,29px)!important;line-height:1.23!important}
      }

      .wa-desktop-wordmark{font-family:Inter,system-ui,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.02em;color:#e9edef}
      .wa-side-action{color:#aebac1;cursor:pointer;font-size:18px;margin-left:14px}

      .screen[data-screen="generate"] .generate-copy{align-self:center!important}
      .generation-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px;width:min(760px,100%)}
      .generation-fact-card{display:grid;grid-template-columns:44px 1fr;align-items:center;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-shadow:0 10px 28px rgba(0,0,0,.16);min-width:0}
      .generation-fact-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(241,90,36,.1);border:1px solid rgba(241,90,36,.22)}
      .generation-fact-icon svg{width:27px;height:27px;fill:none;stroke:#ff8b50;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .generation-fact-card b{display:block;font-size:11px;line-height:1.25;color:#f5f7fb;margin-bottom:3px}
      .generation-fact-card span{display:block;font-size:9.5px;line-height:1.38;color:#98a2b4}
      @media(max-width:900px){.generation-facts{grid-template-columns:1fr}.generation-fact-card{grid-template-columns:40px 1fr}.generation-fact-icon{width:40px;height:40px}}
      @media(min-width:901px) and (max-height:760px){.generation-facts{margin-top:14px;gap:8px}.generation-fact-card{padding:9px}.generation-fact-card span{font-size:9px}.generation-fact-icon{width:38px;height:38px}.generation-fact-icon svg{width:23px;height:23px}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    installStyles();
    installRecordingOverride();
    installWhatsAppBrandingAndSound();
    installGenerationFacts();
    return Boolean(byId('recordContainer'));
  }

  install();
  const startedAt = Date.now();
  const timer = setInterval(() => {
    install();
    if (Date.now() - startedAt > 120000) clearInterval(timer);
  }, 250);
})();
