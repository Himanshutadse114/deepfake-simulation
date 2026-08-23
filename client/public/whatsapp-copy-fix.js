(function installWhatsappCopyFix() {
  const startedAt = Date.now();
  const READY_TIMEOUT_MS = 30000;

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
          const proceedDock = document.getElementById('waProceedDock');
          if (proceedDock) proceedDock.style.display = 'block';
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

    // Re-apply whenever another late UI helper replaced either function. This
    // is important because ui-bootstrap loads several WhatsApp polish scripts
    // asynchronously after the base runtime becomes available.
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
