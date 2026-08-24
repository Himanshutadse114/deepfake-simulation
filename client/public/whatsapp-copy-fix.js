(function installWhatsappFlowFix() {
  const FLOW_VERSION = 3;
  const existing = window.__innviktaWhatsappFlowController;
  if (existing?.version === FLOW_VERSION) return;

  const startedAt = Date.now();
  const READY_TIMEOUT_MS = 120000;
  let completionTimer = null;
  let completionBackupTimer = null;
  let flowEpoch = 0;

  function chatBody() {
    return document.getElementById('waChatBody');
  }

  function scrollChatToBottom() {
    const body = chatBody();
    if (!body) return;
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
      setTimeout(() => { body.scrollTop = body.scrollHeight; }, 80);
      setTimeout(() => { body.scrollTop = body.scrollHeight; }, 350);
    });
  }

  function clearCompletionTimers() {
    clearTimeout(completionTimer);
    clearTimeout(completionBackupTimer);
    completionTimer = null;
    completionBackupTimer = null;
  }

  function removeCompletionUi() {
    document.getElementById('waVictimPayment500')?.remove();
    document.getElementById('waSimulationComplete')?.remove();
    document.getElementById('waInlineCompletion')?.remove();
    const dock = document.getElementById('waProceedDock');
    if (dock) dock.style.display = 'none';
  }

  function resetFlowState() {
    flowEpoch += 1;
    clearCompletionTimers();
    removeCompletionUi();
  }

  function appendVictimPaymentBubble() {
    const body = chatBody();
    if (!body || document.getElementById('waVictimPayment500')) return;

    const bubble = document.createElement('div');
    bubble.id = 'waVictimPayment500';
    bubble.className = 'wa-bubble out';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    bubble.innerHTML = `Done, I've sent the $500 payment.<span class="wa-time">${timeStr}</span>`;
    body.appendChild(bubble);
  }

  function ensureCompletionActions(epoch = flowEpoch) {
    if (epoch !== flowEpoch) return false;
    const body = chatBody();
    if (!body) return false;

    appendVictimPaymentBubble();

    let marker = document.getElementById('waSimulationComplete');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'waSimulationComplete';
      marker.className = 'wa-simulation-complete';
      marker.innerHTML = '<strong>Simulation complete</strong><span>The victim trusted the impersonation and sent the payment.</span>';
      body.appendChild(marker);
    }

    let block = document.getElementById('waInlineCompletion');
    if (!block) {
      block = document.createElement('div');
      block.id = 'waInlineCompletion';
      block.className = 'wa-inline-completion wa-inline-completion-final';
      block.innerHTML = `
        <div class="wa-inline-completion-copy">
          <strong>You saw the scam succeed.</strong>
          <span>The familiar voice, urgency and payment prompt were enough to convince the simulated victim.</span>
        </div>
        <div class="wa-inline-actions">
          <button class="secondary wa-inline-replay" type="button">↻ Replay</button>
          <button class="primary wa-inline-next" type="button">Convinced? Let’s move further →</button>
        </div>
      `;
      body.appendChild(block);
      block.querySelector('.wa-inline-replay')?.addEventListener('click', () => {
        window.replayWhatsAppSimulation?.();
      });
      block.querySelector('.wa-inline-next')?.addEventListener('click', () => {
        window.openProfileExperience?.();
      });
    }

    const contactLastMsg = document.getElementById('waContactLastMsg');
    if (contactLastMsg) contactLastMsg.textContent = 'Payment sent';
    const status = document.getElementById('waStatus');
    if (status) status.textContent = 'online';

    // Keep Replay / Convinced as the literal final content in the conversation.
    if (body.lastElementChild !== block) body.appendChild(block);
    block.style.display = 'block';
    block.removeAttribute('hidden');
    block.setAttribute('aria-hidden', 'false');
    scrollChatToBottom();
    return true;
  }

  function scheduleCompletionAfterQr(epoch = flowEpoch) {
    clearCompletionTimers();

    completionTimer = setTimeout(() => {
      ensureCompletionActions(epoch);
    }, 700);

    // A second pass protects navigation if another WhatsApp helper mutates the
    // chat immediately after the QR is rendered.
    completionBackupTimer = setTimeout(() => {
      ensureCompletionActions(epoch);
    }, 2200);
  }

  function installQrCompletionHook() {
    const current = window.appendQrBubble;
    if (typeof current !== 'function') return false;
    if (current.__innviktaQrCompletionHook === FLOW_VERSION) return true;

    const wrapped = function appendQrBubbleWithCompletion(...args) {
      const epoch = flowEpoch;
      try {
        return current.apply(this, args);
      } finally {
        scheduleCompletionAfterQr(epoch);
      }
    };
    wrapped.__innviktaQrCompletionHook = FLOW_VERSION;
    wrapped.__innviktaOriginalQrBubble = current;
    if (current.__innviktaNotificationSound) wrapped.__innviktaNotificationSound = true;
    window.appendQrBubble = wrapped;
    return true;
  }

  function revisedVoiceNoteCompleted() {
    const epoch = flowEpoch;
    setTimeout(() => {
      if (epoch !== flowEpoch) return;
      window.appendWaBubble('That sounds exactly like you.', 'out');
      setTimeout(() => {
        if (epoch !== flowEpoch) return;
        window.triggerIncomingVideoCall();
      }, 1500);
    }, 1000);
  }
  revisedVoiceNoteCompleted.__innviktaQr500Copy = true;
  revisedVoiceNoteCompleted.__innviktaCompletionVersion = FLOW_VERSION;

  function revisedQrCodePaymentRequest() {
    const epoch = flowEpoch;
    window.showWaTyping(true);
    setTimeout(() => {
      if (epoch !== flowEpoch) return;
      window.showWaTyping(false);
      window.appendWaBubble('Please scan this QR code to complete the processing payment of $500 urgently.', 'in');
      const contactLastMsg = document.getElementById('waContactLastMsg');
      if (contactLastMsg) contactLastMsg.textContent = 'Please scan this QR code...';

      setTimeout(() => {
        if (epoch !== flowEpoch) return;
        window.showWaTyping(true);
        setTimeout(() => {
          if (epoch !== flowEpoch) return;
          window.showWaTyping(false);
          try {
            window.appendQrBubble();
          } finally {
            scheduleCompletionAfterQr(epoch);
          }
        }, 1500);
      }, 1500);
    }, 1800);
  }
  revisedQrCodePaymentRequest.__innviktaQr500Copy = true;
  revisedQrCodePaymentRequest.__innviktaCompletionVersion = FLOW_VERSION;

  function install() {
    if (
      typeof window.onVoiceNoteCompleted !== 'function' ||
      typeof window.receiveQrCodePaymentRequest !== 'function' ||
      typeof window.appendWaBubble !== 'function' ||
      typeof window.showWaTyping !== 'function' ||
      typeof window.appendQrBubble !== 'function' ||
      typeof window.triggerIncomingVideoCall !== 'function'
    ) return false;

    installQrCompletionHook();

    if (window.onVoiceNoteCompleted.__innviktaCompletionVersion !== FLOW_VERSION) {
      window.onVoiceNoteCompleted = revisedVoiceNoteCompleted;
    }
    if (window.receiveQrCodePaymentRequest.__innviktaCompletionVersion !== FLOW_VERSION) {
      window.receiveQrCodePaymentRequest = revisedQrCodePaymentRequest;
    }

    window.__innviktaWhatsappCopyFixInstalled = true;
    window.__innviktaForceWhatsappCompletion = ensureCompletionActions;
    window.__innviktaResetWhatsappCompletion = resetFlowState;
    return true;
  }

  window.__innviktaWhatsappFlowController = {
    version: FLOW_VERSION,
    reset: resetFlowState,
    ensureCompletion: ensureCompletionActions
  };

  const style = document.createElement('style');
  style.textContent = `
    #waInlineCompletion.wa-inline-completion-final{
      display:block!important;
      visibility:visible!important;
      opacity:1!important;
      position:static!important;
      inset:auto!important;
      z-index:auto!important;
      flex:none!important;
      width:min(620px,94%)!important;
      margin:8px auto 24px!important;
    }
    #waInlineCompletion.wa-inline-completion-final .wa-inline-actions{
      display:flex!important;
    }
  `;
  document.head.appendChild(style);

  install();
  const timer = setInterval(() => {
    install();
    if (Date.now() - startedAt > READY_TIMEOUT_MS) clearInterval(timer);
  }, 250);
})();
