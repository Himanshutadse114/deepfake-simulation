(() => {
  function stopEvent(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  function getUi() {
    return {
      ready: document.getElementById('audioReady'),
      prompt: document.getElementById('audioPrompt'),
      input: document.getElementById('audioInput'),
      preview: document.getElementById('audioPreview'),
      fileName: document.getElementById('audioFileName'),
      status: document.getElementById('audioStatus')
    };
  }

  function isRecordedInApp() {
    try {
      return typeof recordedInApp !== 'undefined' && Boolean(recordedInApp);
    } catch (_) {
      return false;
    }
  }

  function updateLabels() {
    const controls = document.getElementById('voiceReadyActions');
    if (!controls) return;
    const remove = controls.querySelector('[data-voice-remove]');
    const rerecord = controls.querySelector('[data-voice-rerecord]');
    const recorded = isRecordedInApp();
    if (remove) remove.textContent = recorded ? 'Remove recording' : 'Remove voice sample';
    if (rerecord) rerecord.textContent = recorded ? 'Record again' : 'Record instead';
  }

  function clearVoiceSample(event) {
    stopEvent(event);
    const { ready, prompt, input, preview, fileName, status } = getUi();

    try {
      preview?.pause?.();
      if (preview) {
        preview.removeAttribute('src');
        preview.load?.();
      }
    } catch (_) {}

    try {
      if (typeof uploadedAudioUrl !== 'undefined' && uploadedAudioUrl) {
        URL.revokeObjectURL(uploadedAudioUrl);
        uploadedAudioUrl = '';
      }
    } catch (_) {}

    if (input) input.value = '';
    if (ready) ready.classList.remove('show');
    if (prompt) prompt.style.display = '';
    if (fileName) fileName.textContent = 'Voice sample ready';
    if (status) {
      status.textContent = 'Waiting for voice';
      status.classList.remove('ready');
    }

    try { recordedInApp = false; } catch (_) {}
    try { recordingCancelled = false; } catch (_) {}
    try { audioChunks = []; } catch (_) {}

    if (typeof checkMediaReady === 'function') checkMediaReady();
    if (typeof toast === 'function') toast('Voice sample removed. Record again or upload a new sample.');
    updateLabels();
  }

  function recordAgain(event) {
    stopEvent(event);
    if (typeof startRecording !== 'function') return;
    // Do not clear the accepted sample here. If the learner cancels the new
    // recording, the previously accepted recording remains available.
    startRecording(event || { preventDefault() {}, stopPropagation() {} });
  }

  function install() {
    const { ready } = getUi();
    if (!ready || document.getElementById('voiceReadyActions')) return false;

    const actions = document.createElement('div');
    actions.id = 'voiceReadyActions';
    actions.className = 'voice-ready-actions';
    actions.innerHTML = `
      <button type="button" class="secondary" data-voice-rerecord>Record again</button>
      <button type="button" class="ghost voice-remove-action" data-voice-remove>Remove recording</button>`;
    ready.appendChild(actions);

    actions.querySelector('[data-voice-rerecord]')?.addEventListener('click', recordAgain);
    actions.querySelector('[data-voice-remove]')?.addEventListener('click', clearVoiceSample);

    const observer = new MutationObserver(updateLabels);
    observer.observe(ready, { attributes: true, attributeFilter: ['class'] });
    updateLabels();
    return true;
  }

  if (!document.getElementById('voiceSampleControlStyles')) {
    const style = document.createElement('style');
    style.id = 'voiceSampleControlStyles';
    style.textContent = `
      #audioReady.show{display:flex!important;align-items:center!important;gap:12px!important;flex-wrap:wrap!important}
      #audioReady.show>div:not(.voice-ready-actions){min-width:0;flex:1 1 180px}
      .voice-ready-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex:1 0 100%;padding-top:10px;border-top:1px solid var(--line,rgba(255,255,255,.1));position:relative;z-index:7}
      .voice-ready-actions button{pointer-events:auto!important;min-height:40px!important;padding:8px 13px!important;border-radius:8px!important;font-size:11px!important;white-space:nowrap}
      .voice-remove-action{color:var(--red,#ff5d68)!important;border-color:rgba(255,93,104,.28)!important}
      @media(max-width:640px){
        .voice-ready-actions{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:8px}
        .voice-ready-actions button{width:100%;min-height:44px!important}
      }
    `;
    document.head.appendChild(style);
  }

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
