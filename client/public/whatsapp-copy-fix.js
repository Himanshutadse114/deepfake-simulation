(function installWhatsappCopyFix() {
  const startedAt = Date.now();
  const READY_TIMEOUT_MS = 120000;

  function scrollChatToBottom() {
    const chatBody = document.getElementById('waChatBody');
    if (!chatBody) return;
    requestAnimationFrame(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
      setTimeout(() => { chatBody.scrollTop = chatBody.scrollHeight; }, 80);
    });
  }

  function ensureCompletionActions() {
    const chatBody = document.getElementById('waChatBody');
    if (!chatBody) return;

    if (!document.getElementById('waVictimPayment500')) {
      window.appendWaBubble?.("Done, I've sent the $500 payment.", 'out');
      const lastBubble = chatBody.querySelector('.wa-bubble:last-of-type');
      if (lastBubble) lastBubble.id = 'waVictimPayment500';
    }

    let marker = document.getElementById('waSimulationComplete');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'waSimulationComplete';
      marker.className = 'wa-simulation-complete';
      marker.innerHTML = '<strong>Simulation complete</strong><span>The victim trusted the impersonation and sent the payment.</span>';
      chatBody.appendChild(marker);
    }

    if (!document.getElementById('waInlineCompletion')) {
      const block = document.createElement('div');
      block.id = 'waInlineCompletion';
      block.className = 'wa-inline-completion';
      block.innerHTML = `
        <div class="wa-inline-completion-copy">
          <strong>You saw the scam succeed.</strong>
          <span>The familiar voice, urgency and payment prompt were enough to convince the simulated victim.</span>
        </div>
        <div class="wa-inline-actions">
          <button class="secondary wa-inline-replay" type="button" onclick="replayWhatsAppSimulation()">↻ Replay</button>
          <button class="primary wa-inline-next" type="button" onclick="openProfileExperience()">Convinced? Let’s move further →</button>
        </div>
      `;
      marker.insertAdjacentElement('afterend', block);
    }

    const contactLastMsg = document.getElementById('waContactLastMsg');
    if (contactLastMsg) contactLastMsg.textContent = 'Payment sent';
    const status = document.getElementById('waStatus');
    if (status) status.textContent = 'online';
    scrollChatToBottom();
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
          window.appendQrBubble();

          setTimeout(() => {
            ensureCompletionActions();
          }, 1300);
        }, 1500);
      }, 1500);
    }, 1800);
  }
  revisedQrCodePaymentRequest.__innviktaQr500Copy = true;

  function install() {
    if (
      typeof window.onVoiceNoteCompleted !== 'function' ||
      typeof window.receiveQrCodePaymentRequest !== 'function' ||
      typeof window.appendWaBubble !== 'function' ||
      typeof window.showWaTyping !== 'function' ||
      typeof window.appendQrBubble !== 'function' ||
      typeof window.triggerIncomingVideoCall !== 'function'
    ) return false;

    if (!window.onVoiceNoteCompleted.__innviktaQr500Copy) {
      window.onVoiceNoteCompleted = revisedVoiceNoteCompleted;
    }
    if (!window.receiveQrCodePaymentRequest.__innviktaQr500Copy) {
      window.receiveQrCodePaymentRequest = revisedQrCodePaymentRequest;
    }
    window.__innviktaWhatsappCopyFixInstalled = true;
    return true;
  }

  install();
  const timer = setInterval(() => {
    install();
    if (Date.now() - startedAt > READY_TIMEOUT_MS) clearInterval(timer);
  }, 250);
})();
