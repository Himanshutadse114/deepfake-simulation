(() => {
  const isDemo = document.documentElement.dataset.demoInstance === 'true' || location.pathname === '/demo';

  // Main site should expose only the real simulation entry. Demo lives at /demo.
  if (!isDemo) {
    document.querySelectorAll('.intro-actions .demo-action,[data-run-mode="demo"]').forEach((el) => el.remove());
    const introActions = document.querySelector('.intro-actions');
    if (introActions) {
      [...introActions.querySelectorAll('button,a')].forEach((el) => {
        if (/\bdemo\b/i.test(el.textContent || '')) el.remove();
      });
    }
  }

  // Remove native paid/provider warning dialogs from the learner journey.
  // Other unrelated browser dialogs keep their original behaviour.
  const paidDialogPattern = /(paid\s*ai|paid|credit|credits|cost|charge|replicate|pruna|flux|qwen|provider|ai\s*generation)/i;
  const nativeConfirm = window.confirm.bind(window);
  const nativeAlert = window.alert.bind(window);
  window.confirm = (message) => paidDialogPattern.test(String(message || '')) ? true : nativeConfirm(message);
  window.alert = (message) => {
    if (paidDialogPattern.test(String(message || ''))) {
      if (typeof window.toast === 'function') window.toast('Preparing your simulation…');
      return;
    }
    nativeAlert(message);
  };

  // Loading language should describe what the learner experiences, not vendors/models.
  const loadingScreen = document.querySelector('.screen[data-screen="generate"]');
  if (loadingScreen) {
    const kicker = loadingScreen.querySelector('.generate-copy .kicker');
    if (kicker) kicker.textContent = 'Simulation preparation in progress';

    const stepLabels = [
      'Loading facial structure',
      'Decoding facial landmarks',
      'Cloning your voice',
      'Synchronising voice and facial movement',
      'Preparing four profile variations'
    ];
    loadingScreen.querySelectorAll('.gen-step').forEach((step, index) => {
      const dot = step.querySelector('.dot');
      step.textContent = stepLabels[index] || 'Preparing your simulation';
      if (dot) step.prepend(dot);
    });

    const scanLabel = loadingScreen.querySelector('.scan-label span');
    if (scanLabel) scanLabel.textContent = 'Secure simulation pipeline';
  }

  window.generationMessage = function generationMessage(percent) {
    if (percent < 20) return 'Loading facial structure';
    if (percent < 40) return 'Decoding facial landmarks';
    if (percent < 62) return 'Cloning your voice';
    if (percent < 82) return 'Synchronising voice and facial movement';
    if (percent < 96) return 'Preparing four profile variations';
    return 'Finalising your simulation';
  };

  const neutralStatusDetail = (status) => {
    switch (String(status || '').toLowerCase()) {
      case 'queued': return 'Preparing your simulation…';
      case 'validating': return 'Loading facial structure and voice sample…';
      case 'cloning_whatsapp': return 'Cloning your voice for the message…';
      case 'cloning_video': return 'Cloning your voice for the video…';
      case 'generating_video': return 'Decoding facial structure and synchronising movement…';
      case 'generating_profile': return 'Preparing four profile variations…';
      case 'reconnecting': return 'Connection interrupted. Your outputs are still processing; reconnecting automatically…';
      case 'watermarking': return 'Finalising the simulation…';
      case 'completed': return 'Your simulation is ready.';
      case 'demo_preparing': return 'Loading your demo media…';
      default: return '';
    }
  };

  if (typeof window.updateGenerationFromServer === 'function') {
    const originalUpdateGenerationFromServer = window.updateGenerationFromServer;
    window.updateGenerationFromServer = function updateGenerationFromServer(payload = {}) {
      const detail = neutralStatusDetail(payload.status) || window.generationMessage(Number(payload.percent || 0));
      return originalUpdateGenerationFromServer.call(this, { ...payload, detail });
    };
  }

  // Keep Instagram strictly to four generated/profile images in every layout.
  function enforceFourInstagramImages() {
    ['igGrid', 'igMiniGrid'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      [...el.children].slice(4).forEach((child) => child.remove());
    });
  }

  if (typeof window.buildInstagramGrid === 'function') {
    const originalBuildInstagramGrid = window.buildInstagramGrid;
    window.buildInstagramGrid = function buildInstagramGrid(...args) {
      const result = originalBuildInstagramGrid.apply(this, args);
      enforceFourInstagramImages();
      return result;
    };
  }
  enforceFourInstagramImages();

  const style = document.createElement('style');
  style.textContent = `
    /* Laptop-safe landing page: never crop the CTA on shorter displays. */
    .screen[data-screen="intro"]{
      min-height:100dvh!important;
      overflow:hidden!important;
    }
    .screen[data-screen="intro"] .screen-inner{
      min-height:100dvh!important;
      height:auto!important;
      display:flex!important;
      flex-direction:column!important;
      overflow-y:auto!important;
      overscroll-behavior:contain;
    }
    .screen[data-screen="intro"] .viewport.center{
      flex:1 0 auto!important;
      min-height:0!important;
      height:auto!important;
      padding-top:clamp(48px,7vh,88px)!important;
      padding-bottom:18px!important;
    }
    .screen[data-screen="intro"] .hero{
      width:min(1320px,calc(100vw - 72px))!important;
      margin:auto!important;
      align-items:center!important;
      gap:clamp(34px,5vw,82px)!important;
    }
    .screen[data-screen="intro"] .intro-actions{
      position:static!important;
      inset:auto!important;
      flex:0 0 auto!important;
      width:min(620px,calc(100% - 40px))!important;
      margin:0 auto!important;
      padding:0 0 max(18px,env(safe-area-inset-bottom))!important;
    }
    .screen[data-screen="intro"] .intro-actions .primary{
      width:100%!important;
      max-width:620px!important;
      margin-inline:auto!important;
    }

    @media (min-width:901px) and (max-height:820px){
      .screen[data-screen="intro"] .viewport.center{
        padding-top:36px!important;
        padding-bottom:8px!important;
      }
      .screen[data-screen="intro"] .hero-copy h1{
        font-size:clamp(48px,5.1vw,74px)!important;
        line-height:.94!important;
      }
      .screen[data-screen="intro"] .hero-copy .muted{
        font-size:clamp(14px,1.15vw,17px)!important;
        line-height:1.5!important;
      }
      .screen[data-screen="intro"] .flow-pills{margin-top:14px!important}
      .screen[data-screen="intro"] .hero-visual{
        transform:scale(.88)!important;
        transform-origin:center!important;
      }
      .screen[data-screen="intro"] .intro-actions{
        padding-bottom:14px!important;
      }
    }

    @media (min-width:901px) and (max-height:700px){
      .screen[data-screen="intro"] .viewport.center{padding-top:24px!important}
      .screen[data-screen="intro"] .hero-copy h1{
        font-size:clamp(43px,4.55vw,64px)!important;
      }
      .screen[data-screen="intro"] .hero-copy .muted{font-size:14px!important}
      .screen[data-screen="intro"] .hero-visual{transform:scale(.78)!important}
      .screen[data-screen="intro"] .flow-pills{gap:7px!important;margin-top:10px!important}
      .screen[data-screen="intro"] .flow-pills span{padding:7px 10px!important;font-size:10px!important}
    }

    @media (max-width:900px){
      .screen[data-screen="intro"] .screen-inner{
        min-height:100dvh!important;
        overflow-y:auto!important;
      }
      .screen[data-screen="intro"] .viewport.center{
        padding-top:74px!important;
        padding-bottom:20px!important;
      }
      .screen[data-screen="intro"] .hero{
        width:min(100%,680px)!important;
      }
      .screen[data-screen="intro"] .intro-actions{
        width:calc(100% - 28px)!important;
        padding-bottom:max(18px,env(safe-area-inset-bottom))!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
