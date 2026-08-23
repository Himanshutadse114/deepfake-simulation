(function installWhatsappCopyFix() {
  const startedAt = Date.now();
  const READY_TIMEOUT_MS = 120000;
  const COMPLETION_VERSION = 2;
  let completionTimer = null;
  let completionBackupTimer = null;

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

  function ensureCompletionActions() {
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
      block.className = 'wa-inline-completion wa-inline-completion-forced';
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
      marker.insertAdjacentElement('afterend', block);
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

    block.style.display = 'block';
    block.removeAttribute('hidden');
    block.setAttribute('aria-hidden', 'false');
    scrollChatToBottom();
    return true;
  }

  function scheduleCompletionAfterQr() {
    clearTimeout(completionTimer);
    clearTimeout(completionBackupTimer);

    completionTimer = setTimeout(() => {
      ensureCompletionActions();
    }, 700);

    // Defensive second pass: even if another UI helper mutates the chat right
    // after the QR is inserted, navigation is restored automatically.
    completionBackupTimer = setTimeout(() => {
      ensureCompletionActions();
    }, 2200);
  }

  function installQrCompletionHook() {
    const current = window.appendQrBubble;
    if (typeof current !== 'function') return false;
    if (current.__innviktaQrCompletionHook === COMPLETION_VERSION) return true;

    const wrapped = function appendQrBubbleWithCompletion(...args) {
      try {
        return current.apply(this, args);
      } finally {
        // Register completion even if the QR renderer throws after appending its
        // DOM. This prevents a learner from ever being stranded after the QR.
        scheduleCompletionAfterQr();
      }
    };
    wrapped.__innviktaQrCompletionHook = COMPLETION_VERSION;
    wrapped.__innviktaOriginalQrBubble = current;
    window.appendQrBubble = wrapped;
    return true;
  }

  function revisedVoiceNoteCompleted() {
    setTimeout(() => {
      window.appendWaBubble('That sounds exactly like you.', 'out');
      setTimeout(() => {
        window.triggerIncomingVideoCall();
      }, 1500);
    }, 1000);
  }
  revisedVoiceNoteCompleted.__innviktaQr500Copy = true;
  revisedVoiceNoteCompleted.__innviktaCompletionVersion = COMPLETION_VERSION;

  function revisedQrCodePaymentRequest() {
    window.showWaTyping(true);
    setTimeout(() => {
      window.showWaTyping(false);
      window.appendWaBubble('Please scan this QR code to complete the processing payment of $500 urgently.', 'in');
      const contactLastMsg = document.getElementById('waContactLastMsg');
      if (contactLastMsg) contactLastMsg.textContent = 'Please scan this QR code...';

      setTimeout(() => {
        window.showWaTyping(true);
        setTimeout(() => {
          window.showWaTyping(false);
          // The appendQrBubble wrapper owns completion scheduling. The explicit
          // finally below is an additional guard in case another script swaps
          // the QR renderer between installation and this call.
          try {
            window.appendQrBubble();
          } finally {
            scheduleCompletionAfterQr();
          }
        }, 1500);
      }, 1500);
    }, 1800);
  }
  revisedQrCodePaymentRequest.__innviktaQr500Copy = true;
  revisedQrCodePaymentRequest.__innviktaCompletionVersion = COMPLETION_VERSION;

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

    // Version checks deliberately replace older cached WhatsApp helpers even
    // when they carry the old __innviktaQr500Copy marker.
    if (window.onVoiceNoteCompleted.__innviktaCompletionVersion !== COMPLETION_VERSION) {
      window.onVoiceNoteCompleted = revisedVoiceNoteCompleted;
    }
    if (window.receiveQrCodePaymentRequest.__innviktaCompletionVersion !== COMPLETION_VERSION) {
      window.receiveQrCodePaymentRequest = revisedQrCodePaymentRequest;
    }
    window.__innviktaWhatsappCopyFixInstalled = true;
    window.__innviktaForceWhatsappCompletion = ensureCompletionActions;
    return true;
  }

  const style = document.createElement('style');
  style.textContent = `
    #waInlineCompletion.wa-inline-completion-forced{
      display:block!important;
      visibility:visible!important;
      opacity:1!important;
      position:sticky!important;
      bottom:8px!important;
      z-index:25!important;
    }
    #waInlineCompletion.wa-inline-completion-forced .wa-inline-actions{
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
