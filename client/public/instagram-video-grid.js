(function installInstagramVideoGrid() {
  const style = document.createElement('style');
  style.textContent = `
    .ig-tile.ig-video-post{position:relative;overflow:hidden;background:#080a0f;cursor:pointer}
    .ig-tile.ig-video-post video{width:100%;height:100%;display:block;object-fit:cover;background:#080a0f;pointer-events:none}
    .ig-video-post-badge{position:absolute;top:9px;right:9px;z-index:3;display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:rgba(7,10,15,.76);border:1px solid rgba(255,255,255,.18);color:#fff;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;backdrop-filter:blur(8px)}
    .ig-video-post-badge svg{width:11px;height:11px;fill:currentColor}
    .ig-video-post .ig-ai{left:8px;right:auto;background:rgba(0,0,0,.72)}
    #igPostVideo{width:100%;height:100%;display:none;object-fit:contain;background:#000}
    .ig-mini-video{position:relative;overflow:hidden;background:#080a0f}
    .ig-mini-video video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
    .ig-mini-video:after{content:'▶';position:absolute;inset:0;display:grid;place-items:center;color:white;font-size:14px;text-shadow:0 1px 8px rgba(0,0,0,.8);pointer-events:none}
  `;
  document.head.appendChild(style);

  const originalBuildInstagramGrid = typeof window.buildInstagramGrid === 'function'
    ? window.buildInstagramGrid
    : null;
  const originalOpenIgPost = typeof window.openIgPost === 'function'
    ? window.openIgPost
    : null;
  const originalCloseIgPost = typeof window.closeIgPost === 'function'
    ? window.closeIgPost
    : null;

  function preparePreviewFrame(video) {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    const seek = () => {
      try {
        const target = Number.isFinite(video.duration) && video.duration > 1.1
          ? Math.min(1, Math.max(0.15, video.duration * 0.12))
          : 0.35;
        if (Math.abs((video.currentTime || 0) - target) > 0.08) video.currentTime = target;
      } catch (_) {}
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener('loadedmetadata', seek, { once: true });
  }

  function videoBadge() {
    return `
      <span class="ig-video-post-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        Reel
      </span>`;
  }

  function renderGeneratedGrid(src) {
    const grid = document.getElementById('igGrid');
    const mini = document.getElementById('igMiniGrid');
    if (!grid) return false;

    const photos = Array.isArray(window.variantUrls)
      ? window.variantUrls.slice(0, 3).filter(Boolean)
      : [];
    const videoUrl = String(window.generatedVideoUrl || '');

    if (photos.length < 3 || !videoUrl || window.runMode === 'demo') return false;

    const labels = ['Office day', 'Coffee stop', 'Outdoor moment'];
    const imageTiles = photos.map((asset, index) => {
      const safeAsset = String(asset).replace(/'/g, '%27');
      const label = labels[index];
      return `<div class="ig-tile" onclick="openIgPost('${label}', '${safeAsset}')"><img src="${asset}" alt="Synthetic ${label}"><span class="ig-ai">AI IMAGE</span></div>`;
    }).join('');

    const safeVideoUrl = videoUrl.replace(/"/g, '&quot;');
    grid.innerHTML = `${imageTiles}
      <div class="ig-tile ig-video-post" role="button" tabindex="0" aria-label="Open AI-generated video post" onclick="openIgVideoPost()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openIgVideoPost()}">
        <video class="ig-video-grid-preview" src="${safeVideoUrl}" muted playsinline preload="metadata" aria-hidden="true"></video>
        ${videoBadge()}
        <span class="ig-ai">AI VIDEO</span>
      </div>`;

    if (mini) {
      mini.innerHTML = photos.map((asset, index) => `<img src="${asset}" alt="Profile image ${index + 1}">`).join('') +
        `<span class="ig-mini-video"><video src="${safeVideoUrl}" muted playsinline preload="metadata" aria-hidden="true"></video></span>`;
    }

    document.querySelectorAll('.ig-video-grid-preview, .ig-mini-video video').forEach(preparePreviewFrame);
    return true;
  }

  window.buildInstagramGrid = function buildInstagramGridWithVideo(src) {
    if (renderGeneratedGrid(src)) return;
    if (originalBuildInstagramGrid) return originalBuildInstagramGrid(src);
  };

  function ensurePostVideo() {
    const side = document.querySelector('#igPostModal .ig-post-img-side');
    if (!side) return null;
    let video = document.getElementById('igPostVideo');
    if (!video) {
      video = document.createElement('video');
      video.id = 'igPostVideo';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      side.appendChild(video);
    }
    return video;
  }

  function resetPostMedia() {
    const image = document.getElementById('igPostImg');
    const video = document.getElementById('igPostVideo');
    if (video) {
      try { video.pause(); video.currentTime = 0; } catch (_) {}
      video.removeAttribute('src');
      video.load();
      video.style.display = 'none';
    }
    if (image) image.style.display = '';
  }

  if (originalOpenIgPost) {
    window.openIgPost = function openInstagramImagePost(label, src) {
      resetPostMedia();
      return originalOpenIgPost(label, src);
    };
  }

  window.openIgVideoPost = function openIgVideoPost() {
    const videoUrl = String(window.generatedVideoUrl || '');
    if (!videoUrl) {
      if (typeof window.toast === 'function') window.toast('The generated video post is not available yet.');
      return;
    }

    const modal = document.getElementById('igPostModal');
    const image = document.getElementById('igPostImg');
    const description = document.getElementById('igPostDesc');
    const video = ensurePostVideo();
    if (!modal || !video) return;

    if (image) image.style.display = 'none';
    video.style.display = 'block';
    if (video.src !== videoUrl) video.src = videoUrl;
    video.muted = false;
    modal.style.display = 'flex';
    if (description) {
      description.textContent = 'A convincing video post can be manufactured from a single portrait and a short voice sample. Verify unusual requests outside social media.';
    }
    video.play().catch(() => {
      video.controls = true;
    });
  };

  window.closeIgPost = function closeInstagramPostWithVideo() {
    resetPostMedia();
    if (originalCloseIgPost) return originalCloseIgPost();
    const modal = document.getElementById('igPostModal');
    if (modal) modal.style.display = 'none';
  };
})();
