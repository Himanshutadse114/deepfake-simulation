(() => {
  const STARTED_AT = Date.now();
  const READY_TIMEOUT_MS = 15000;
  const SCENERY_POST = {
    label: 'Mountain sunset',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Mountain_Lake_Sunset.jpg/960px-Mountain_Lake_Sunset.jpg'
  };
  const LABELS = ['Office portrait', 'Coffee moment', 'Weekend walk'];
  const CAPTIONS = {
    'Office portrait': 'A busy day, but a good one. ✨',
    'Coffee moment': 'Slow coffee, clear head. ☕',
    'Weekend walk': 'Out for some fresh air. 🌿',
    'Mountain sunset': 'Worth stopping for this view. 🌄'
  };

  function setPostCount() {
    const count = document.querySelector('.ig-stats span:first-child b');
    if (count) count.textContent = '4';
  }

  function generatedUrlsFromPayload(payload) {
    const session = window.liveSession;
    const count = Math.min(3, Math.max(0, Number(payload?.variantCount || 0)));
    if (!session?.id || !session?.token || count !== 3) return [];
    const token = encodeURIComponent(session.token);
    return Array.from({ length: count }, (_, index) =>
      `/api/simulation/${session.id}/variant/${index}?token=${token}`
    );
  }

  function currentGeneratedPhotos() {
    const preferred = Array.isArray(window.__generatedProfileUrls)
      ? window.__generatedProfileUrls.slice(0, 3).filter(Boolean)
      : [];
    if (preferred.length === 3) return preferred;
    const legacy = Array.isArray(window.variantUrls)
      ? window.variantUrls.slice(0, 3).filter(Boolean)
      : [];
    return legacy.length === 3 ? legacy : [];
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

    // In the paid AI flow, never silently repeat the uploaded source portrait.
    // If the three generated URLs are not ready yet, leave the grid in a clear
    // loading state rather than misrepresenting the input image as AI output.
    if (window.runMode !== 'demo' && generated.length !== 3) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:#98a2b4;font-size:12px">Loading the generated profile posts…</div>';
      if (mini) mini.innerHTML = '';
      setPostCount();
      return false;
    }

    const fallback = src || '';
    const photos = window.runMode === 'demo'
      ? Array.from({ length: 3 }, (_, index) => generated[index] || fallback).filter(Boolean)
      : generated;
    if (!photos.length) return false;

    const generatedTiles = photos.slice(0, 3).map((asset, index) => {
      const label = LABELS[index];
      return `<div class="ig-tile" onclick="openIgPost('${safeJsString(label)}','${safeJsString(asset)}')"><img src="${asset}" alt="${window.runMode === 'demo' ? 'Demo' : 'Synthetic'} ${label}" loading="eager"><span class="ig-ai">AI IMAGE</span></div>`;
    }).join('');

    grid.innerHTML = generatedTiles + `<div class="ig-tile ig-scenery-post" onclick="openIgPost('${SCENERY_POST.label}','${safeJsString(SCENERY_POST.url)}')"><img src="${SCENERY_POST.url}" alt="Real mountain and lake sunset scenery post" loading="lazy" referrerpolicy="no-referrer"></div>`;

    if (mini) {
      mini.innerHTML = photos.slice(0, 3)
        .map((asset, index) => `<img src="${asset}" alt="Generated profile image ${index + 1}" loading="eager">`)
        .join('') + `<img src="${SCENERY_POST.url}" alt="Real scenery post" loading="lazy" referrerpolicy="no-referrer">`;
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
      if (urls.length === 3) {
        window.__generatedProfileUrls = urls;
        window.variantUrls = urls.slice();
        renderGrid();
        preloadGenerated(urls).finally(() => renderGrid());
      }
      return result;
    };

    window.__innviktaGeneratedProfileGridFixInstalled = true;
    if (currentGeneratedPhotos().length === 3) renderGrid();
    return true;
  }

  if (install()) return;
  const timer = setInterval(() => {
    if (install() || Date.now() - STARTED_AT > READY_TIMEOUT_MS) clearInterval(timer);
  }, 50);
})();
