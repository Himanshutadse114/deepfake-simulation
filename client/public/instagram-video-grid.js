(function installInstagramThreePhotoGrid() {
  const style = document.createElement('style');
  style.textContent = `
    #igGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    #igMiniGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .ig-tile img{width:100%;height:100%;display:block;object-fit:cover}
    .ig-tile .ig-ai{background:rgba(0,0,0,.68)}
    @media(max-width:700px){#igGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  `;
  document.head.appendChild(style);

  const originalBuildInstagramGrid = typeof window.buildInstagramGrid === 'function'
    ? window.buildInstagramGrid
    : null;

  const labels = ['Office portrait', 'Coffee moment', 'Weekend walk'];

  function setPostCount() {
    const count = document.querySelector('.ig-stats span:first-child b');
    if (count) count.textContent = '3';
  }

  function availablePhotos(src) {
    const generated = Array.isArray(window.variantUrls)
      ? window.variantUrls.slice(0, 3).filter(Boolean)
      : [];
    if (generated.length === 3) return generated;

    const fallback = src || window.uploadedPhotoUrl || '';
    if (!fallback && !generated.length) return [];
    return Array.from({ length: 3 }, (_, index) => generated[index] || fallback).filter(Boolean);
  }

  function renderThreePhotoGrid(src) {
    const grid = document.getElementById('igGrid');
    const mini = document.getElementById('igMiniGrid');
    if (!grid) return false;

    const photos = availablePhotos(src);
    if (!photos.length) return false;

    grid.innerHTML = photos.slice(0, 3).map((asset, index) => {
      const label = labels[index] || `Post ${index + 1}`;
      const safeAsset = String(asset).replace(/'/g, '%27');
      return `<div class="ig-tile" onclick="openIgPost('${label}', '${safeAsset}')"><img src="${asset}" alt="${window.runMode === 'demo' ? 'Demo' : 'Synthetic'} ${label}"><span class="ig-ai">AI IMAGE</span></div>`;
    }).join('');

    if (mini) {
      mini.innerHTML = photos.slice(0, 3)
        .map((asset, index) => `<img src="${asset}" alt="Profile image ${index + 1}">`)
        .join('');
    }

    setPostCount();
    return true;
  }

  window.buildInstagramGrid = function buildInstagramThreePhotoGrid(src) {
    if (renderThreePhotoGrid(src)) return;
    if (originalBuildInstagramGrid) originalBuildInstagramGrid(src);
    setPostCount();
  };

  // The base HTML is assembled before this enhancement loads, so normalise the
  // visible post count immediately as well as on every later grid rebuild.
  setPostCount();
})();
