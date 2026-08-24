(() => {
  const VERSION = 1;
  if (window.__innviktaProfileCarouselReferenceUiVersion === VERSION) return;
  window.__innviktaProfileCarouselReferenceUiVersion = VERSION;

  function referenceMarkup() {
    return `
      <div class="screen-inner carousel-screen profile-carousel-shell">
        <div class="viewport carousel-viewport profile-carousel-viewport">
          <div class="carousel-title-area profile-carousel-title-area">
            <div class="kicker">Social profile cloning</div>
            <h2>Other cloned <em>social profiles</em></h2>
            <p class="muted" style="max-width:600px;font-size:13px;line-height:1.5;margin:0 auto;">Using your single portrait, the AI pipeline has generated matching profiles across other major networks. Rotate to inspect how realistic they appear.</p>
          </div>

          <div class="carousel-stage profile-carousel-stage" aria-label="Cloned social profile carousel">
            <div class="carousel-ring profile-carousel-ring" id="profileCarouselRing">
              <article class="carousel-card profile-carousel-card li-card pc-linkedin active-card" data-index="0">
                <div class="li-banner">
                  <div class="li-avatar-container opentowork">
                    <img data-carousel-photo="0" alt="LinkedIn Profile">
                    <svg class="li-opentowork-ring" viewBox="0 0 100 100" aria-hidden="true">
                      <path d="M 12 70 A 40 40 0 0 0 88 70" fill="none" stroke="#01754f" stroke-width="12" stroke-linecap="round" />
                      <path id="profile-open-to-work-path" d="M 16 71 A 38 38 0 0 0 84 71" fill="none" />
                      <text fill="#ffffff" font-size="8.5" font-weight="900" letter-spacing="1"><textPath href="#profile-open-to-work-path" startOffset="50%" text-anchor="middle">#OPENTOWORK</textPath></text>
                    </svg>
                  </div>
                </div>
                <div class="li-body">
                  <div class="li-name full-name profile-carousel-full-name">Alex Morgan</div>
                  <div class="li-headline">Senior Product Designer | Digital Nomad &amp; Travel Enthusiast | Building the future of UX/UI</div>
                  <div class="li-meta">San Francisco Bay Area · 12,840 followers · 500+ connections</div>
                  <div class="li-actions"><button class="li-btn-primary" type="button">Message</button><button class="li-btn-secondary" type="button">More</button></div>
                  <div class="li-section"><h4>About</h4><p>Passionate about creating digital experiences that bridge the gap between people and technology. Over 5 years of experience in product design, traveling the world while collaborating with remote teams.</p></div>
                  <div class="li-section"><h4>Experience</h4><div class="li-exp-item"><div class="li-exp-logo">I</div><div><div class="li-exp-title">Product Lead</div><div class="li-exp-company">Innvikta Inc. · Full-time</div></div></div><div class="li-exp-item"><div class="li-exp-logo">D</div><div><div class="li-exp-title">Senior Product Designer</div><div class="li-exp-company">Design Lab · Contract</div></div></div></div>
                </div>
              </article>

              <article class="carousel-card profile-carousel-card fb-card pc-facebook" data-index="1">
                <div class="fb-cover"><div class="fb-avatar-container"><img data-carousel-photo="1" alt="Facebook Profile"></div></div>
                <div class="fb-body">
                  <div class="fb-name full-name profile-carousel-full-name">Alex Morgan</div>
                  <div class="fb-friends">1,248 friends · 52 mutual friends</div>
                  <div class="fb-actions"><button class="fb-btn-blue" type="button">+ Add to Story</button><button class="fb-btn-grey" type="button">Edit Profile</button></div>
                  <div class="fb-tabs"><span class="active">Posts</span><span>About</span><span>Photos</span><span>More</span></div>
                  <div class="fb-intro"><div class="fb-intro-title">Intro</div><div class="fb-intro-item">🏠 Lives in San Francisco, California</div><div class="fb-intro-item">📍 From Seattle, Washington</div><div class="fb-intro-item">👥 Followed by 12,842 people</div></div>
                  <div class="fb-post"><div class="fb-post-head"><img data-carousel-photo="1" alt="Avatar"><div><b class="full-name profile-carousel-full-name">Alex Morgan</b><div><span>2 hrs ago · 🌐</span></div></div></div><div class="fb-post-body">Another city checked off the list. Weekend vibes! 📸🏙️<img class="fb-post-img" data-carousel-photo="2" alt="Post graphic"></div></div>
                </div>
              </article>

              <article class="carousel-card profile-carousel-card da-card pc-dating" data-index="2">
                <div class="da-photo-area"><img data-carousel-photo="2" alt="Dating Profile Portrait"><div class="da-gradient"><div class="da-user-row"><span class="da-name first-name profile-carousel-first-name">Alex</span><span class="da-age">, 26</span></div><div class="da-active-badge">● Recently active</div></div></div>
                <div class="da-details"><div class="da-bio">Swipe right if you love spontaneous weekend trips and good coffee. ☕✈️ Let's find the best sunset spots in the city.</div><div class="da-tags"><span class="da-tag">Travel</span><span class="da-tag">Coffee</span><span class="da-tag">Photography</span><span class="da-tag">Hiking</span></div><div class="da-actions-row"><div class="da-action-circle cross">✖</div><div class="da-action-circle" style="color:#2db1ff;border:1px solid rgba(45,177,255,.3);background:rgba(45,177,255,.1)">★</div><div class="da-action-circle heart">♥</div></div></div>
              </article>

              <article class="carousel-card profile-carousel-card th-card pc-threads" data-index="3">
                <div class="th-header"><div class="th-logo">Threads</div></div>
                <div class="th-body"><div class="th-profile-row"><div class="th-title-container"><span class="th-name full-name profile-carousel-full-name">Alex Morgan</span><span class="th-username profile-carousel-handle">alex.morgan.life</span></div><img class="th-avatar" data-carousel-photo="3" alt="Threads Avatar"></div><div class="th-bio">Product · Travel · Everyday moments / Building, learning, exploring ✨</div><div class="th-meta">12.8K followers · threads.net</div><div class="th-tabs"><span class="active">Threads</span><span>Replies</span><span>Reposts</span></div><div class="th-post"><div class="th-post-left"><img data-carousel-photo="3" alt="Profile"><div class="th-post-left-bar"></div></div><div class="th-post-right"><div class="th-post-author profile-carousel-handle">alex.morgan.life</div><div class="th-post-text">Is it just me or is cloning a complete social identity getting scarily fast? 🤯 Just thinking about identity security today.</div><div class="th-post-actions">♡ 💬 ⇄ ➔</div></div></div></div>
              </article>
            </div>
            <button class="carousel-nav-btn profile-carousel-nav prev" type="button" aria-label="Previous profile">‹</button>
            <button class="carousel-nav-btn profile-carousel-nav next" type="button" aria-label="Next profile">›</button>
          </div>
        </div>

        <div class="carousel-fixed-footer">
          <div class="profile-carousel-progress" aria-live="polite"><span id="profileCarouselCounter">Profile 1 of 4</span><span id="profileCarouselHint">View all four cloned profiles</span></div>
          <div class="action-dock" id="carouselProceedDock"><button class="primary wide-action" id="profileCarouselAnalyze" type="button" disabled>View all profiles to continue</button></div>
        </div>
      </div>`;
  }

  function warpMarkup() {
    const streaks = [
      [10,.1],[35,.6],[55,.2],[80,.7],[110,.3],[135,.8],[160,.4],[190,.9],
      [215,.1],[235,.5],[260,.2],[285,.7],[310,.3],[330,.8],[350,.4],[120,.5]
    ].map(([angle, delay]) => `<div class="warp-streak" style="--angle:${angle}deg;animation-delay:${delay}s"></div>`).join('');
    return `<div class="warp-tunnel-overlay" id="analysisOverlay" style="display:none;opacity:1;" aria-hidden="true"><div class="warp-tunnel-container">${streaks}<div class="warp-ring" style="animation-delay:0s"></div><div class="warp-ring" style="animation-delay:.6s"></div><div class="warp-ring" style="animation-delay:1.2s"></div></div><div class="warp-core-light"></div></div>`;
  }

  function installReferenceStyles() {
    document.getElementById('profileCarouselStyles')?.remove();
    document.getElementById('profileCarouselReferenceStyles')?.remove();
    const style = document.createElement('style');
    style.id = 'profileCarouselReferenceStyles';
    style.textContent = `
/* Exact reference carousel geometry */
.carousel-screen{height:100%;display:grid;grid-template-rows:minmax(0,1fr) auto;background:var(--bg);overflow:hidden}
.carousel-viewport{min-height:0;display:flex;flex-direction:column;align-items:center;padding:30px 20px 8px;overflow:hidden;scrollbar-width:none}
.carousel-viewport::-webkit-scrollbar{display:none}
.carousel-title-area{text-align:center;margin-bottom:24px;flex:0 0 auto}
.carousel-title-area h2{font-size:clamp(24px,4vw,42px);margin-bottom:8px}
.carousel-stage{perspective:1200px;width:100%;max-width:900px;height:480px;flex:0 0 480px;display:flex;justify-content:center;align-items:center;position:relative;overflow:visible}
.carousel-ring{width:360px;height:440px;position:relative;transform-style:preserve-3d}
.carousel-card{position:absolute;width:100%;height:100%;left:0;top:0;border-radius:16px;background:var(--panel);border:1px solid var(--line);box-shadow:0 15px 45px rgba(0,0,0,.45);overflow-y:auto;scrollbar-width:none;transition:transform .8s cubic-bezier(.25,1,.32,1),opacity .8s,filter .8s,z-index .8s}
.carousel-card::-webkit-scrollbar{display:none}
.carousel-card.active-card{box-shadow:0 20px 60px rgba(241,90,36,.22),var(--shadow)}
.carousel-nav-btn{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);color:#fff;font-size:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:30;backdrop-filter:blur(8px);transition:background .3s,transform .3s}
.carousel-nav-btn:hover{background:rgba(0,0,0,.6);transform:translateY(-50%) scale(1.1)}
.carousel-nav-btn.prev{left:20px}.carousel-nav-btn.next{right:20px}

.li-card{background:#1d2226!important;color:#e1e3e6!important;font-family:-apple-system,system-ui,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:left;border:1px solid #2f3337!important}
.li-banner{height:85px;background:#293e49;position:relative}
.li-avatar-container{position:absolute;top:35px;left:20px;width:86px;height:86px;border-radius:50%;border:4px solid #1d2226;background:#1d2226;overflow:visible;box-shadow:0 4px 10px rgba(0,0,0,.3)}
.li-avatar-container img{width:100%;height:100%;object-fit:cover;border-radius:50%}.li-opentowork-ring{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);pointer-events:none}
.li-body{padding:44px 20px 20px}.li-name{font-size:21px;font-weight:600;color:#fff}.li-headline{font-size:13.5px;color:#cbd2de;line-height:1.4;margin-top:4px}.li-meta{font-size:11.5px;color:#98a2b4;margin-top:8px}.li-actions{display:flex;gap:8px;margin:16px 0}
.li-btn-primary{background:#70b5f9;color:#1d2226;border:0;border-radius:999px;font-size:13.5px;font-weight:700;height:32px;padding:0 16px;cursor:pointer;display:inline-flex;align-items:center}.li-btn-secondary{border:1px solid #70b5f9;background:transparent;color:#70b5f9;border-radius:999px;padding:0 16px;font-size:13.5px;font-weight:600;height:32px;cursor:pointer;display:inline-flex;align-items:center}
.li-section{border-top:1px solid #2f3337;padding:16px 0}.li-section h4{font-size:14.5px;font-weight:600;color:#fff;margin:0 0 8px}.li-section p{font-size:12px;line-height:1.55;color:#cbd2de;margin:0}.li-exp-item{display:flex;gap:12px;margin-bottom:14px}.li-exp-logo{width:38px;height:38px;background:#38434f;border-radius:4px;display:grid;place-items:center;font-weight:bold;font-size:16px;color:#fff}.li-exp-title{font-size:13px;font-weight:700;color:#fff}.li-exp-company{font-size:11.5px;color:#98a2b4;margin-top:2px}

.fb-card{background:#242526!important;color:#e4e6eb!important;font-family:Helvetica,Arial,sans-serif;text-align:left;border:1px solid #3e4042!important}.fb-cover{height:110px;background:linear-gradient(180deg,rgba(24,119,242,.15),rgba(0,0,0,.5));position:relative}.fb-avatar-container{position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);width:84px;height:84px;border-radius:50%;border:4px solid #242526;background:#242526;overflow:hidden}.fb-avatar-container img{width:100%;height:100%;object-fit:cover}.fb-body{padding:40px 16px 16px;text-align:center}.fb-name{font-size:21px;font-weight:800;color:#fff}.fb-friends{font-size:12.5px;color:#b0b3b8;margin-top:2px;margin-bottom:12px}.fb-actions{display:flex;gap:8px;margin-bottom:16px}.fb-btn-blue{flex:1;background:#1877f2;color:white;border:0;border-radius:6px;font-size:13px;font-weight:700;height:34px;cursor:pointer}.fb-btn-grey{background:#3a3b3c;color:#e4e6eb;border:0;border-radius:6px;padding:0 14px;font-size:13px;font-weight:700;cursor:pointer}.fb-tabs{display:flex;justify-content:space-around;border-top:1px solid #3e4042;border-bottom:1px solid #3e4042;padding:10px 0;font-size:12px;color:#b0b3b8;font-weight:700}.fb-tabs span.active{color:#1877f2}.fb-intro{text-align:left;padding:12px 0}.fb-intro-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:10px}.fb-intro-item{display:flex;align-items:center;gap:8px;font-size:12.5px;margin-bottom:8px;color:#b0b3b8}.fb-post{border:1px solid #3e4042;background:#242526;border-radius:8px;margin-top:12px;padding:12px;text-align:left}.fb-post-head{display:flex;gap:8px;align-items:center;margin-bottom:8px}.fb-post-head img{width:32px;height:32px;border-radius:50%;object-fit:cover}.fb-post-head b{font-size:13px;color:#fff}.fb-post-head span{font-size:10px;color:#b0b3b8}.fb-post-body{font-size:12px;line-height:1.5;color:#e4e6eb}.fb-post-img{width:100%;border-radius:6px;margin-top:8px;aspect-ratio:1.6;object-fit:cover}

.da-card{color:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:left;background:#111;position:relative;display:flex;flex-direction:column}.da-photo-area{flex:1;position:relative;overflow:hidden;min-height:280px}.da-photo-area img{width:100%;height:100%;object-fit:cover}.da-gradient{position:absolute;inset:auto 0 0;height:120px;background:linear-gradient(transparent,rgba(0,0,0,.85));padding:16px;display:flex;flex-direction:column;justify-content:flex-end}.da-user-row{display:flex;align-items:baseline;gap:6px}.da-name{font-size:22px;font-weight:800}.da-age{font-size:19px;font-weight:500}.da-active-badge{font-size:10px;color:#51e292;margin-top:4px}.da-details{padding:16px;background:#181818}.da-bio{font-size:12px;line-height:1.5;color:#ccc;margin-bottom:12px}.da-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}.da-tag{background:#2a2a2a;color:white;padding:4px 10px;border-radius:99px;font-size:10.5px;font-weight:600}.da-actions-row{display:flex;justify-content:space-around;align-items:center;padding:10px 0}.da-action-circle{width:44px;height:44px;border-radius:50%;background:#222;display:grid;place-items:center;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer}.da-action-circle.heart{color:#51e292;background:rgba(81,226,146,.1);border:1px solid rgba(81,226,146,.3)}.da-action-circle.cross{color:#ff6036;background:rgba(255,96,54,.1);border:1px solid rgba(255,96,54,.3)}

.th-card{background:#0a0a0a;color:#f3f5f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:left;border:1px solid #1c1c1c!important}.th-header{padding:16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1a1a1a}.th-logo{font-size:16px;font-weight:800;text-align:center;width:100%}.th-body{padding:16px}.th-profile-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}.th-title-container{display:flex;flex-direction:column}.th-name{font-size:18px;font-weight:800}.th-username{font-size:11px;color:#777}.th-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover}.th-bio{font-size:12.5px;line-height:1.5;color:#dfdfdf;margin-bottom:12px}.th-meta{font-size:11px;color:#777;margin-bottom:16px}.th-tabs{display:flex;border-bottom:1px solid #1a1a1a;margin-bottom:12px}.th-tabs span{flex:1;text-align:center;padding:10px 0;font-size:12px;font-weight:700;color:#777;border-bottom:1px solid transparent}.th-tabs span.active{color:#f3f5f7;border-color:#f3f5f7}.th-post{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid #141414}.th-post-left{display:flex;flex-direction:column;align-items:center}.th-post-left img{width:28px;height:28px;border-radius:50%;object-fit:cover}.th-post-left-bar{flex:1;width:1px;background:#222;margin-top:6px}.th-post-right{flex:1}.th-post-author{font-size:12px;font-weight:700}.th-post-text{font-size:12px;line-height:1.45;color:#eee;margin-top:4px}.th-post-actions{font-size:13px;letter-spacing:12px;margin-top:8px;color:#777}

.carousel-fixed-footer{position:relative;z-index:60;min-height:70px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--panel) 94%,transparent);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;gap:18px;padding:8px 18px max(10px,env(safe-area-inset-bottom))}.profile-carousel-progress{min-width:180px;display:flex;flex-direction:column;gap:3px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.profile-carousel-progress span:first-child{color:var(--text);font-weight:800}.carousel-fixed-footer .action-dock{margin:0!important;padding:0!important;width:min(420px,100%)!important}.carousel-fixed-footer .wide-action{width:100%;min-height:46px}.carousel-fixed-footer button:disabled{opacity:.52!important}

@media(max-width:700px){.carousel-viewport{padding:14px 8px 6px}.carousel-title-area{margin-bottom:8px;padding:0 12px}.carousel-title-area h2{font-size:27px}.carousel-title-area p{display:none}.carousel-stage{height:440px;flex-basis:440px}.carousel-ring{width:300px;height:400px}.carousel-nav-btn{width:42px;height:42px}.carousel-nav-btn.prev{left:4px}.carousel-nav-btn.next{right:4px}.carousel-fixed-footer{display:grid;grid-template-columns:1fr;padding:7px 12px max(9px,env(safe-area-inset-bottom));gap:6px}.profile-carousel-progress{min-width:0;flex-direction:row;justify-content:space-between}.carousel-fixed-footer .action-dock{width:100%!important}}
@media(max-height:720px) and (min-width:701px){.carousel-viewport{padding-top:10px}.carousel-title-area{margin-bottom:4px}.carousel-title-area .kicker{margin-bottom:4px}.carousel-title-area h2{margin-bottom:2px}.carousel-title-area p{display:none}}

/* Exact reference warp tunnel */
.warp-tunnel-overlay{position:fixed;inset:0;background:#030712;z-index:9999;display:flex;align-items:center;justify-content:center;overflow:hidden}.warp-tunnel-container{position:absolute;width:100vw;height:100vh;perspective:400px}.warp-ring{position:absolute;top:50%;left:50%;width:120px;height:120px;margin-top:-60px;margin-left:-60px;border:2px solid rgba(241,90,36,.45);border-radius:50%;animation:warpRingZoom 1.8s infinite linear;box-shadow:0 0 20px rgba(241,90,36,.5),inset 0 0 20px rgba(241,90,36,.5);pointer-events:none}@keyframes warpRingZoom{0%{transform:translate3d(0,0,-400px) scale(.1);opacity:0}15%{opacity:1}85%{opacity:.8}100%{transform:translate3d(0,0,400px) scale(6);opacity:0}}
.warp-streak{position:absolute;top:50%;left:50%;width:3px;height:120px;margin-left:-1.5px;margin-top:-60px;background:linear-gradient(to top,rgba(255,255,255,0) 0%,rgba(241,90,36,.85) 60%,#fff 100%);transform-origin:bottom center;animation:streakShoot 1.2s infinite linear;pointer-events:none}@keyframes streakShoot{0%{transform:rotate(var(--angle)) translateY(0) scaleY(.1);opacity:0}15%{opacity:1}100%{transform:rotate(var(--angle)) translateY(-450px) scaleY(2.2);opacity:0}}
.warp-core-light{position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,1) 0%,rgba(241,90,36,.7) 40%,rgba(39,52,84,0) 75%);animation:corePulse .8s infinite ease-in-out alternate;pointer-events:none;filter:blur(8px)}@keyframes corePulse{0%{transform:scale(.85);opacity:.6}100%{transform:scale(1.15);opacity:.95}}
    `;
    document.head.appendChild(style);
  }

  function installReferenceMarkup() {
    const screen = document.querySelector('.screen[data-screen="profileCarouselExperience"]');
    if (!screen) return false;
    screen.className = 'screen profile-carousel-screen';
    screen.innerHTML = referenceMarkup();

    document.getElementById('profileAnalysisOverlay')?.remove();
    document.getElementById('analysisOverlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', warpMarkup());
    return true;
  }

  function installNavigation() {
    document.querySelector('.carousel-nav-btn.prev')?.addEventListener('click', () => window.rotateProfileCarousel?.(-1));
    document.querySelector('.carousel-nav-btn.next')?.addEventListener('click', () => window.rotateProfileCarousel?.(1));

    const button = document.getElementById('profileCarouselAnalyze');
    if (button) button.addEventListener('click', startWarpAnalysis);
  }

  function startWarpAnalysis() {
    const button = document.getElementById('profileCarouselAnalyze');
    if (!button || button.disabled || !window.__profileCarouselImageOrder?.length) return;
    const overlay = document.getElementById('analysisOverlay');
    if (!overlay) { window.go?.('unifiedLearn'); return; }
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      overlay.style.transition = 'opacity .5s ease';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.opacity = '1';
        overlay.setAttribute('aria-hidden', 'true');
        window.go?.('unifiedLearn');
      }, 500);
    }, 2000);
  }

  function install() {
    if (!document.querySelector('.screen[data-screen="profileCarouselExperience"]')) return false;
    installReferenceStyles();
    if (!installReferenceMarkup()) return false;
    installNavigation();
    window.startPlatformAnalysis = startWarpAnalysis;
    window.__innviktaProfileCarouselReferenceReady = true;
    return true;
  }

  if (install()) return;
  const started = Date.now();
  const timer = setInterval(() => {
    if (install() || Date.now() - started > 15000) clearInterval(timer);
  }, 50);
})();
