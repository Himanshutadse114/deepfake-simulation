(() => {
  let queueTimer = null;

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
    @keyframes queuePulse{
      0%{box-shadow:0 0 0 0 rgba(255,157,85,.35)}
      70%{box-shadow:0 0 0 8px rgba(255,157,85,0)}
      100%{box-shadow:0 0 0 0 rgba(255,157,85,0)}
    }
    @media(max-width:700px){
      #generationQueueNotice{margin-top:14px;padding:13px 14px}
      #generationQueueNotice strong{font-size:13px}
      #generationQueueNotice span{font-size:11px}
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

  function hideQueueNotice() {
    clearTimeout(queueTimer);
    queueTimer = null;
    document.getElementById('generationQueueNotice')?.classList.remove('show');
  }

  function scheduleQueueNotice() {
    clearTimeout(queueTimer);
    // Active jobs leave "queued" almost immediately. A short delay prevents
    // users who already have a worker slot from seeing a misleading busy notice.
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
      if (status === 'queued' && window.runMode !== 'demo') scheduleQueueNotice();
      else hideQueueNotice();
      return result;
    };
    window.__innviktaQueueStatusUiInstalled = true;
    ensureNotice();
    return true;
  }

  if (!install()) {
    const timer = setInterval(() => {
      if (install()) clearInterval(timer);
    }, 50);
    setTimeout(() => clearInterval(timer), 12000);
  }
})();
