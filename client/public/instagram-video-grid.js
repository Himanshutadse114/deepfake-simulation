(function installInstagramLifestyleGrid() {
  const SCENERY_POST = {
    label: 'Mountain sunset',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Mountain_Lake_Sunset.jpg/960px-Mountain_Lake_Sunset.jpg'
  };
  // Internet-sourced, non-AI scenery photo. Source: Wikimedia Commons,
  // "Mountain Lake Sunset.jpg" by 420 Photography, CC0 1.0 public-domain dedication.

  const style = document.createElement('style');
  style.textContent = `
    #igGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    #igMiniGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    .ig-tile img{width:100%;height:100%;display:block;object-fit:cover}
    .ig-tile .ig-ai{background:rgba(0,0,0,.68)}
    .ig-tile.ig-scenery-post{background:#111;cursor:pointer}
    .ig-tile.ig-scenery-post img{object-position:center center}
    @media(max-width:700px){#igGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  `;
  document.head.appendChild(style);

  const originalBuildInstagramGrid = typeof window.buildInstagramGrid === 'function'
    ? window.buildInstagramGrid
    : null;
  const originalOpenIgPost = typeof window.openIgPost === 'function'
    ? window.openIgPost
    : null;

  const labels = ['Office portrait', 'Coffee moment', 'Weekend walk'];
  const captions = {
    'Office portrait': 'A busy day, but a good one. ✨',
    'Coffee moment': 'Slow coffee, clear head. ☕',
    'Weekend walk': 'Out for some fresh air. 🌿',
    'Mountain sunset': 'Worth stopping for this view. 🌄'
  };

  function setPostCount() {
    const count = document.querySelector('.ig-stats span:first-child b');
    if (count) count.textContent = '4';
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

  function scenicTile() {
    const safeUrl = SCENERY_POST.url.replace(/'/g, '%27');
    return `<div class="ig-tile ig-scenery-post" onclick="openIgPost('${SCENERY_POST.label}', '${safeUrl}')"><img src="${SCENERY_POST.url}" alt="Real mountain and lake sunset scenery post" loading="lazy" referrerpolicy="no-referrer"></div>`;
  }

  function renderLifestyleGrid(src) {
    const grid = document.getElementById('igGrid');
    const mini = document.getElementById('igMiniGrid');
    if (!grid) return false;

    const photos = availablePhotos(src);
    if (!photos.length) return false;

    const generatedTiles = photos.slice(0, 3).map((asset, index) => {
      const label = labels[index] || `Post ${index + 1}`;
      const safeAsset = String(asset).replace(/'/g, '%27');
      return `<div class="ig-tile" onclick="openIgPost('${label}', '${safeAsset}')"><img src="${asset}" alt="${window.runMode === 'demo' ? 'Demo' : 'Synthetic'} ${label}"><span class="ig-ai">AI IMAGE</span></div>`;
    }).join('');

    grid.innerHTML = generatedTiles + scenicTile();

    if (mini) {
      mini.innerHTML = photos.slice(0, 3)
        .map((asset, index) => `<img src="${asset}" alt="Profile image ${index + 1}">`)
        .join('') + `<img src="${SCENERY_POST.url}" alt="Real scenery post" loading="lazy" referrerpolicy="no-referrer">`;
    }

    setPostCount();
    return true;
  }

  window.buildInstagramGrid = function buildInstagramLifestyleGrid(src) {
    if (renderLifestyleGrid(src)) return;
    if (originalBuildInstagramGrid) originalBuildInstagramGrid(src);
    setPostCount();
  };

  if (originalOpenIgPost) {
    window.openIgPost = function openLifestylePost(label, src) {
      const result = originalOpenIgPost(label, src);
      const description = document.getElementById('igPostDesc');
      if (description && captions[label]) description.textContent = captions[label];
      return result;
    };
  }

  setPostCount();
})();
