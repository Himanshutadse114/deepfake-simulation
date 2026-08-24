(() => {
  const VERSION = 2;
  if (window.__innviktaProfileCarouselVersion === VERSION) return;
  window.__innviktaProfileCarouselVersion = VERSION;

  const TOTAL_CARDS = 4;
  const AUTO_ROTATE_MS = 4200;
  let currentIndex = 0;
  let viewedCards = new Set([0]);
  let autoRotateTimer = null;
  let analysisTimer = null;

  function shuffle(items) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function participantIdentity() {
    try { window.__innviktaSyncParticipantIdentity?.(); } catch (_) {}
    const firstInput = document.getElementById('firstNameInput');
    const lastInput = document.getElementById('lastNameInput');
    const first = String(firstInput?.value || '').trim() || 'Alex';
    const last = String(lastInput?.value || '').trim() || 'Morgan';
    const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      first,
      last,
      full: `${first} ${last}`,
      handle: `${slug(first)}.${slug(last)}.life`
    };
  }

  function collectInstagramImages() {
    const generated = Array.isArray(window.__generatedProfileUrls)
      ? window.__generatedProfileUrls.slice(0, 4).filter(Boolean)
      : [];
    if (generated.length === 4) return generated;

    const legacy = Array.isArray(window.variantUrls)
      ? window.variantUrls.slice(0, 4).filter(Boolean)
      : [];
    if (legacy.length === 4) return legacy;

    const fromGrid = [...document.querySelectorAll('#igGrid img')]
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .slice(0, 4);
    if (fromGrid.length === 4) return fromGrid;

    // Only the internal demo may fall back to the local preview portrait.
    // Paid simulations must use the four images already created for Instagram.
    if (window.runMode === 'demo') {
      const fallback = window.uploadedPhotoUrl || document.querySelector('.shared-face')?.src || '';
      return fallback ? Array.from({ length: 4 }, () => fallback) : [];
    }
    return [];
  }

  function cardMarkup() {
    return `
      <section class="screen profile-carousel-screen" data-screen="profileCarouselExperience" hidden aria-hidden="true">
        <div class="screen-inner profile-carousel-shell">
          <div class="profile-carousel-viewport">
            <div class="profile-carousel-title-area">
              <div class="kicker">Social profile cloning</div>
              <h2>Other cloned <em>social profiles</em></h2>
              <p class="muted">The same generated photos can be repackaged into believable identities across different social networks.</p>
            </div>

            <div class="profile-carousel-stage" aria-label="Cloned social profile carousel">
              <div class="profile-carousel-ring" id="profileCarouselRing">
                <article class="profile-carousel-card pc-linkedin active-card" data-index="0">
                  <div class="pc-li-banner">
                    <div class="pc-li-avatar-wrap"><img data-carousel-photo="0" alt="Cloned LinkedIn profile"></div>
                  </div>
                  <div class="pc-li-body">
                    <div class="pc-li-name profile-carousel-full-name">Alex Morgan</div>
                    <div class="pc-li-headline">Senior Product Designer · Digital product enthusiast · Building better digital experiences</div>
                    <div class="pc-li-meta">12,840 followers · 500+ connections</div>
                    <div class="pc-li-actions"><button type="button">Message</button><button type="button" class="outline">More</button></div>
                    <div class="pc-section"><b>About</b><p>Product, travel and everyday moments presented as a polished professional identity.</p></div>
                    <div class="pc-section"><b>Experience</b><div class="pc-exp"><span>I</span><div><strong>Product Lead</strong><small>Innvikta · Full-time</small></div></div><div class="pc-exp"><span>D</span><div><strong>Senior Product Designer</strong><small>Design Lab · Contract</small></div></div></div>
                  </div>
                </article>

                <article class="profile-carousel-card pc-facebook" data-index="1">
                  <div class="pc-fb-cover"><div class="pc-fb-avatar-wrap"><img data-carousel-photo="1" alt="Cloned Facebook profile"></div></div>
                  <div class="pc-fb-body">
                    <div class="pc-fb-name profile-carousel-full-name">Alex Morgan</div>
                    <div class="pc-fb-friends">1,248 friends · 52 mutual friends</div>
                    <div class="pc-fb-actions"><button type="button">+ Add to Story</button><button type="button">•••</button></div>
                    <div class="pc-fb-tabs"><span class="active">Posts</span><span>About</span><span>Photos</span><span>More</span></div>
                    <div class="pc-fb-intro"><b>Intro</b><span>🏠 Lives in a major city</span><span>📍 Travels frequently</span><span>👥 Followed by 12,842 people</span></div>
                    <div class="pc-fb-post"><div class="pc-fb-post-head"><img data-carousel-photo="1" alt="Facebook avatar"><div><b class="profile-carousel-full-name">Alex Morgan</b><small>2 hrs ago · 🌐</small></div></div><p>Another city checked off the list. Weekend vibes! 📸</p><img class="pc-fb-post-image" data-carousel-photo="2" alt="Cloned Facebook post"></div>
                  </div>
                </article>

                <article class="profile-carousel-card pc-dating" data-index="2">
                  <div class="pc-da-photo"><img data-carousel-photo="2" alt="Cloned dating profile"><div class="pc-da-gradient"><div><span class="pc-da-name profile-carousel-first-name">Alex</span><span class="pc-da-age">, 26</span></div><small>● Recently active</small></div></div>
                  <div class="pc-da-details"><p>Swipe right if you love spontaneous weekend trips and good coffee. ☕✈️</p><div class="pc-da-tags"><span>Travel</span><span>Coffee</span><span>Photography</span><span>Hiking</span></div><div class="pc-da-actions"><button type="button">✖</button><button type="button">★</button><button type="button">♥</button></div></div>
                </article>

                <article class="profile-carousel-card pc-threads" data-index="3">
                  <div class="pc-th-header">Threads</div>
                  <div class="pc-th-body"><div class="pc-th-profile"><div><b class="profile-carousel-full-name">Alex Morgan</b><small class="profile-carousel-handle">alex.morgan.life</small></div><img data-carousel-photo="3" alt="Cloned Threads avatar"></div><p class="pc-th-bio">Product · Travel · Everyday moments / Building, learning, exploring ✨</p><div class="pc-th-meta">12.8K followers · threads.net</div><div class="pc-th-tabs"><span class="active">Threads</span><span>Replies</span><span>Reposts</span></div><div class="pc-th-post"><img data-carousel-photo="3" alt="Threads profile"><div><b class="profile-carousel-handle">alex.morgan.life</b><p>A convincing social identity can be assembled very quickly when public photos and personal context are available.</p><small>♡ &nbsp; 💬 &nbsp; ⇄ &nbsp; ➔</small></div></div></div>
                </article>
              </div>

              <button class="profile-carousel-nav prev" type="button" aria-label="Previous cloned profile">‹</button>
              <button class="profile-carousel-nav next" type="button" aria-label="Next cloned profile">›</button>
            </div>
          </div>

          <div class="profile-carousel-footer">
            <div class="profile-carousel-progress"><span id="profileCarouselCounter">Profile 1 of 4</span><span id="profileCarouselHint">View all four cloned profiles</span></div>
            <button class="primary wide-action" id="profileCarouselAnalyze" type="button" disabled>View all profiles to continue</button>
          </div>
        </div>
      </section>

      <div class="profile-analysis-overlay" id="profileAnalysisOverlay" hidden aria-hidden="true">
        <div class="profile-analysis-card glass">
          <div class="kicker">Cross-platform correlation</div>
          <h3>Analyzing cloned identity…</h3>
          <div class="profile-analysis-bar"><i id="profileAnalysisProgress"></i></div>
          <div id="profileAnalysisStatus">Initialising profile analysis…</div>
        </div>
      </div>`;
  }

  function installStyles() {
    if (document.getElementById('profileCarouselStyles')) return;
    const style = document.createElement('style');
    style.id = 'profileCarouselStyles';
    style.textContent = `
      .profile-carousel-screen{background:var(--bg)!important;overflow:hidden!important}
      .profile-carousel-shell{height:100%!important;display:grid!important;grid-template-rows:minmax(0,1fr) auto!important;overflow:hidden!important;background:radial-gradient(circle at 50% 0,rgba(241,90,36,.08),transparent 32%),var(--bg)!important}
      .profile-carousel-viewport{min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;align-items:center!important;padding:18px 20px 8px!important}
      .profile-carousel-title-area{flex:0 0 auto;text-align:center;margin-bottom:8px;max-width:760px}
      .profile-carousel-title-area .kicker{margin-bottom:7px}
      .profile-carousel-title-area h2{font-size:clamp(24px,3.1vw,38px)!important;margin:0 0 6px!important;line-height:1.05!important}
      .profile-carousel-title-area p{font-size:12px!important;line-height:1.42!important;margin:0 auto!important;max-width:640px}
      .profile-carousel-stage{perspective:1200px;width:100%;max-width:960px;flex:1 1 auto;min-height:0;display:flex;justify-content:center;align-items:center;position:relative;overflow:visible}
      .profile-carousel-ring{width:min(340px,62vw);height:min(405px,calc(100dvh - 205px));min-height:310px;position:relative;transform-style:preserve-3d}
      .profile-carousel-card{position:absolute;inset:0;border-radius:15px;overflow-y:auto;scrollbar-width:none;background:var(--panel);border:1px solid var(--line);box-shadow:0 15px 45px rgba(0,0,0,.42);transition:transform .72s cubic-bezier(.25,1,.32,1),opacity .72s,filter .72s;backface-visibility:hidden}
      .profile-carousel-card::-webkit-scrollbar{display:none}
      .profile-carousel-card.active-card{box-shadow:0 18px 55px rgba(241,90,36,.2),var(--shadow)}
      .profile-carousel-nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:27px;display:grid;place-items:center;cursor:pointer;z-index:30;backdrop-filter:blur(8px)}
      .profile-carousel-nav.prev{left:clamp(8px,5vw,60px)}.profile-carousel-nav.next{right:clamp(8px,5vw,60px)}
      .profile-carousel-footer{flex:0 0 auto;min-height:72px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--panel) 94%,transparent);backdrop-filter:blur(18px);padding:9px max(18px,env(safe-area-inset-right)) max(11px,env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:center;gap:18px;z-index:60}
      .profile-carousel-footer .wide-action{width:min(420px,100%);min-height:46px}
      .profile-carousel-progress{min-width:180px;display:flex;flex-direction:column;gap:3px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.profile-carousel-progress span:first-child{color:var(--text);font-weight:800}
      .profile-carousel-footer button:disabled{opacity:.52!important}
      .pc-linkedin{background:#1d2226!important;color:#e1e3e6!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-li-banner{height:82px;background:#293e49;position:relative}.pc-li-avatar-wrap{position:absolute;left:18px;top:34px;width:84px;height:84px;border-radius:50%;border:4px solid #1d2226;overflow:hidden}.pc-li-avatar-wrap img,.pc-fb-avatar-wrap img,.pc-fb-post-head img,.pc-fb-post-image,.pc-da-photo>img,.pc-th-profile img,.pc-th-post>img{width:100%;height:100%;object-fit:cover}.pc-li-body{padding:44px 18px 18px}.pc-li-name{font-size:20px;font-weight:700;color:#fff}.pc-li-headline{font-size:12.5px;line-height:1.4;margin-top:4px}.pc-li-meta{font-size:11px;color:#98a2b4;margin-top:7px}.pc-li-actions{display:flex;gap:8px;margin:14px 0}.pc-li-actions button{height:31px;border:0;border-radius:999px;background:#70b5f9;color:#1d2226;padding:0 15px;font-weight:700}.pc-li-actions .outline{background:transparent;color:#70b5f9;border:1px solid #70b5f9}.pc-section{border-top:1px solid #2f3337;padding:13px 0}.pc-section>b{display:block;color:#fff;margin-bottom:6px}.pc-section p{font-size:11.5px;line-height:1.5;color:#cbd2de;margin:0}.pc-exp{display:flex;gap:10px;margin-top:9px}.pc-exp>span{width:34px;height:34px;background:#38434f;display:grid;place-items:center;border-radius:4px;font-weight:800}.pc-exp strong,.pc-exp small{display:block}.pc-exp strong{font-size:12px}.pc-exp small{font-size:10px;color:#98a2b4;margin-top:2px}
      .pc-facebook{background:#242526!important;color:#e4e6eb!important;font-family:Arial,sans-serif}.pc-fb-cover{height:105px;background:linear-gradient(180deg,rgba(24,119,242,.2),rgba(0,0,0,.45));position:relative}.pc-fb-avatar-wrap{position:absolute;bottom:-29px;left:50%;transform:translateX(-50%);width:82px;height:82px;border-radius:50%;border:4px solid #242526;overflow:hidden}.pc-fb-body{padding:39px 14px 14px;text-align:center}.pc-fb-name{font-size:20px;font-weight:800;color:#fff}.pc-fb-friends{font-size:11px;color:#b0b3b8;margin-top:2px}.pc-fb-actions{display:flex;gap:7px;margin:12px 0}.pc-fb-actions button{height:31px;border:0;border-radius:6px;background:#1877f2;color:#fff;font-weight:700;padding:0 12px}.pc-fb-actions button:last-child{background:#3a3b3c}.pc-fb-tabs{display:flex;justify-content:space-around;border-block:1px solid #3e4042;padding:9px 0;font-size:11px;color:#b0b3b8;font-weight:700}.pc-fb-tabs .active{color:#4599ff}.pc-fb-intro{text-align:left;padding:11px 0;display:grid;gap:5px;font-size:11px;color:#b0b3b8}.pc-fb-intro b{color:#fff;font-size:13px}.pc-fb-post{border:1px solid #3e4042;border-radius:8px;padding:10px;text-align:left}.pc-fb-post-head{display:flex;gap:8px;align-items:center}.pc-fb-post-head img{width:31px;height:31px;border-radius:50%}.pc-fb-post-head b,.pc-fb-post-head small{display:block}.pc-fb-post-head small{font-size:9px;color:#b0b3b8}.pc-fb-post p{font-size:11px;margin:8px 0}.pc-fb-post-image{height:110px;border-radius:6px}
      .pc-dating{background:#111!important;color:#fff!important;display:flex;flex-direction:column}.pc-da-photo{flex:1;min-height:235px;position:relative;overflow:hidden}.pc-da-gradient{position:absolute;inset:auto 0 0;padding:48px 15px 13px;background:linear-gradient(transparent,rgba(0,0,0,.88))}.pc-da-name{font-size:22px;font-weight:800}.pc-da-age{font-size:18px}.pc-da-gradient small{display:block;color:#51e292;margin-top:3px}.pc-da-details{padding:14px;background:#181818}.pc-da-details p{font-size:11.5px;line-height:1.5;color:#ddd;margin:0 0 10px}.pc-da-tags{display:flex;flex-wrap:wrap;gap:6px}.pc-da-tags span{background:#2a2a2a;padding:4px 9px;border-radius:999px;font-size:10px}.pc-da-actions{display:flex;justify-content:space-around;padding-top:12px}.pc-da-actions button{width:40px;height:40px;border-radius:50%;border:1px solid #333;background:#202020;color:#fff;font-size:16px}.pc-da-actions button:first-child{color:#ff6036}.pc-da-actions button:last-child{color:#51e292}
      .pc-threads{background:#0a0a0a!important;color:#f3f5f7!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.pc-th-header{text-align:center;padding:14px;border-bottom:1px solid #1a1a1a;font-weight:800}.pc-th-body{padding:15px}.pc-th-profile{display:flex;justify-content:space-between;align-items:flex-start}.pc-th-profile b,.pc-th-profile small{display:block}.pc-th-profile b{font-size:17px}.pc-th-profile small{font-size:10px;color:#777;margin-top:2px}.pc-th-profile img{width:50px;height:50px;border-radius:50%}.pc-th-bio{font-size:12px;line-height:1.45;margin:12px 0}.pc-th-meta{font-size:10px;color:#777;margin-bottom:13px}.pc-th-tabs{display:flex;border-bottom:1px solid #1a1a1a}.pc-th-tabs span{flex:1;text-align:center;padding:9px 0;font-size:11px;color:#777}.pc-th-tabs .active{color:#fff;border-bottom:1px solid #fff}.pc-th-post{display:flex;gap:9px;padding:13px 0}.pc-th-post>img{width:29px;height:29px;border-radius:50%}.pc-th-post b{font-size:11px}.pc-th-post p{font-size:11px;line-height:1.45;margin:4px 0 8px;color:#eee}.pc-th-post small{color:#777}
      .profile-analysis-overlay{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.84);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px}.profile-analysis-overlay[hidden]{display:none!important}.profile-analysis-card{width:min(440px,94vw);padding:34px;text-align:center}.profile-analysis-card h3{font-size:22px;margin:7px 0 20px}.profile-analysis-bar{height:8px;border-radius:999px;background:var(--panel3);overflow:hidden}.profile-analysis-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--orange3),var(--orange2));transition:width .12s linear}.profile-analysis-card #profileAnalysisStatus{font-size:10px;color:var(--orange2);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:13px;min-height:16px}
      @media(max-height:760px) and (min-width:701px){.profile-carousel-viewport{padding-top:10px!important}.profile-carousel-title-area h2{font-size:29px!important}.profile-carousel-title-area p{font-size:11px!important}.profile-carousel-ring{height:min(355px,calc(100dvh - 190px));min-height:280px;width:min(310px,58vw)}.profile-carousel-footer{min-height:64px;padding-top:7px;padding-bottom:8px}.profile-carousel-footer .wide-action{min-height:43px}}
      @media(max-width:700px){.profile-carousel-shell{grid-template-rows:minmax(0,1fr) auto!important}.profile-carousel-viewport{padding:14px 8px 6px!important;overflow:hidden!important}.profile-carousel-title-area{padding:0 12px}.profile-carousel-title-area h2{font-size:27px!important}.profile-carousel-title-area p{display:none}.profile-carousel-ring{width:min(300px,78vw);height:min(390px,calc(100dvh - 190px));min-height:290px}.profile-carousel-nav{width:40px;height:40px}.profile-carousel-nav.prev{left:4px}.profile-carousel-nav.next{right:4px}.profile-carousel-footer{display:grid;grid-template-columns:1fr;padding:8px 12px max(10px,env(safe-area-inset-bottom));gap:7px}.profile-carousel-progress{min-width:0;flex-direction:row;justify-content:space-between}.profile-carousel-footer .wide-action{width:100%;min-height:43px}}
    `;
    document.head.appendChild(style);
  }

  function ensureMarkup() {
    if (document.querySelector('.screen[data-screen="profileCarouselExperience"]')) return;
    const profileScreen = document.querySelector('.screen[data-screen="profileExperience"]');
    if (!profileScreen) return;
    profileScreen.insertAdjacentHTML('afterend', cardMarkup());
  }

  function syncIdentity() {
    const identity = participantIdentity();
    document.querySelectorAll('.profile-carousel-full-name').forEach((node) => { node.textContent = identity.full; });
    document.querySelectorAll('.profile-carousel-first-name').forEach((node) => { node.textContent = identity.first; });
    document.querySelectorAll('.profile-carousel-handle').forEach((node) => { node.textContent = identity.handle; });
  }

  function assignRandomGeneratedPhotos() {
    const source = collectInstagramImages();
    const button = document.getElementById('profileCarouselAnalyze');
    const hint = document.getElementById('profileCarouselHint');
    if (source.length !== 4) {
      if (hint) hint.textContent = 'Waiting for the four Instagram images';
      if (button) {
        button.disabled = true;
        button.textContent = 'Preparing cloned profiles…';
      }
      return false;
    }
    const ordered = shuffle(source.slice(0, 4));
    document.querySelectorAll('[data-carousel-photo]').forEach((image) => {
      const index = Number(image.getAttribute('data-carousel-photo') || 0);
      image.src = ordered[index % ordered.length];
    });
    window.__profileCarouselImageOrder = ordered.slice();
    return true;
  }

  function updateCompletionState() {
    const button = document.getElementById('profileCarouselAnalyze');
    const hint = document.getElementById('profileCarouselHint');
    const counter = document.getElementById('profileCarouselCounter');
    if (counter) counter.textContent = `Profile ${currentIndex + 1} of ${TOTAL_CARDS}`;
    if (!button || !hint) return;
    if (!window.__profileCarouselImageOrder?.length) {
      button.disabled = true;
      button.textContent = 'Preparing cloned profiles…';
      hint.textContent = 'Waiting for the four Instagram images';
      return;
    }
    if (viewedCards.size >= TOTAL_CARDS) {
      button.disabled = false;
      button.textContent = 'Proceed to analysis →';
      hint.textContent = 'All four profiles viewed';
    } else {
      button.disabled = true;
      button.textContent = 'View all profiles to continue';
      hint.textContent = `${viewedCards.size} of ${TOTAL_CARDS} viewed`;
    }
  }

  function updateCards() {
    const width = window.innerWidth;
    const mobile = width < 700;
    const offset = mobile ? Math.min(185, width * 0.46) : Math.min(285, width * 0.24);
    const zOffset = mobile ? -105 : -150;
    const rotate = mobile ? 24 : 34;

    document.querySelectorAll('.profile-carousel-card').forEach((card) => {
      const index = Number(card.dataset.index || 0);
      let relative = index - currentIndex;
      if (relative > 2) relative -= TOTAL_CARDS;
      if (relative < -1) relative += TOTAL_CARDS;

      card.onclick = null;
      card.style.cursor = 'default';
      if (relative === 0) {
        card.style.transform = 'translateX(0) translateZ(0) rotateY(0deg)';
        card.style.zIndex = '10';
        card.style.opacity = '1';
        card.style.filter = 'none';
        card.style.pointerEvents = 'auto';
        card.classList.add('active-card');
      } else if (relative === 1 || relative === -3) {
        card.style.transform = `translateX(${offset}px) translateZ(${zOffset}px) rotateY(-${rotate}deg)`;
        card.style.zIndex = '5';
        card.style.opacity = mobile ? '.22' : '.48';
        card.style.filter = 'blur(1px)';
        card.style.pointerEvents = 'auto';
        card.style.cursor = 'pointer';
        card.onclick = () => rotateCarousel(1);
        card.classList.remove('active-card');
      } else if (relative === -1 || relative === 3) {
        card.style.transform = `translateX(-${offset}px) translateZ(${zOffset}px) rotateY(${rotate}deg)`;
        card.style.zIndex = '5';
        card.style.opacity = mobile ? '.22' : '.48';
        card.style.filter = 'blur(1px)';
        card.style.pointerEvents = 'auto';
        card.style.cursor = 'pointer';
        card.onclick = () => rotateCarousel(-1);
        card.classList.remove('active-card');
      } else {
        card.style.transform = 'translateX(0) translateZ(-340px) rotateY(180deg)';
        card.style.zIndex = '1';
        card.style.opacity = '0';
        card.style.filter = 'blur(4px)';
        card.style.pointerEvents = 'none';
        card.classList.remove('active-card');
      }
    });
    updateCompletionState();
  }

  function stopAutoRotate() {
    if (autoRotateTimer) clearInterval(autoRotateTimer);
    autoRotateTimer = null;
  }

  function startAutoRotate() {
    stopAutoRotate();
    autoRotateTimer = setInterval(() => rotateCarousel(1), AUTO_ROTATE_MS);
  }

  function rotateCarousel(direction) {
    currentIndex = (currentIndex + direction + TOTAL_CARDS) % TOTAL_CARDS;
    viewedCards.add(currentIndex);
    updateCards();
    startAutoRotate();
  }

  function resetCarouselRun() {
    currentIndex = 0;
    viewedCards = new Set([0]);
    window.__profileCarouselImageOrder = [];
    syncIdentity();
    assignRandomGeneratedPhotos();
    document.querySelectorAll('.profile-carousel-card').forEach((card) => { card.scrollTop = 0; });
    updateCards();
  }

  function openClonedProfiles() {
    resetCarouselRun();
    window.go?.('profileCarouselExperience');
  }

  function startPlatformAnalysis() {
    if (viewedCards.size < TOTAL_CARDS || !window.__profileCarouselImageOrder?.length) return;
    const overlay = document.getElementById('profileAnalysisOverlay');
    const progress = document.getElementById('profileAnalysisProgress');
    const status = document.getElementById('profileAnalysisStatus');
    if (!overlay || !progress || !status) {
      window.go?.('unifiedLearn');
      return;
    }

    stopAutoRotate();
    clearInterval(analysisTimer);
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    progress.style.width = '0%';

    const messages = [
      [18, 'Comparing identity details across profiles…'],
      [40, 'Correlating professional and social context…'],
      [62, 'Checking reused generated imagery…'],
      [84, 'Mapping cross-platform impersonation signals…'],
      [100, 'Preparing the awareness analysis…']
    ];
    let percent = 0;
    analysisTimer = setInterval(() => {
      percent = Math.min(100, percent + 4);
      progress.style.width = `${percent}%`;
      const message = messages.find(([threshold]) => percent <= threshold);
      if (message) status.textContent = message[1];
      if (percent >= 100) {
        clearInterval(analysisTimer);
        analysisTimer = null;
        setTimeout(() => {
          overlay.hidden = true;
          overlay.setAttribute('aria-hidden', 'true');
          window.go?.('unifiedLearn');
        }, 320);
      }
    }, 70);
  }

  function redirectInstagramButtons() {
    const profileScreen = document.querySelector('.screen[data-screen="profileExperience"]');
    if (!profileScreen) return;
    const desktopButton = profileScreen.querySelector('.ig-side button.primary');
    const mobileButton = profileScreen.querySelector('.ig-mobilebar button.primary');
    [desktopButton, mobileButton].forEach((button) => {
      if (!button) return;
      button.onclick = null;
      button.removeAttribute('onclick');
      if (!button.__profileCarouselRedirect) {
        button.addEventListener('click', openClonedProfiles);
        button.__profileCarouselRedirect = true;
      }
    });
    if (desktopButton) desktopButton.textContent = 'View other cloned profiles →';
    if (mobileButton) mobileButton.textContent = 'Next profiles →';
  }

  function patchGo() {
    if (typeof window.go !== 'function' || window.go.__profileCarouselAware) return;
    const originalGo = window.go;
    const wrappedGo = function profileCarouselAwareGo(name) {
      const result = originalGo.apply(this, arguments);
      if (name === 'profileCarouselExperience') {
        try { document.querySelector('.utility').style.display = 'none'; } catch (_) {}
        const rail = document.getElementById('journeyProgress');
        if (rail) rail.style.width = '66%';
        syncIdentity();
        if (!window.__profileCarouselImageOrder?.length) assignRandomGeneratedPhotos();
        updateCards();
        startAutoRotate();
      } else {
        stopAutoRotate();
      }
      return result;
    };
    wrappedGo.__profileCarouselAware = true;
    window.go = wrappedGo;
  }

  function install() {
    installStyles();
    ensureMarkup();
    redirectInstagramButtons();
    patchGo();
    syncIdentity();

    document.querySelector('.profile-carousel-nav.prev')?.addEventListener('click', () => rotateCarousel(-1));
    document.querySelector('.profile-carousel-nav.next')?.addEventListener('click', () => rotateCarousel(1));
    document.getElementById('profileCarouselAnalyze')?.addEventListener('click', startPlatformAnalysis);
    window.addEventListener('resize', () => {
      if (document.querySelector('.screen[data-screen="profileCarouselExperience"]')?.classList.contains('active')) updateCards();
    });

    window.openClonedProfiles = openClonedProfiles;
    window.rotateProfileCarousel = rotateCarousel;
    window.startPlatformAnalysis = startPlatformAnalysis;
    window.__innviktaProfileCarouselReady = true;
  }

  install();
})();
