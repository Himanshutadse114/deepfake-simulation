(() => {
  const SAFE_QR_SIZE = 41;
  const SAFE_QR_BITS = '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001111111000010110110100100011111110000000010000010110100101010111010100000100000000101110100010011111101001101011101000000001011101001111110111011111010111010000000010111010111111101110101000101110100000000100000100110000110111111001000001000000001111111010101010101010101011111110000000000000000000000110101010100000000000000000101010100111001011100101100010010000000001101110010110110111010101000011110000000011011111100010101011011101001010100000000101011011011011011100101010100010000000001011001000000011101010101100111000000000011100101001110111011111110010110000000000101010110110110111111100001010101000000000010110011111000101011111100101100000000011010111100011111111000111110111100000000101000010010001010110110100000010000000000000011011101001010011110010001010000000000101100110111000000000000000001010100000000010001110010010000000100011000110000000000111110000110101000101000000011010000000010111110001100000110000101100000000000000010100010000000101010101000000011000000001011101110010010000011011111110010000000000000000100111101110010110001010100000000111111100101100100111011101011000000000001000001001001100011001011000111000000000010111010101001001010101111111000100000000101110100111111111111000011001111000000001011101011110101110111111010110010000000010000010000010001110100011100011100000000111111101111110100110010001001101000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

  function buildSafeQrSvg() {
    let rects = '';
    for (let y = 0; y < SAFE_QR_SIZE; y += 1) {
      for (let x = 0; x < SAFE_QR_SIZE; x += 1) {
        if (SAFE_QR_BITS[y * SAFE_QR_SIZE + x] === '1') {
          rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
        }
      }
    }
    return `<svg class="wa-real-qr" width="184" height="184" viewBox="0 0 ${SAFE_QR_SIZE} ${SAFE_QR_SIZE}" role="img" aria-label="Awareness simulation QR code" shape-rendering="crispEdges"><rect width="${SAFE_QR_SIZE}" height="${SAFE_QR_SIZE}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  }

  function scrollChatToBottom() {
    const chatBody = document.getElementById('waChatBody');
    if (!chatBody) return;
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendVictimPaymentBubble() {
    if (typeof window.appendWaBubble === 'function') {
      window.appendWaBubble("Done, I've sent the $5 payment.", 'out');
    }
    const last = document.getElementById('waContactLastMsg');
    if (last) last.textContent = 'Payment sent';
    scrollChatToBottom();
  }

  function appendSimulationCompleteMarker() {
    const chatBody = document.getElementById('waChatBody');
    if (!chatBody || document.getElementById('waSimulationComplete')) return;
    const marker = document.createElement('div');
    marker.id = 'waSimulationComplete';
    marker.className = 'wa-simulation-complete';
    marker.innerHTML = '<strong>Simulation complete</strong><span>The victim trusted the impersonation and sent the payment.</span>';
    chatBody.appendChild(marker);
    scrollChatToBottom();
  }

  function showCompletionActions() {
    appendSimulationCompleteMarker();
    const dock = document.getElementById('waProceedDock');
    if (dock) dock.style.display = 'block';
    const status = document.getElementById('waStatus');
    if (status) status.textContent = 'online';
    scrollChatToBottom();
  }

  window.appendQrBubble = function appendQrBubble() {
    const chatBody = document.getElementById('waChatBody');
    if (!chatBody) return;
    const bubble = document.createElement('div');
    bubble.className = 'wa-bubble in wa-qr-bubble';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    bubble.innerHTML = `
      <div class="wa-qr-title">Simulation payment request</div>
      <div class="wa-qr-code">${buildSafeQrSvg()}</div>
      <div class="wa-qr-caption">Scan to inspect · awareness demo</div>
      <span class="wa-time">${timeStr}</span>
    `;
    chatBody.appendChild(bubble);
    scrollChatToBottom();
  };

  // Finish the WhatsApp story only after the learner sees that the victim acted
  // on the impersonation. The QR remains harmless awareness content.
  window.receiveQrCodePaymentRequest = function receiveQrCodePaymentRequest() {
    const dock = document.getElementById('waProceedDock');
    if (dock) dock.style.display = 'none';
    window.showWaTyping?.(true);

    setTimeout(() => {
      window.showWaTyping?.(false);
      window.appendWaBubble?.('We are facing a server timeout. Please scan this QR code to complete the processing payment of $5 urgently.', 'in');
      const contactLastMsg = document.getElementById('waContactLastMsg');
      if (contactLastMsg) contactLastMsg.textContent = 'Please scan this QR code...';

      setTimeout(() => {
        window.showWaTyping?.(true);
        setTimeout(() => {
          window.showWaTyping?.(false);
          window.appendQrBubble();

          setTimeout(() => {
            appendVictimPaymentBubble();
            setTimeout(showCompletionActions, 700);
          }, 1300);
        }, 1500);
      }, 1500);
    }, 1800);
  };

  window.replayWhatsAppSimulation = function replayWhatsAppSimulation() {
    try { window.stopGeneratedPlayback?.(); } catch (_) {}
    const dock = document.getElementById('waProceedDock');
    if (dock) dock.style.display = 'none';
    const status = document.getElementById('waStatus');
    if (status) status.textContent = 'online';
    const last = document.getElementById('waContactLastMsg');
    if (last) last.textContent = 'Voice message';
    window.startWhatsAppSimulation?.();
  };

  function installActions() {
    const dock = document.getElementById('waProceedDock');
    if (!dock) return;
    dock.innerHTML = `
      <div class="wa-completion-copy">
        <strong>You saw the scam succeed.</strong>
        <span>The familiar voice, urgency and payment prompt were enough to convince the simulated victim.</span>
      </div>
      <div class="wa-proceed-actions">
        <button class="secondary wa-replay-btn" type="button" onclick="replayWhatsAppSimulation()">↻ Replay</button>
        <button class="primary wa-next-btn" type="button" onclick="openProfileExperience()">Convinced? Let’s move further →</button>
      </div>
    `;
  }

  const style = document.createElement('style');
  style.textContent = `
    .wa-chatbody{overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;scrollbar-gutter:stable;scroll-behavior:smooth}
    .wa-chatbody::-webkit-scrollbar{width:8px}
    .wa-chatbody::-webkit-scrollbar-track{background:rgba(255,255,255,.02)}
    .wa-chatbody::-webkit-scrollbar-thumb{background:#37444b;border-radius:999px}
    .wa-chatbody::-webkit-scrollbar-thumb:hover{background:#4a5a63}
    .wa-qr-bubble{width:max-content;max-width:min(100%,340px)!important;padding:12px 14px 22px!important}
    .wa-qr-title{font-weight:700;margin-bottom:9px;color:var(--orange2);font-size:13px}
    .wa-qr-code{display:grid;place-items:center;background:#fff;padding:10px;border-radius:10px;width:max-content;box-shadow:0 1px 1px rgba(0,0,0,.08),0 8px 22px rgba(0,0,0,.18)}
    .wa-real-qr{display:block;background:#fff;max-width:min(184px,48vw);height:auto}
    .wa-qr-caption{font-size:10px;color:#8696a0;margin-top:8px;letter-spacing:.02em}
    .wa-simulation-complete{align-self:center;max-width:min(520px,92%);display:flex;flex-direction:column;align-items:center;gap:4px;margin:8px auto 2px;padding:9px 13px;border-radius:999px;border:1px solid rgba(241,90,36,.34);background:rgba(241,90,36,.10);color:#e9edef;text-align:center;font-size:10px;line-height:1.35}
    .wa-simulation-complete strong{color:var(--orange2);font-size:10px;letter-spacing:.04em;text-transform:uppercase}
    .wa-simulation-complete span{color:#aebac1}
    #waProceedDock{padding-left:18px!important;padding-right:18px!important}
    .wa-completion-copy{width:min(650px,100%);margin:0 auto 10px;text-align:center;display:flex;flex-direction:column;gap:3px}
    .wa-completion-copy strong{font-size:13px;color:var(--text)}
    .wa-completion-copy span{font-size:10px;color:var(--muted);line-height:1.4}
    .wa-proceed-actions{width:min(650px,100%);margin:0 auto;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
    .wa-proceed-actions .wa-replay-btn{min-width:130px;min-height:48px}
    .wa-proceed-actions .wa-next-btn{min-width:min(390px,100%);min-height:48px;padding:12px 24px}
    @media(max-width:640px){.wa-proceed-actions{flex-direction:column-reverse}.wa-proceed-actions button{width:100%!important;min-width:0!important}.wa-real-qr{max-width:160px}.wa-simulation-complete{border-radius:12px}}
  `;
  document.head.appendChild(style);
  installActions();
})();
