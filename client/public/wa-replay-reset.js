(() => {
  const CLEAN_RESTART_GUARD_MS = 12000;
  let replayGuardUntil = 0;

  function chatBody() {
    return document.getElementById('waChatBody');
  }

  function removeStaleCompletion() {
    if (Date.now() > replayGuardUntil) return;
    document.getElementById('waSimulationComplete')?.remove();
    document.getElementById('waInlineCompletion')?.remove();
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

  const chat = chatBody();
  if (chat) {
    const staleObserver = new MutationObserver(() => removeStaleCompletion());
    staleObserver.observe(chat, { childList: true, subtree: true });
  }

  window.replayWhatsAppSimulation = function replayWhatsAppSimulationCleanly() {
    try { window.stopGeneratedPlayback?.(); } catch (_) {}
    try { window.speechSynthesis?.cancel?.(); } catch (_) {}

    document.querySelectorAll('audio').forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    });

    replayGuardUntil = Date.now() + CLEAN_RESTART_GUARD_MS;
    resetVisibleWhatsAppState();

    // Give MutationObservers from the completed run one turn to settle before
    // the fresh WhatsApp sequence starts. This prevents old completion UI from
    // being appended above the new conversation.
    requestAnimationFrame(() => {
      resetVisibleWhatsAppState();
      setTimeout(() => {
        resetVisibleWhatsAppState();
        window.startWhatsAppSimulation?.();
      }, 80);
    });
  };
})();
