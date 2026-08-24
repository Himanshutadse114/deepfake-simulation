(() => {
  const REPLAY_VERSION = 2;
  if (window.__innviktaWhatsappReplayVersion === REPLAY_VERSION) return;
  window.__innviktaWhatsappReplayVersion = REPLAY_VERSION;

  let storyAdvancedForCurrentRun = false;

  function chatBody() {
    return document.getElementById('waChatBody');
  }

  function syncParticipantIdentity() {
    try { window.__innviktaSyncParticipantIdentity?.(); } catch (_) {}
  }

  function resetVisibleWhatsAppState() {
    const chat = chatBody();
    if (chat) {
      chat.replaceChildren();
      chat.scrollTop = 0;
    }

    document.getElementById('waTypingBubble')?.remove();
    document.getElementById('waVictimPayment500')?.remove();
    document.getElementById('waSimulationComplete')?.remove();
    document.getElementById('waInlineCompletion')?.remove();

    const dock = document.getElementById('waProceedDock');
    if (dock) dock.style.display = 'none';

    const status = document.getElementById('waStatus');
    if (status) status.textContent = 'online';

    const last = document.getElementById('waContactLastMsg');
    if (last) last.textContent = 'Voice message';

    const voiceBtn = document.getElementById('waVoiceBtn');
    if (voiceBtn) {
      voiceBtn.textContent = '▶';
      voiceBtn.setAttribute('aria-label', 'Play voice message');
    }

    document.querySelectorAll('.wa-wave.playing').forEach((wave) => wave.classList.remove('playing'));
    document.getElementById('callEndedOverlay')?.classList.remove('show');
    document.getElementById('videoExperience')?.classList.remove('video-playing');
  }

  // Every explicit WhatsApp start is a fresh UI run. Generated media is reused;
  // replay never creates another paid AI request.
  const originalStartWhatsAppSimulation = window.startWhatsAppSimulation;
  if (typeof originalStartWhatsAppSimulation === 'function') {
    window.startWhatsAppSimulation = function startWhatsAppSimulationFresh(...args) {
      storyAdvancedForCurrentRun = false;
      syncParticipantIdentity();
      return originalStartWhatsAppSimulation.apply(this, args);
    };
  }

  // The generated voice note can be replayed without launching duplicate story
  // branches. Only its first completed playback in each run advances the story.
  window.playVoiceSimulation = function playVoiceSimulationWithoutReplaySideEffects(btnId, waveId) {
    btnId = btnId || 'waVoiceBtn';
    waveId = waveId || 'waWave';
    const btn = document.getElementById(btnId);
    const wave = document.getElementById(waveId);
    if (!btn || !wave) return;

    btn.textContent = 'Ⅱ';
    wave.classList.add('playing');

    const source = window.whatsappAudioUrl || window.uploadedAudioUrl;
    const finishPlayback = () => {
      btn.textContent = '▶';
      wave.classList.remove('playing');

      if (btnId === 'waVoiceBtn' && !storyAdvancedForCurrentRun) {
        storyAdvancedForCurrentRun = true;
        window.onVoiceNoteCompleted?.();
      }
    };

    if (typeof window.playGeneratedAudio === 'function') {
      window.playGeneratedAudio(source, finishPlayback);
      return;
    }

    const preview = document.getElementById('audioPreview');
    if (!preview?.src) {
      finishPlayback();
      return;
    }
    try {
      preview.currentTime = 0;
      preview.onended = finishPlayback;
      preview.play().catch(() => {
        btn.textContent = '▶';
        wave.classList.remove('playing');
      });
    } catch (_) {
      btn.textContent = '▶';
      wave.classList.remove('playing');
    }
  };

  window.replayWhatsAppSimulation = function replayWhatsAppSimulationCleanly() {
    // Invalidate every delayed callback from the completed run before clearing
    // the chat. This prevents an old QR/completion timer from leaking into the
    // fresh replay.
    try { window.__innviktaResetWhatsappCompletion?.(); } catch (_) {}
    try { window.stopGeneratedPlayback?.(); } catch (_) {}
    try { window.speechSynthesis?.cancel?.(); } catch (_) {}

    document.querySelectorAll('audio').forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.onended = null;
      } catch (_) {}
    });

    storyAdvancedForCurrentRun = false;
    resetVisibleWhatsAppState();
    syncParticipantIdentity();

    // Rebuild from the first WhatsApp message only after the old DOM has been
    // fully cleared. The normal voice-note -> video call -> QR story then runs
    // again and the completion buttons are recreated only at the new ending.
    requestAnimationFrame(() => {
      resetVisibleWhatsAppState();
      requestAnimationFrame(() => {
        syncParticipantIdentity();
        window.startWhatsAppSimulation?.();
      });
    });
  };
})();
