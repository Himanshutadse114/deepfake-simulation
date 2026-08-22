(() => {
  let storyAdvancedForCurrentRun = false;

  function chatBody() {
    return document.getElementById('waChatBody');
  }

  function resetVisibleWhatsAppState() {
    const chat = chatBody();
    if (chat) {
      chat.replaceChildren();
      chat.scrollTop = 0;
    }

    document.getElementById('waTypingBubble')?.remove();
    document.getElementById('waSimulationComplete')?.remove();
    document.getElementById('waInlineCompletion')?.remove();

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
  }

  // Every explicit WhatsApp start is a fresh UI run. This does not create a
  // backend session and does not call Qwen, Pruna or FLUX; it only reuses the
  // already-generated assets that remain attached to the active simulation.
  const originalStartWhatsAppSimulation = window.startWhatsAppSimulation;
  if (typeof originalStartWhatsAppSimulation === 'function') {
    window.startWhatsAppSimulation = function startWhatsAppSimulationFresh(...args) {
      storyAdvancedForCurrentRun = false;
      return originalStartWhatsAppSimulation.apply(this, args);
    };
  }

  // The generated voice note may be played as many times as the learner wants.
  // Only the first completed playback in each WhatsApp run advances the story.
  // Previously every playback called onVoiceNoteCompleted(), which could launch
  // another call/payment sequence and re-append completion controls.
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

    // Defensive fallback for the demo/local path. This fallback still keeps
    // progression one-shot for the current WhatsApp run.
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
    try { window.stopGeneratedPlayback?.(); } catch (_) {}
    try { window.speechSynthesis?.cancel?.(); } catch (_) {}

    document.querySelectorAll('audio').forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    });

    // Remove the completed-run marker and buttons before the conversation is
    // rebuilt. wa-flow-fix will add them again only when the fresh run reaches
    // its real completion marker.
    storyAdvancedForCurrentRun = false;
    resetVisibleWhatsAppState();

    requestAnimationFrame(() => {
      resetVisibleWhatsAppState();
      window.startWhatsAppSimulation?.();
    });
  };
})();
