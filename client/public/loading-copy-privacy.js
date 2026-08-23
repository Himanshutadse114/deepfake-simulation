(() => {
  const GENERIC_STATUS = 'Preparing your simulation securely…';
  const STARTED_AT = Date.now();
  const READY_TIMEOUT_MS = 15000;

  const style = document.createElement('style');
  style.textContent = `
    .screen[data-screen="generate"] #genStatus{display:none!important}
  `;
  document.head.appendChild(style);

  function sanitizeGenerationCopy() {
    const screen = document.querySelector('.screen[data-screen="generate"]');
    if (!screen) return false;

    const kicker = screen.querySelector('.generate-copy .kicker');
    if (kicker) kicker.textContent = 'Simulation preparation in progress';

    const heading = screen.querySelector('.generate-copy h2');
    if (heading) heading.innerHTML = 'Preparing your <em>simulation.</em>';

    const eta = document.getElementById('genEta');
    if (eta) eta.textContent = GENERIC_STATUS;

    const status = document.getElementById('genStatus');
    if (status) {
      status.style.display = 'none';
      status.setAttribute('aria-hidden', 'true');
    }

    const scanLabel = screen.querySelector('.scan-label span');
    if (scanLabel) scanLabel.textContent = 'Secure simulation';

    return true;
  }

  const observer = new MutationObserver(() => sanitizeGenerationCopy());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  sanitizeGenerationCopy();

  function installRuntimeMask() {
    if (window.__innviktaLoadingCopyPrivacyInstalled) return true;
    if (typeof window.updateGeneration !== 'function' || typeof window.updateGenerationFromServer !== 'function') return false;

    if (typeof window.generationMessage === 'function') {
      window.generationMessage = () => GENERIC_STATUS;
    }

    const originalUpdateGeneration = window.updateGeneration;
    window.updateGeneration = function privacySafeUpdateGeneration() {
      const result = originalUpdateGeneration.apply(this, arguments);
      sanitizeGenerationCopy();
      return result;
    };

    const originalUpdateGenerationFromServer = window.updateGenerationFromServer;
    window.updateGenerationFromServer = function privacySafeGenerationStatus() {
      const result = originalUpdateGenerationFromServer.apply(this, arguments);
      sanitizeGenerationCopy();
      return result;
    };

    window.__innviktaLoadingCopyPrivacyInstalled = true;
    sanitizeGenerationCopy();
    return true;
  }

  if (installRuntimeMask()) return;
  const timer = setInterval(() => {
    if (installRuntimeMask() || Date.now() - STARTED_AT > READY_TIMEOUT_MS) clearInterval(timer);
  }, 50);
})();
