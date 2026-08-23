(() => {
  const STARTED_AT = Date.now();
  const READY_TIMEOUT_MS = 20000;
  const EXPECTED_COUNT = 4;
  const LABELS = ['Office day', 'Coffee stop', 'Weekend city', 'Outdoor moment'];
  const CAPTIONS = {
    'Office day': 'A busy day, but a good one. ✨',
    'Coffee stop': 'A quick coffee break. ☕',
    'Weekend city': 'Out and about for the weekend.',
    'Outdoor moment': 'Fresh air and a quiet moment. 🌿'
  };

  function setPostCount() {
    const count = document.querySelector('.ig-stats span:first-child b');
    if (count) count.textContent = String(EXPECTED_COUNT);
  }

  function generatedUrlsFromPayload(payload) {
    const session = window.liveSession;
    const count = Math.min(EXPECTED_COUNT, Math.max(0, Number(payload?.variantCount || 0)));
    if (!session?.id || !session?.token || count !== EXPECTED_COUNT) return [];
    const token = encodeURIComponent(session.token);
    return Array.from({ length: EXPECTED_COUNT }, (_, index) =>
      `/api/simulation/${session.id}/variant/${index}?token=${token}`
    );
  }

  function currentGeneratedPhotos() {
    const preferred = Array.isArray(window.__generatedProfileUrls)
      ? window.__generatedProfileUrls.slice(0, EXPECTED_COUNT).filter(Boolean)
      : [];
    if (preferred.length === EXPECTED_COUNT) return preferred;
    const legacy = Array.isArray(window.variantUrls)
      ? window.variantUrls.slice(0, EXPECTED_COUNT).filter(Boolean)
      : [];
    return legacy.length === EXPECTED_COUNT ? legacy : [];
  }

  function safeJsString(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, ' ');
  }

  function renderGrid(src) {
    const grid = document.getElementById('igGrid');
    if (!grid) return false;
    const mini = document.getElementById('igMiniGrid');
    const generated = currentGeneratedPhotos();

    // Paid mode never substitutes the uploaded source portrait for generated
    // posts. If all four generated URLs are not ready, keep a neutral state.
    if (window.runMode !== 'demo' && generated.length !== EXPECTED_COUNT) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:#98a2b4;font-size:12px">Preparing content…</div>';
      if (mini) mini.innerHTML = '';
      setPostCount();
      return false;
    }

    const fallback = src || '';
    const photos = window.runMode === 'demo'
      ? Array.from({ length: EXPECTED_COUNT }, (_, index) => generated[index] || fallback).filter(Boolean)
      : generated;
    if (!photos.length) return false;

    grid.innerHTML = photos.slice(0, EXPECTED_COUNT).map((asset, index) => {
      const label = LABELS[index];
      return `<div class="ig-tile" onclick="openIgPost('${safeJsString(label)}','${safeJsString(asset)}')"><img src="${asset}" alt="${window.runMode === 'demo' ? 'Demo' : 'Synthetic'} ${label}" loading="eager"><span class="ig-ai">AI IMAGE</span></div>`;
    }).join('');

    if (mini) {
      mini.innerHTML = photos.slice(0, EXPECTED_COUNT)
        .map((asset, index) => `<img src="${asset}" alt="Profile image ${index + 1}" loading="eager">`)
        .join('');
    }
    setPostCount();
    return true;
  }

  function preloadGenerated(urls) {
    return Promise.allSettled(urls.map((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = url;
    })));
  }

  function install() {
    if (window.__innviktaGeneratedProfileGridFixInstalled) return true;
    if (typeof window.prepareGeneratedAssets !== 'function' || typeof window.openIgPost !== 'function') return false;

    const originalPrepareGeneratedAssets = window.prepareGeneratedAssets;
    const originalOpenIgPost = window.openIgPost;

    window.buildInstagramGrid = renderGrid;

    window.openIgPost = function generatedProfileOpenPost(label, src) {
      const result = originalOpenIgPost.call(this, label, src);
      const description = document.getElementById('igPostDesc');
      if (description && CAPTIONS[label]) description.textContent = CAPTIONS[label];
      return result;
    };

    window.prepareGeneratedAssets = function generatedProfilePrepareAssets(payload) {
      const result = originalPrepareGeneratedAssets.apply(this, arguments);
      const urls = generatedUrlsFromPayload(payload);
      if (urls.length === EXPECTED_COUNT) {
        window.__generatedProfileUrls = urls;
        window.variantUrls = urls.slice();
        renderGrid();
        preloadGenerated(urls).finally(() => renderGrid());
      }
      return result;
    };

    window.__innviktaGeneratedProfileGridFixInstalled = true;
    if (currentGeneratedPhotos().length === EXPECTED_COUNT) renderGrid();
    return true;
  }

  if (install()) return;
  const timer = setInterval(() => {
    if (install() || Date.now() - STARTED_AT > READY_TIMEOUT_MS) clearInterval(timer);
  }, 50);
})();
