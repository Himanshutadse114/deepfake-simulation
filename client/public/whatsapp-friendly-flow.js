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

      await incoming('Hey, sorry to bother you — are you free for a minute?', 900, 520);
      await incoming('I could really use your help with something.', 760, 700);

      window.showWaTyping(true);
      await wait(950);
      window.showWaTyping(false);
      window.appendAudioBubble();
    };

    window.onVoiceNoteCompleted = async function friendlyVoiceNoteCompleted() {
      await wait(700);
      await outgoing('Yeah, of course. What\'s going on?', 700);
      await incoming('Thank you 🙏 I knew I could ask you.', 850, 520);
      await incoming('I\'m trying to sort something out and I\'m a bit stuck. Can I call you for a minute? It\'s easier to explain.', 1150, 1100);
      window.triggerIncomingVideoCall();
    };

    window.receiveQrCodePaymentRequest = async function friendlyQrFollowUp() {
      await incoming('Thanks for picking up. I really appreciate it.', 820, 560);
      await incoming('One last thing — this QR came up on my screen and I can\'t open it from the same phone.', 1050, 560);
      await incoming('Could you scan it for me and tell me what you see? No rush.', 950, 650);

      const contactLastMsg = document.getElementById('waContactLastMsg');
      if (contactLastMsg) contactLastMsg.textContent = 'Could you scan it for me?';

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
