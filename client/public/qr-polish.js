(() => {
  const SIZE = 33;
  const BITS = '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011111110010110010011111110000000010000010101000001010000010000000010111010110101101010111010000000010111010110010101010111010000000010111010010110001010111010000000010000010011110110010000010000000011111110101010101011111110000000000000000100000010000000000000000010000010110001110110011100000000000101101010101011100111110000000011010010100110011111110110000000000101100111111110000011010000000010111110011010111110111100000000010100101100000110011011110000000010111110101110100101001010000000010100000101101111011100010000000010100111010111111111111110000000000000000110010101000101100000000011111110011110111010101110000000010000010011010011000100000000000010111010011001001111100010000000010111010010001001101010110000000010111010000011101110111010000000010000010010011000010110000000000011111110101011010110001110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

  function buildQr() {
    let modules = '';
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (BITS[y * SIZE + x] === '1') modules += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
    return `<svg class="wa-real-qr" viewBox="0 0 ${SIZE} ${SIZE}" width="148" height="148" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="Scannable Innvikta awareness demo QR"><rect width="${SIZE}" height="${SIZE}" fill="#fff"/><g fill="#000">${modules}</g></svg>`;
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
      <div class="wa-qr-code">${buildQr()}</div>
      <div class="wa-qr-caption">Awareness demo · no payment destination</div>
      <span class="wa-time">${timeStr}</span>
    `;
    chatBody.appendChild(bubble);
    requestAnimationFrame(() => { chatBody.scrollTop = chatBody.scrollHeight; });
  };

  const style = document.createElement('style');
  style.textContent = `
    .wa-qr-bubble{overflow:visible!important}
    .wa-qr-code{box-sizing:content-box!important;aspect-ratio:1/1!important}
    .wa-real-qr{aspect-ratio:1/1!important;image-rendering:pixelated;shape-rendering:crispEdges}
  `;
  document.head.appendChild(style);
})();
