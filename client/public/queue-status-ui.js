(() => {
  let queueTimer = null;
  let countdownTimer = null;
  let countdownStartedAt = 0;
  const ESTIMATE_SECONDS = 120;

  const style = document.createElement('style');
  style.textContent = `
    #generationQueueNotice{
      display:none;
      margin:18px 0 0;
      padding:15px 16px;
      border:1px solid rgba(255,157,85,.25);
      border-radius:10px;
      background:rgba(241,90,36,.07);
      text-align:left;
    }
    #generationQueueNotice.show{display:block}
    #generationQueueNotice strong{
      display:block;
      margin-bottom:5px;
      font-size:14px;
      line-height:1.35;
      font-family:Inter,system-ui,sans-serif;
      font-weight:650;
      color:var(--text,#f7f8fb);
    }
    #generationQueueNotice span{
      display:block;
      font-size:12px;
      line-height:1.55;
      color:var(--muted,#98a2b4);
    }
    #generationQueueNotice .queue-pulse{
      display:inline-block;
      width:7px;
      height:7px;
      margin-right:8px;
      border-radius:50%;
      background:var(--orange2,#ff9d55);
      box-shadow:0 0 0 0 rgba(255,157,85,.35);
      animation:queuePulse 1.6s infinite;
      vertical-align:1px;
    }
    #generationTimeEstimate{
      margin:18px auto 0;
      width:min(520px,100%);
      padding:16px;
      border:1px solid rgba(255,255,255,.1);
      border-radius:12px;
      background:rgba(255,255,255,.035);
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:12px 18px;
      align-items:center;
      text-align:left;
    }
    #generationTimeEstimate .estimate-kicker{
      display:block;
      margin-bottom:4px;
      color:var(--orange2,#ff9d55);
      font-size:9px;
      font-weight:800;
      letter-spacing:.12em;
      text-transform:uppercase;
    }
    #generationTimeEstimate strong{
      display:block;
      color:var(--text,#f7f8fb);
      font-size:13px;
      line-height:1.35;
      font-weight:680;
    }
    #generationTimeEstimate p{
      margin:4px 0 0;
      color:var(--muted,#98a2b4);
      font-size:11px;
      line-height:1.45;
    }
    #generationCountdown{
      min-width:72px;
      text-align:center;
      font-variant-numeric:tabular-nums;
      color:#fff;
      font-size:23px;
      font-weight:780;
      letter-spacing:-.02em;
    }
    #generationEstimateBar{
      grid-column:1/-1;
      height:4px;
      overflow:hidden;
      border-radius:999px;
      background:rgba(255,255,255,.08);
    }
    #generationEstimateBar>i{
      display:block;
      width:100%;
      height:100%;
      transform-origin:left center;
      background:linear-gradient(90deg,var(--orange,#f15a24),var(--orange2,#ff9d55));
      transition:transform .45s linear;
    }
    #generationTimeEstimate.finishing #generationCountdown{font-size:13px;line-height:1.25;color:var(--orange2,#ff9d55)}
    @keyframes queuePulse{
      0%{box-shadow:0 0 0 0 rgba(255,157,85,.35)}
      70%{box-shadow:0 0 0 8px rgba(255,157,85,0)}
      100%{box-shadow:0 0 0 0 rgba(255,157,85,0)}
    }
    @media(max-width:700px){
      #generationQueueNotice{margin-top:14px;padding:13px 14px}
      #generationQueueNotice strong{font-size:13px}
      #generationQueueNotice span{font-size:11px}
      #generationTimeEstimate{margin-top:14px;padding:14px;grid-template-columns:minmax(0,1fr) auto;gap:10px 12px}
      #generationCountdown{font-size:20px;min-width:62px}
    }
  `;
  document.head.appendChild(style);

  function ensureNotice() {
    let notice = document.getElementById('generationQueueNotice');
    if (notice) return notice;
    const eta = document.getElementById('genEta');
    if (!eta) return null;
    notice = document.createElement('div');
    notice.id = 'generationQueueNotice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.innerHTML = `
      <strong><i class="queue-pulse" aria-hidden="true"></i>Your simulation is in the queue</strong>
      <span>All generation slots are currently in use. Your simulation will start automatically when a slot becomes available.</span>`;
    eta.insertAdjacentElement('afterend', notice);
    return notice;
  }

  function ensureEstimate() {
    let estimate = document.getElementById('generationTimeEstimate');
    if (estimate) return estimate;
    const eta = document.getElementById('genEta');
    if (!eta) return null;
    estimate = document.createElement('div');
    estimate.id = 'generationTimeEstimate';
    estimate.setAttribute('role', 'timer');
    estimate.setAttribute('aria-live', 'off');
    estimate.innerHTML = `
      <div>
        <span class="estimate-kicker">Typical preparation time</span>
        <strong>Your complete simulation usually takes about 2 minutes to prepare.</strong>
        <p>We are creating the cloned audio, deepfake video and three social-profile images. Keep this page open while everything finishes.</p>
      </div>
      <b id="generationCountdown">02:00</b>
      <div id="generationEstimateBar"><i></i></div>`;
    const queueNotice = document.getElementById('generationQueueNotice');
    (queueNotice || eta).insertAdjacentElement('afterend', estimate);
    return estimate;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    const remainder = String(safe % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function renderCountdown() {
    const estimate = ensureEstimate();
    if (!estimate || !countdownStartedAt) return;
    const elapsed = Math.max(0, (Date.now() - countdownStartedAt) / 1000);
    const remaining = Math.max(0, ESTIMATE_SECONDS - elapsed);
    const countdown = document.getElementById('generationCountdown');
    const bar = document.querySelector('#generationEstimateBar>i');
    if (bar) bar.style.transform = `scaleX(${Math.max(0, remaining / ESTIMATE_SECONDS)})`;

    if (remaining > 0) {
      estimate.classList.remove('finishing');
      if (countdown) countdown.textContent = formatTime(remaining);
    } else {
      estimate.classList.add('finishing');
      if (countdown) countdown.textContent = 'Finishing up…';
    }
  }

  function startCountdown() {
    ensureEstimate();
    if (countdownStartedAt) return;
    countdownStartedAt = Date.now();
    renderCountdown();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(renderCountdown, 500);
  }

  function stopCountdown({ hide = false } = {}) {
    clearInterval(countdownTimer);
    countdownTimer = null;
    countdownStartedAt = 0;
    const estimate = document.getElementById('generationTimeEstimate');
    if (hide && estimate) estimate.style.display = 'none';
  }

  function hideQueueNotice() {
    clearTimeout(queueTimer);
    queueTimer = null;
    document.getElementById('generationQueueNotice')?.classList.remove('show');
  }

  function scheduleQueueNotice() {
    clearTimeout(queueTimer);
    queueTimer = setTimeout(() => {
      if (window.currentGenerationStatus !== 'queued' || window.runMode === 'demo') return;
      ensureNotice()?.classList.add('show');
    }, 1800);
  }

  function install() {
    if (window.__innviktaQueueStatusUiInstalled) return true;
    if (typeof window.updateGenerationFromServer !== 'function') return false;
    const original = window.updateGenerationFromServer;
    window.updateGenerationFromServer = function queueAwareGenerationUpdate(payload) {
      const result = original.apply(this, arguments);
      const status = String(payload?.status || window.currentGenerationStatus || '');
      const terminal = ['completed', 'failed'].includes(status);

      if (!terminal && window.runMode !== 'demo') {
        const estimate = ensureEstimate();
        if (estimate) estimate.style.display = 'grid';
        startCountdown();
      } else {
        stopCountdown({ hide: true });
      }

      if (status === 'queued' && window.runMode !== 'demo') scheduleQueueNotice();
      else hideQueueNotice();
      return result;
    };
    window.__innviktaQueueStatusUiInstalled = true;
    ensureNotice();
    ensureEstimate();
    return true;
  }

  if (!install()) {
    const timer = setInterval(() => {
      if (install()) clearInterval(timer);
    }, 50);
    setTimeout(() => clearInterval(timer), 12000);
  }
})();
