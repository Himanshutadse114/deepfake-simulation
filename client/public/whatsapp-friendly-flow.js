(function installFriendlyWhatsappFlow() {
  const READY_TIMEOUT_MS = 15000;
  const startedAt = Date.now();

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function requiredFunctionsReady() {
    return [
      'startWhatsAppSimulation',
      'onVoiceNoteCompleted',
      'receiveQrCodePaymentRequest',
      'appendQrBubble',
      'showWaTyping',
      'appendWaBubble',
      'appendAudioBubble',
      'triggerIncomingVideoCall',
      'go'
    ].every((name) => typeof window[name] === 'function');
  }

  async function incoming(text, typingMs = 850, pauseAfterMs = 420) {
    window.showWaTyping(true);
    await wait(typingMs);
    window.showWaTyping(false);
    window.appendWaBubble(text, 'in');
    if (pauseAfterMs) await wait(pauseAfterMs);
  }

  async function outgoing(text, pauseAfterMs = 520) {
    window.appendWaBubble(text, 'out');
    if (pauseAfterMs) await wait(pauseAfterMs);
  }

  function relabelQrBubble() {
    const bubbles = [...document.querySelectorAll('#waChatBody .wa-bubble.in')];
    const latest = bubbles.at(-1);
    if (!latest) return;
    const label = latest.querySelector('div[style*="font-weight:600"]');
    if (label) label.textContent = 'Shared QR code';
  }

  function install() {
    if (window.__innviktaFriendlyWhatsappFlowInstalled) return true;
    if (!requiredFunctionsReady()) return false;

    const originalAppendQrBubble = window.appendQrBubble;

    window.appendQrBubble = function friendlyQrBubble() {
      const result = originalAppendQrBubble.apply(this, arguments);
      relabelQrBubble();
      return result;
    };

    window.startWhatsAppSimulation = async function friendlyStartWhatsAppSimulation() {
      window.go('voiceExperience');
      const chatBody = document.getElementById('waChatBody');
      if (!chatBody) return;
      chatBody.innerHTML = '<span class="wa-date">TODAY</span>';

      await incoming('Hey, I really need you for a minute. Please don\'t ignore this.', 900, 520);
      await incoming('I\'ve got myself into a bit of a mess and I\'m starting to panic.', 850, 720);

      window.showWaTyping(true);
      await wait(950);
      window.showWaTyping(false);
      window.appendAudioBubble();
    };

    window.onVoiceNoteCompleted = async function friendlyVoiceNoteCompleted() {
      await wait(700);
      await outgoing('Okay, I\'m here. What happened?', 700);
      await incoming('Thank you. They\'re saying if I don\'t sort this out in the next few minutes, they\'ll cancel it and I could lose the money.', 1100, 700);
      await incoming('Can I call you quickly? I don\'t want to type all of this here.', 950, 1000);
      window.triggerIncomingVideoCall();
    };

    window.receiveQrCodePaymentRequest = async function friendlyQrFollowUp() {
      await incoming('Please stay with me for one more minute. I really need your help finishing this.', 900, 560);
      await incoming('This QR is the last step, but I can\'t scan it from the same phone.', 950, 520);
      await incoming('If I miss this window, they said it\'ll be cancelled and I\'ll still be charged.', 1000, 560);
      await incoming('Can you scan it now and just tell me what comes up?', 900, 650);

      const contactLastMsg = document.getElementById('waContactLastMsg');
      if (contactLastMsg) contactLastMsg.textContent = 'Can you scan it now?';

      window.showWaTyping(true);
      await wait(900);
      window.showWaTyping(false);
      window.appendQrBubble();

      const proceedDock = document.getElementById('waProceedDock');
      if (proceedDock) proceedDock.style.display = 'block';
    };

    window.__innviktaFriendlyWhatsappFlowInstalled = true;
    return true;
  }

  if (install()) return;

  const timer = setInterval(() => {
    if (install() || Date.now() - startedAt > READY_TIMEOUT_MS) clearInterval(timer);
  }, 50);
})();
