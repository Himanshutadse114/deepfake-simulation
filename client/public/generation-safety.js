(() => {
  let preserveFailedSession = false;
  let installed = false;
  let originalPoll = null;
  let originalCleanup = null;

  // Platform launch tokens are consumed only by session creation. Keep the
  // token out of the visible URL after the initial page load and attach it as a
  // request header instead of letting it leak into generated-asset URLs.
  const params = new URLSearchParams(location.search);
  const suppliedLaunchToken = params.get('launchToken') || params.get('launch_token') || '';
  if (suppliedLaunchToken) {
    try { sessionStorage.setItem('innviktaDeepfakeLaunchToken', suppliedLaunchToken); } catch (_) {}
    params.delete('launchToken');
    params.delete('launch_token');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash || ''}`);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = function protectedSimulationFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, location.href);
    if (url.origin === location.origin && url.pathname === '/api/simulation/session') {
      let token = '';
      try { token = sessionStorage.getItem('innviktaDeepfakeLaunchToken') || ''; } catch (_) {}
      if (token) {
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined) || {});
        headers.set('x-innvikta-launch-token', token);
        init = { ...init, headers };
      }
    }
    return originalFetch(input, init);
  };

  function failureActions() {
    return document.getElementById('generationFailureActions');
  }

  function installFailureActions() {
    const actions = failureActions();
    if (!actions || actions.dataset.costSafeActions === 'true') return;
    actions.dataset.costSafeActions = 'true';
    actions.innerHTML = `
      <div class="generation-safe-actions" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
        <button type="button" class="primary" onclick="retryFailedGenerationSafely()">Retry safely</button>
        <button type="button" class="secondary" onclick="abandonFailedGeneration()">Back to media setup</button>
      </div>
      <div class="tiny generation-safe-note" style="margin-top:8px;text-align:center">Safe retry resumes existing paid AI prediction IDs when possible. Starting over cancels and removes the current session.</div>
    `;
  }

  function installRuntimeGuards() {
    if (installed) return true;
    if (typeof window.pollGenerationUntilReady !== 'function' ||
        typeof window.cleanupLiveSession !== 'function' ||
        typeof window.apiRequest !== 'function') return false;

    installed = true;
    originalPoll = window.pollGenerationUntilReady;
    originalCleanup = window.cleanupLiveSession;

    window.pollGenerationUntilReady = async function safeGenerationPoll(...args) {
      try {
        const result = await originalPoll.apply(this, args);
        preserveFailedSession = false;
        return result;
      } catch (error) {
        // Keep the session so the server can reuse its persisted paid-prediction
        // IDs. The normal startGeneration catch still presents the failure UI.
        if (window.liveSession) preserveFailedSession = true;
        throw error;
      }
    };

    window.cleanupLiveSession = async function costSafeCleanup(...args) {
      if (preserveFailedSession && window.liveSession) {
        try { window.stopGeneratedPlayback?.(); } catch (_) {}
        try { clearTimeout(window.generationPollTimer); } catch (_) {}
        return;
      }
      return originalCleanup.apply(this, args);
    };

    window.retryFailedGenerationSafely = async function retryFailedGenerationSafely() {
      if (!window.liveSession) {
        window.toast?.('The previous simulation session is no longer available.');
        return;
      }

      const actions = failureActions();
      if (actions) actions.style.display = 'none';
      preserveFailedSession = true;
      window.generationInProgress = true;
      window.go?.('generate');
      window.updateGenerationFromServer?.({ status: 'queued', detail: 'Resuming your existing AI generation checkpoints…' });

      try {
        await window.apiRequest(
          `/api/simulation/${window.liveSession.id}/retry`,
          { method: 'POST', body: JSON.stringify({}) },
          window.liveSession.token
        );
        await window.pollGenerationUntilReady();
        preserveFailedSession = false;
      } catch (error) {
        window.generationInProgress = false;
        preserveFailedSession = Boolean(window.liveSession);
        const eta = document.getElementById('genEta');
        if (eta) eta.textContent = error.message;
        window.toast?.(error.message);
        if (actions) actions.style.display = 'block';
      }
    };

    window.abandonFailedGeneration = async function abandonFailedGeneration() {
      preserveFailedSession = false;
      if (typeof originalCleanup === 'function') await originalCleanup();
      window.generationInProgress = false;
      window.go?.('media');
      window.checkMediaReady?.();
    };

    installFailureActions();
    return true;
  }

  const observer = new MutationObserver(() => {
    installRuntimeGuards();
    installFailureActions();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (!installRuntimeGuards()) {
    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (installRuntimeGuards() || checks > 120) clearInterval(timer);
    }, 100);
  }
})();
