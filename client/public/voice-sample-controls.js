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
      previewButton: document.getElementById('voicePreviewBtn'),
      fileName: document.getElementById('audioFileName'),
      status: document.getElementById('audioStatus')
    };
  }

  function showToast(message) {
    try {
      if (typeof window.toast === 'function') window.toast(message);
    } catch (_) {}
  }

  function setPreviewState(state) {
    const { previewButton } = getUi();
    if (!previewButton) return;
    const icon = previewButton.querySelector('[data-voice-preview-icon]');
    const label = previewButton.querySelector('[data-voice-preview-label]');
    const playing = state === 'playing';
    const loading = state === 'loading';
    previewButton.dataset.playbackState = state;
    previewButton.disabled = loading;
    previewButton.setAttribute('aria-label', playing ? 'Pause my recording' : 'Play my recording');
    if (icon) icon.textContent = loading ? '…' : playing ? 'Ⅱ' : '▶';
    if (label) label.textContent = loading ? 'Loading recording…' : playing ? 'Pause recording' : 'Play my recording';
  }

  function assignPreviewSource(preview, file) {
    if (!preview || !file) return false;
    const objectUrl = URL.createObjectURL(file);
    try {
      if (typeof uploadedAudioUrl !== 'undefined' && uploadedAudioUrl && uploadedAudioUrl !== objectUrl) {
        URL.revokeObjectURL(uploadedAudioUrl);
      }
      uploadedAudioUrl = objectUrl;
    } catch (_) {}
    preview.src = objectUrl;
    preview.load?.();
    return true;
  }

  async function toggleRecordingPreview(event) {
    stopEvent(event);
    const { preview, input } = getUi();
    if (!preview) return;

    if (!preview.paused && !preview.ended) {
      preview.pause();
      return;
    }

    if (!preview.getAttribute('src') && !assignPreviewSource(preview, input?.files?.[0])) {
      showToast('Record your voice before playing the preview.');
      return;
    }

    if (preview.ended) preview.currentTime = 0;
    setPreviewState('loading');
    try {
      await preview.play();
    } catch (firstError) {
      const recovered = assignPreviewSource(preview, input?.files?.[0]);
      if (recovered) {
        try {
          await preview.play();
          return;
        } catch (_) {}
      }
      console.error('Recording preview failed', firstError);
      setPreviewState('idle');
      showToast('The recording preview could not play. Please record again.');
    }
  }

  function bindPreviewControls() {
    const { preview, previewButton } = getUi();
    if (!preview || !previewButton) return;
    if (previewButton.dataset.previewBound !== 'true') {
      previewButton.dataset.previewBound = 'true';
      previewButton.addEventListener('click', toggleRecordingPreview);
    }
    if (preview.dataset.previewBound !== 'true') {
      preview.dataset.previewBound = 'true';
      preview.addEventListener('play', () => setPreviewState('playing'));
      preview.addEventListener('pause', () => setPreviewState('idle'));
      preview.addEventListener('ended', () => setPreviewState('idle'));
      preview.addEventListener('error', () => setPreviewState('idle'));
    }
    setPreviewState(preview.paused ? 'idle' : 'playing');
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
    if (fileName) fileName.textContent = 'Recording ready';
    if (status) {
      status.textContent = 'Waiting for recording';
      status.classList.remove('ready');
    }

    try { recordedInApp = false; } catch (_) {}
    try { recordingCancelled = false; } catch (_) {}
    try { audioChunks = []; } catch (_) {}

    if (typeof checkMediaReady === 'function') checkMediaReady();
    showToast('Recording removed. Record your voice again when ready.');
    setPreviewState('idle');
    updateLabels();
  }

  function recordAgain(event) {
    stopEvent(event);
    try { getUi().preview?.pause?.(); } catch (_) {}
    if (typeof startRecording !== 'function') return;
    // Do not clear the accepted sample here. If the learner cancels the new
    // recording, the previously accepted recording remains available.
    startRecording(event || { preventDefault() {}, stopPropagation() {} });
  }

  function install() {
    const { ready } = getUi();
    if (!ready) return false;

    let actions = document.getElementById('voiceReadyActions');
    if (!actions) {
      actions = document.createElement('div');
      actions.id = 'voiceReadyActions';
      actions.className = 'voice-ready-actions';
      actions.innerHTML = `
        <button type="button" class="secondary" data-voice-rerecord>Record again</button>
        <button type="button" class="ghost voice-remove-action" data-voice-remove>Remove recording</button>`;
      ready.appendChild(actions);
    }

    if (actions.dataset.controlsBound !== 'true') {
      actions.dataset.controlsBound = 'true';
      actions.querySelector('[data-voice-rerecord]')?.addEventListener('click', recordAgain);
      actions.querySelector('[data-voice-remove]')?.addEventListener('click', clearVoiceSample);
    }
    bindPreviewControls();

    const observer = new MutationObserver(updateLabels);
    observer.observe(ready, { attributes: true, attributeFilter: ['class'] });
    updateLabels();
    return true;
  }

  if (!document.getElementById('voiceSampleControlStyles')) {
    const style = document.createElement('style');
    style.id = 'voiceSampleControlStyles';
    style.textContent = `
      #audioDrop{cursor:default!important;padding:24px!important}
      #audioReady.show{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:18px!important;width:min(100%,520px)!important;margin:auto!important;padding:0!important;text-align:left!important}
      .voice-ready-copy{display:flex!important;align-items:center!important;gap:12px!important;min-width:0!important}
      .voice-ready-copy>div{min-width:0!important}
      .voice-ready-copy b{display:block!important;font-size:15px!important;line-height:1.25!important;margin-bottom:4px!important}
      .voice-ready-check{display:grid!important;place-items:center!important;flex:0 0 42px!important;width:42px!important;height:42px!important;border-radius:50%!important;background:rgba(70,201,121,.12)!important;border:1px solid rgba(70,201,121,.3)!important;color:#7ddfa4!important;font-size:19px!important;font-weight:900!important}
      .voice-preview-action{pointer-events:auto!important;position:relative!important;z-index:8!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;min-width:176px!important;min-height:46px!important;padding:10px 16px!important;border-radius:999px!important;background:linear-gradient(135deg,var(--orange,#f15a24),var(--orange3,#ff5f19))!important;border:0!important;color:#fff!important;box-shadow:0 10px 24px rgba(241,90,36,.22)!important;font-size:11px!important;font-weight:850!important;white-space:nowrap!important;cursor:pointer!important}
      .voice-preview-action:hover{filter:brightness(1.06)!important}
      .voice-preview-action:disabled{opacity:.68!important;cursor:wait!important}
      .voice-ready-actions{grid-column:1/-1!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;width:100%!important;padding-top:16px!important;border-top:1px solid var(--line,rgba(255,255,255,.1))!important;position:relative!important;z-index:7!important}
      .voice-ready-actions button{pointer-events:auto!important;width:100%!important;min-height:44px!important;padding:9px 13px!important;border-radius:9px!important;font-size:11px!important;white-space:nowrap!important}
      .voice-remove-action{color:var(--red,#ff5d68)!important;border-color:rgba(255,93,104,.28)!important}
      #audioStatus{align-self:flex-start!important;margin-top:10px!important;padding:6px 9px!important;border-radius:999px!important;border:1px solid var(--line,rgba(255,255,255,.1))!important;color:var(--muted,#98a2b4)!important;font-size:10px!important;line-height:1!important}
      #audioStatus.ready{color:#7ddfa4!important;border-color:rgba(70,201,121,.3)!important;background:rgba(70,201,121,.06)!important}
      @media(max-width:640px){
        #audioDrop{padding:18px!important}
        #audioReady.show{grid-template-columns:1fr!important;gap:14px!important;text-align:center!important}
        .voice-ready-copy{justify-content:center!important;text-align:left!important}
        .voice-preview-action{width:100%!important}
        .voice-ready-actions{grid-column:1!important;padding-top:14px!important}
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
