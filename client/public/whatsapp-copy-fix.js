(function installWhatsappCopyFix() {
  const startedAt = Date.now();
  const READY_TIMEOUT_MS = 15000;

  function install() {
    if (window.__innviktaWhatsappCopyFixInstalled) return true;
    if (
      typeof window.onVoiceNoteCompleted !== 'function' ||
      typeof window.receiveQrCodePaymentRequest !== 'function' ||
      typeof window.appendWaBubble !== 'function' ||
      typeof window.showWaTyping !== 'function' ||
      typeof window.appendQrBubble !== 'function' ||
      typeof window.triggerIncomingVideoCall !== 'function'
    ) return false;

    window.onVoiceNoteCompleted = function revisedVoiceNoteCompleted() {
      setTimeout(() => {
        window.appendWaBubble('That sounds exactly like you.', 'out');
        setTimeout(() => {
          window.triggerIncomingVideoCall();
        }, 1500);
      }, 1000);
    };

    window.receiveQrCodePaymentRequest = function revisedQrCodePaymentRequest() {
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
    };

    window.__innviktaWhatsappCopyFixInstalled = true;
    return true;
  }

  if (install()) return;
  const timer = setInterval(() => {
    if (install() || Date.now() - startedAt > READY_TIMEOUT_MS) clearInterval(timer);
  }, 50);
})();
