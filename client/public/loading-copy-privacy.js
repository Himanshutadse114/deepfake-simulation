(() => {
  const GENERIC_STATUS = 'Preparing your simulation securely…';
  const STARTED_AT = Date.now();
  const READY_TIMEOUT_MS = 15000;

  const style = document.createElement('style');
  style.textContent = `
    .screen[data-screen="generate"] #genStatus{display:none!important}
  `;
  document.head.appendChild(style);

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function sanitizeGenerationCopy() {
    const screen = document.querySelector('.screen[data-screen="generate"]');
    if (!screen) return false;

    setText(screen.querySelector('.generate-copy .kicker'), 'Simulation preparation in progress');

    const heading = screen.querySelector('.generate-copy h2');
    const safeHeading = 'Preparing your <em>simulation.</em>';
    if (heading && heading.innerHTML !== safeHeading) heading.innerHTML = safeHeading;

    setText(document.getElementById('genEta'), GENERIC_STATUS);

    const status = document.getElementById('genStatus');
    if (status) {
      if (status.style.display !== 'none') status.style.display = 'none';
      if (status.getAttribute('aria-hidden') !== 'true') status.setAttribute('aria-hidden', 'true');
    }

    setText(screen.querySelector('.scan-label span'), 'Secure simulation');
    return true;
  }

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

  // Do not observe the entire DOM. The previous MutationObserver could trigger
  // repeatedly while the large UI bootstrap was being inserted, locking the
  // browser before the first screen rendered. Poll only until the runtime exists,
  // then sanitize after the two generation update functions run.
  if (installRuntimeMask()) return;
  const timer = setInterval(() => {
    sanitizeGenerationCopy();
    if (installRuntimeMask() || Date.now() - STARTED_AT > READY_TIMEOUT_MS) clearInterval(timer);
  }, 100);
})();
