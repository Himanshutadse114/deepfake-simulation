(() => {
  const VERSION = 1;
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
        updateRecordingTimer();
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

  function carouselImages() {
    const generated = Array.isArray(window.__generatedProfileUrls) ? window.__generatedProfileUrls.filter(Boolean).slice(0, 4) : [];
    if (generated.length) return generated;
    const ordered = Array.isArray(window.__profileCarouselImageOrder) ? window.__profileCarouselImageOrder.filter(Boolean).slice(0, 4) : [];
    if (ordered.length) return ordered;
    return Array.isArray(window.variantUrls) ? window.variantUrls.filter(Boolean).slice(0, 4) : [];
  }

  function installOpenToWorkBadge() {
    const holder = document.querySelector('.li-avatar-container');
    if (!holder || holder.dataset.referenceBadge === 'true') return;
    holder.dataset.referenceBadge = 'true';
    holder.querySelector('.li-opentowork-ring')?.remove();
    holder.insertAdjacentHTML('beforeend', `
      <svg class="li-opentowork-ring innvikta-reference-open-badge" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" stroke-width="4"/>
        <path d="M9 53 A43 43 0 1 0 91 53" fill="none" stroke="#2f7d32" stroke-width="14" stroke-linecap="round"/>
        <path id="innviktaOpenToWorkPath" d="M14 63 A39 39 0 0 0 86 63" fill="none"/>
        <text fill="#ffffff" font-family="Arial, sans-serif" font-size="9.5" font-weight="900" letter-spacing=".55"><textPath href="#innviktaOpenToWorkPath" startOffset="50%" text-anchor="middle">#OPENTOWORK</textPath></text>
      </svg>`);
  }

  function decorateProfileBanners() {
    const linkedin = document.querySelector('.li-banner');
    const facebook = document.querySelector('.fb-cover');
    const images = carouselImages();

    if (linkedin) {
      if (images[0]) {
        const safe = String(images[0]).replace(/"/g, '%22');
        linkedin.style.backgroundImage = `linear-gradient(90deg,rgba(20,45,58,.82),rgba(35,62,74,.48)),url("${safe}")`;
      }
      linkedin.style.backgroundSize = 'cover';
      linkedin.style.backgroundPosition = 'center 40%';
    }
    if (facebook) {
      if (images[2] || images[1]) {
        const safe = String(images[2] || images[1]).replace(/"/g, '%22');
        facebook.style.backgroundImage = `linear-gradient(180deg,rgba(24,119,242,.12),rgba(0,0,0,.52)),url("${safe}")`;
      }
      facebook.style.backgroundSize = 'cover';
      facebook.style.backgroundPosition = 'center 46%';
    }
    installOpenToWorkBadge();
  }

  function watchCarousel() {
    const screen = document.querySelector('.screen[data-screen="profileCarouselExperience"]');
    if (!screen || screen.dataset.desktopFixWatch === 'true') return;
    screen.dataset.desktopFixWatch = 'true';
    const refresh = () => {
      if (screen.classList.contains('active') && !screen.hidden) {
        requestAnimationFrame(() => setTimeout(decorateProfileBanners, 80));
      }
    };
    const observer = new MutationObserver(refresh);
    observer.observe(screen, { attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });
    refresh();
  }

  function installStyles() {
    if (byId('desktopExperienceFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'desktopExperienceFixStyles';
    style.textContent = `
      /* Teleprompter: header and script must never overlap on desktop/laptop. */
      #recordContainer .voice-teleprompter-shell{grid-template-rows:auto minmax(0,1fr) auto!important}
      #recordContainer .voice-teleprompter-head{position:relative!important;z-index:4!important;padding:max(20px,env(safe-area-inset-top)) clamp(24px,4vw,64px) 16px!important;min-height:142px!important}
      #recordContainer .voice-teleprompter-head h2{font-size:clamp(24px,2.2vw,34px)!important;line-height:1.08!important}
      #recordContainer .voice-teleprompter-stage{position:relative!important;min-height:0!important;overflow-y:auto!important;justify-content:center!important;padding:clamp(24px,4vh,44px) clamp(30px,7vw,120px)!important}
      #recordContainer .voice-teleprompter-script{margin:0 auto!important;font-size:clamp(25px,min(3vw,4.8vh),46px)!important;line-height:1.34!important;max-width:1120px!important;text-wrap:balance!important}
      #recordContainer .voice-teleprompter-actions{min-height:78px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:20px!important;padding:12px clamp(24px,4vw,64px) max(14px,env(safe-area-inset-bottom))!important}
      #recordContainer .voice-auto-save-copy{display:flex;flex-direction:column;gap:3px;min-width:min(560px,60vw)}
      #recordContainer .voice-auto-save-copy strong{font-size:13px;color:#fff}
      #recordContainer .voice-auto-save-copy span{font-size:11px;color:#98a2b4}
      #recordContainer .voice-cancel-recording{min-width:130px!important;border-radius:999px!important}
      .voice-countdown-overlay{position:absolute;inset:0;z-index:10;display:grid;place-content:center;justify-items:center;gap:10px;background:radial-gradient(circle at 50% 50%,rgba(241,90,36,.14),transparent 33%),#05070c;color:#fff;text-align:center}
      .voice-countdown-overlay[hidden]{display:none!important}
      .voice-countdown-overlay span{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#ff9d55;font-weight:800}
      .voice-countdown-overlay b{font-size:clamp(92px,15vw,190px);font-weight:900;line-height:.9;letter-spacing:-.08em;text-shadow:0 0 60px rgba(241,90,36,.25)}
      .voice-countdown-overlay small{font-size:12px;color:#98a2b4}
      @media(min-width:701px) and (max-height:780px){
        #recordContainer .voice-teleprompter-head{min-height:118px!important;padding-top:14px!important;padding-bottom:12px!important}
        #recordContainer .voice-teleprompter-head p{font-size:11px!important;margin-top:5px!important}
        #recordContainer .voice-teleprompter-stage{padding:16px 6vw!important}
        #recordContainer .voice-teleprompter-script{font-size:clamp(22px,min(2.7vw,4.2vh),38px)!important;line-height:1.3!important}
        #recordContainer .voice-teleprompter-actions{min-height:66px!important;padding-top:8px!important;padding-bottom:8px!important}
      }

      /* WhatsApp desktop wordmark + familiar, low-volume incoming-message chime. */
      .wa-sidehead{padding:10px 14px!important;gap:12px!important}
      .wa-desktop-wordmark{font-size:19px!important;line-height:1!important;font-weight:760!important;letter-spacing:-.02em;color:#e9edef!important}
      .wa-desktop-wordmark:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#25d366;margin-right:8px;box-shadow:0 0 12px rgba(37,211,102,.35)}
      .wa-side-action{color:#aebac1;cursor:pointer;font-size:20px;line-height:1}

      /* Pictorial deepfake facts occupy the unused generation area. */
      .generation-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px;width:100%;max-width:760px}
      .generation-fact-card{min-width:0;display:grid;grid-template-columns:48px 1fr;gap:11px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .generation-fact-icon{width:46px;height:46px;border-radius:11px;display:grid;place-items:center;background:rgba(241,90,36,.1);border:1px solid rgba(241,90,36,.22)}
      .generation-fact-icon svg{width:28px;height:28px;fill:none;stroke:#ff9d55;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .generation-fact-card b{display:block;color:#f7f8fb;font-size:11px;line-height:1.25;margin-bottom:4px}
      .generation-fact-card span{display:block;color:#98a2b4;font-size:9.5px;line-height:1.38}
      .generation-fact-card:nth-child(2){animation:generationFactFloat 5.4s ease-in-out infinite}.generation-fact-card:nth-child(3){animation:generationFactFloat 5.4s ease-in-out 1.2s infinite}
      @keyframes generationFactFloat{50%{transform:translateY(-3px);border-color:rgba(241,90,36,.2)}}
      @media(min-width:701px) and (max-height:760px){.generation-facts{margin-top:14px}.generation-fact-card{padding:9px;grid-template-columns:40px 1fr}.generation-fact-icon{width:38px;height:38px}.generation-fact-card span{font-size:8.7px}}
      @media(max-width:900px){.generation-facts{grid-template-columns:1fr}.generation-fact-card:nth-child(n+3){display:none}}

      /* More realistic social-profile cover areas and reference-style badge. */
      .li-banner,.fb-cover{background-color:#263a46!important;background-repeat:no-repeat!important}
      .li-banner:after,.fb-cover:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0 56%,rgba(255,255,255,.08) 56% 57%,transparent 57% 66%,rgba(255,255,255,.05) 66% 67%,transparent 67%)}
      .li-avatar-container{border-color:#fff!important;background:#fff!important;box-shadow:0 4px 14px rgba(0,0,0,.38)!important}
      .innvikta-reference-open-badge{position:absolute!important;inset:-8px!important;width:calc(100% + 16px)!important;height:calc(100% + 16px)!important;pointer-events:none!important;overflow:visible!important}

      /* The Simulation Daily: desktop/laptop content remains readable and never clipped. */
      @media(min-width:901px){
        .screen[data-screen="unifiedLearn"] .editorial-news{overflow:hidden!important}
        .screen[data-screen="unifiedLearn"] .paper-story{overflow-y:auto!important;overflow-x:hidden!important;scrollbar-width:thin;scrollbar-color:rgba(80,55,28,.34) transparent}
        .screen[data-screen="unifiedLearn"] .paper-story::-webkit-scrollbar{width:5px}.screen[data-screen="unifiedLearn"] .paper-story::-webkit-scrollbar-thumb{background:rgba(80,55,28,.32);border-radius:99px}
      }
      @media(min-width:901px) and (max-height:950px){
        .editorial-news{padding:5px clamp(26px,3vw,50px) 6px!important}
        .editorial-mast{padding-bottom:5px!important}.editorial-mast h1{font-size:clamp(48px,4.6vw,78px)!important;line-height:.88!important}.editorial-meta{margin-top:5px!important;padding-top:3px!important;font-size:8px!important}
        .editorial-lead{padding:6px 0 7px!important}.editorial-lead h2{font-size:clamp(31px,3.2vw,50px)!important;margin-bottom:2px!important}.editorial-lead p{font-size:8.5px!important;line-height:1.25!important}
        .editorial-pages{padding-top:5px!important}.editorial-page{inset:5px 0 0!important}.editorial-page-head{padding-bottom:4px!important;margin-bottom:5px!important}.editorial-page-head h3{font-size:clamp(21px,2vw,31px)!important}.editorial-grid{gap:14px!important;padding-bottom:3px!important}
        .paper-story{padding:10px 11px!important}.story-kicker{font-size:8px!important;padding:3px 6px!important;margin-bottom:6px!important}.paper-story h4{font-size:clamp(16px,1.15vw,20px)!important;line-height:1.02!important;margin-bottom:7px!important}.paper-story p{font-size:10px!important;line-height:1.31!important;margin-bottom:6px!important}.paper-story .dropcap:first-letter{font-size:39px!important;margin-right:6px!important}.paper-story blockquote{font-size:10px!important;line-height:1.3!important;padding-top:7px!important}.story-columns{column-gap:12px!important}.story-list{gap:4px!important;margin:3px 0 6px!important}.story-list div{padding:5px!important}.story-list b{font-size:8.5px!important}.story-list span{font-size:9.5px!important}.story-steps{gap:4px!important;margin:3px 0 6px!important}.story-step{grid-template-columns:32px 1fr!important;gap:8px!important;padding:5px!important;min-height:0!important}.story-step>span{width:29px!important;height:29px!important;font-size:8px!important}.story-step b{font-size:8.3px!important;margin-bottom:2px!important}.story-step p{font-size:9.3px!important;line-height:1.25!important}.story-number{font-size:46px!important;margin-bottom:5px!important}.story-quote{font-size:17px!important;line-height:1.08!important;min-height:98px!important;padding:10px 7px!important}.final-rules{gap:4px!important;margin:4px 0 6px!important}.final-rules span{min-height:0!important;padding:6px 7px!important;font-size:9px!important;line-height:1.26!important}.editorial-quiz{min-height:44px!important;font-size:12px!important;width:min(100%,400px)!important}.editorial-nav{margin-top:2px!important;padding:3px 6px!important}.editorial-nav button{width:29px!important;height:29px!important}
      }
      @media(min-width:901px) and (max-height:760px){
        .editorial-mast h1{font-size:55px!important}.editorial-lead h2{font-size:35px!important}.editorial-page-head h3{font-size:23px!important}.paper-story h4{font-size:16px!important}.paper-story p{font-size:9px!important}.story-step p,.story-list span{font-size:8.7px!important}.story-quote{font-size:15px!important;min-height:78px!important}.editorial-quiz{min-height:40px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    installStyles();
    installRecordingOverride();
    installWhatsAppBrandingAndSound();
    installGenerationFacts();
    watchCarousel();
    decorateProfileBanners();

    window.addEventListener('resize', () => {
      ensureTeleprompterEnhancements();
      decorateProfileBanners();
    });

    const refreshTimer = setInterval(() => {
      installWhatsAppBrandingAndSound();
      installGenerationFacts();
      watchCarousel();
      if (document.querySelector('.screen[data-screen="profileCarouselExperience"]')?.classList.contains('active')) decorateProfileBanners();
    }, 1500);
    setTimeout(() => clearInterval(refreshTimer), 30000);
  }

  install();
})();
