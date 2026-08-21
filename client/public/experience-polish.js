(() => {
  function installStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Instagram highlight alignment */
      .ig-highlights{align-items:flex-start!important;justify-content:center!important;gap:26px!important}
      .ig-highlight{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;min-width:78px!important;text-align:center!important;line-height:1.2!important}
      .ig-highlight>div{width:66px!important;height:66px!important;display:grid!important;place-items:center!important;padding:0!important;margin:0 auto 7px!important;border-radius:50%!important}
      .ig-highlight>div svg{display:block!important;margin:0!important;width:27px!important;height:27px!important;transform:none!important}

      /* Full-screen newspaper learning experience */
      .screen[data-screen="unifiedLearn"] .screen-inner{height:100dvh!important;overflow:hidden!important;padding:0!important}
      .screen[data-screen="unifiedLearn"] .viewport{height:100%!important;overflow:hidden!important;padding:0!important}
      .screen[data-screen="unifiedLearn"] .info-container{height:100%!important;max-width:none!important;width:100%!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#ead9ad!important;overflow:hidden!important;color:#211c17!important}
      .news-flipbook-shell{height:100%;position:relative;overflow:hidden;background:#ead9ad;perspective:1800px}
      .news-flipbook{position:absolute;inset:0;overflow:hidden}
      .news-page{position:absolute;inset:0;padding:clamp(14px,2.1vh,24px) clamp(24px,3vw,54px) clamp(58px,7vh,78px);background:#ead9ad;color:#211c17;overflow:hidden;opacity:0;pointer-events:none;transform-origin:left center;transform:rotateY(13deg) translateX(5%);transition:transform .52s cubic-bezier(.2,.72,.2,1),opacity .32s ease;backface-visibility:hidden}
      .news-page::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 8%,rgba(255,255,255,.18),transparent 25%),linear-gradient(90deg,rgba(60,44,24,.055),transparent 11%,transparent 89%,rgba(60,44,24,.05));mix-blend-mode:multiply}
      .news-page.active{opacity:1;pointer-events:auto;transform:rotateY(0) translateX(0);z-index:2}
      .news-page.was-active{opacity:0;transform:rotateY(-14deg) translateX(-5%);z-index:1}
      .news-page-inner{height:100%;position:relative;z-index:1;display:flex;flex-direction:column;min-height:0}

      .news-masthead{margin:0 0 clamp(8px,1.1vh,13px)!important;padding:0!important;border-bottom:4px double #211c17!important}
      .news-masthead-title{font-size:clamp(48px,6.1vw,94px)!important;line-height:.9!important;margin:0 0 8px!important;letter-spacing:-.035em!important;text-align:center!important;white-space:nowrap!important}
      .news-masthead-meta{font-size:clamp(8px,.72vw,11px)!important;padding:6px 8px!important;border-top:1px solid #211c17!important;gap:16px!important}
      .news-banner-headline{padding:clamp(10px,1.6vh,18px) 0 clamp(12px,1.8vh,20px)!important;margin:0!important;border-bottom:2px solid #211c17!important;text-align:center!important}
      .news-banner-headline h2{font-size:clamp(34px,4.25vw,68px)!important;line-height:.93!important;margin:0 0 8px!important;color:#b00000!important;white-space:nowrap!important}
      .news-banner-headline p{max-width:860px!important;margin:0 auto!important;font-size:clamp(10px,.9vw,14px)!important;line-height:1.35!important}

      .news-page-kicker{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:3px 0 9px;border-bottom:4px double #211c17;margin-bottom:14px;font-family:'Courier New',monospace;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.08em}
      .news-page-kicker strong{font-family:Georgia,serif;font-size:clamp(28px,3.1vw,48px);letter-spacing:-.025em;text-transform:uppercase}
      .news-page-kicker span{color:#8f1111}
      .news-section-header{background:#211c17!important;color:#ead9ad!important;margin-bottom:12px!important;padding:6px 10px!important}

      /* No white cards inside the newspaper */
      .news-pipeline,.news-pipeline-step,.news-editorial-box,.news-col>div[style*="background:#ddd"],.news-col>div[style*="background: #ddd"]{background:#dfc995!important}
      .news-pipeline-step{background:#e6d3a6!important;border-color:#7b6748!important}
      .news-pipeline-step[style*="background:#fff8f8"]{background:#dcc49a!important}
      .news-editorial-box{background:#e3cd9e!important}
      .news-col svg{background:#d9c18e!important}
      .news-col p,.news-col li,.news-stat-card p{color:#2a241d!important}

      /* Page 1 - cover story */
      .news-page[data-news-page="0"] .news-col{display:grid!important;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)!important;grid-template-areas:"head head" "title pipeline" "copy pipeline" "editorial editorial"!important;column-gap:22px!important;row-gap:8px!important;padding:14px 0 0!important;border:0!important;min-height:0!important;overflow:hidden!important}
      .news-page[data-news-page="0"] .news-col>.news-section-header{grid-area:head!important;margin:0!important}
      .news-page[data-news-page="0"] .news-col>h3{grid-area:title!important;margin:0!important;font-size:clamp(16px,1.4vw,22px)!important}
      .news-page[data-news-page="0"] .news-col>p{grid-area:copy!important;margin:0!important;font-size:clamp(10px,.83vw,13px)!important;line-height:1.4!important}
      .news-page[data-news-page="0"] .news-col>.news-pipeline{grid-area:pipeline!important;margin:0!important;padding:10px!important;align-self:stretch!important}
      .news-page[data-news-page="0"] .news-col>.news-editorial-box{grid-area:editorial!important;margin:4px 0 0!important;padding:10px 14px!important}
      .news-page[data-news-page="0"] .news-pipeline-step{padding:8px!important;margin-bottom:6px!important}
      .news-page[data-news-page="0"] .news-pipeline-arrow{font-size:16px!important;margin:1px 0!important}

      /* Page 2 - two case studies side by side */
      .news-page[data-news-page="1"] .news-col{display:grid!important;grid-template-columns:1fr 1fr!important;grid-template-rows:auto 1fr!important;gap:16px 20px!important;padding:0!important;border:0!important;min-height:0!important;overflow:hidden!important}
      .news-page[data-news-page="1"] .news-col>.news-section-header{grid-column:1/-1!important;margin:0!important}
      .news-page[data-news-page="1"] .news-col>div{margin:0!important;padding:12px!important;border:1px solid rgba(33,28,23,.35)!important;background:#dfc995!important;overflow:hidden!important}
      .news-page[data-news-page="1"] .news-col>div>div[style*="background:#ddd"],.news-page[data-news-page="1"] .news-col>div>div[style*="background: #ddd"]{background:#d7be87!important;margin-bottom:8px!important;padding:6px!important}
      .news-page[data-news-page="1"] .news-col svg{height:clamp(72px,13vh,126px)!important}
      .news-page[data-news-page="1"] .news-col p{font-size:clamp(10px,.82vw,13px)!important;line-height:1.38!important}

      /* Page 3 - stats + defence */
      .news-page[data-news-page="2"] .news-col{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:12px 18px!important;padding:0!important;border:0!important;min-height:0!important;overflow:hidden!important;align-content:start!important}
      .news-page[data-news-page="2"] .news-col>.news-section-header{grid-column:1/-1!important;margin:0!important}
      .news-page[data-news-page="2"] .news-stat-card{margin:0!important;padding:13px!important;border:1px solid rgba(33,28,23,.3)!important;background:#dfc995!important;min-height:0!important}
      .news-page[data-news-page="2"] .news-stat-card .num{font-size:clamp(34px,4.2vw,62px)!important}
      .news-page[data-news-page="2"] .news-stat-card p{font-size:clamp(9px,.72vw,11px)!important}
      .news-page[data-news-page="2"] .news-col>h4{grid-column:1/-1!important;margin:4px 0 0!important;padding-top:10px!important}
      .news-page[data-news-page="2"] .news-col>ul{grid-column:1/-1!important;display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:10px!important;padding:0!important;list-style:none!important}
      .news-page[data-news-page="2"] .news-col>ul li{margin:0!important;padding:10px!important;border:1px solid rgba(33,28,23,.28)!important;background:#dfc995!important;font-size:clamp(9px,.72vw,11px)!important}

      .news-final-action{margin-top:auto!important;padding:10px 0 0!important;text-align:center!important}
      .news-final-action .wide-action{width:min(430px,100%)!important;margin:0 auto!important}

      .news-flip-controls{position:absolute;z-index:6;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:7px 9px;border:1px solid rgba(33,28,23,.28);border-radius:999px;background:rgba(224,201,151,.9);box-shadow:0 8px 24px rgba(67,49,24,.18);backdrop-filter:blur(8px);font-family:'Courier New',monospace}
      .news-flip-controls button{width:34px;height:30px;border:1px solid rgba(33,28,23,.35);border-radius:999px;background:#211c17;color:#ead9ad;cursor:pointer;font-weight:900}
      .news-flip-controls button:disabled{opacity:.35;cursor:default}
      .news-flip-controls span{min-width:72px;text-align:center;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#211c17}

      @media(max-height:820px) and (min-width:901px){
        .news-page{padding-top:10px;padding-bottom:52px}
        .news-masthead-title{font-size:clamp(42px,5.3vw,72px)!important}
        .news-banner-headline h2{font-size:clamp(30px,3.7vw,52px)!important}
        .news-page[data-news-page="0"] .news-col>.news-editorial-box{padding:8px 12px!important}
        .news-page-kicker{margin-bottom:9px}
      }
      @media(max-width:900px){
        .screen[data-screen="unifiedLearn"] .screen-inner,.screen[data-screen="unifiedLearn"] .viewport,.screen[data-screen="unifiedLearn"] .info-container{height:auto!important;min-height:100dvh!important;overflow:auto!important}
        .news-flipbook-shell{min-height:100dvh;height:auto;overflow:visible}
        .news-flipbook{position:relative;inset:auto;min-height:100dvh}
        .news-page{position:relative;inset:auto;display:none;min-height:100dvh;height:auto;overflow:visible;padding:24px 16px 76px;transform:none!important}
        .news-page.active{display:block}
        .news-page[data-news-page="0"] .news-col,.news-page[data-news-page="1"] .news-col,.news-page[data-news-page="2"] .news-col{display:block!important}
        .news-page[data-news-page="0"] .news-col>*{margin-bottom:14px!important}
        .news-page[data-news-page="1"] .news-col>div,.news-page[data-news-page="2"] .news-stat-card,.news-page[data-news-page="2"] .news-col>ul li{margin-bottom:12px!important}
        .news-page[data-news-page="2"] .news-col>ul{display:block!important}
        .news-masthead-title,.news-banner-headline h2{white-space:normal!important}
        .news-flip-controls{position:fixed;bottom:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function makePage(index, label) {
    const page = document.createElement('section');
    page.className = `news-page${index === 0 ? ' active' : ''}`;
    page.dataset.newsPage = String(index);
    const inner = document.createElement('div');
    inner.className = 'news-page-inner';
    page.appendChild(inner);
    if (index > 0) {
      const kicker = document.createElement('div');
      kicker.className = 'news-page-kicker';
      kicker.innerHTML = `<strong>${label}</strong><span>The Simulation Daily · Special Report</span>`;
      inner.appendChild(kicker);
    }
    return { page, inner };
  }

  function setupFlipbook() {
    const screen = document.querySelector('.screen[data-screen="unifiedLearn"]');
    const info = screen?.querySelector('.info-container');
    const layout = info?.querySelector('.news-layout');
    if (!screen || !info || !layout || info.dataset.flipbookReady === 'true') return;

    const masthead = info.querySelector('.news-masthead');
    const banner = info.querySelector('.news-banner-headline');
    const columns = Array.from(layout.children).filter((node) => node.classList.contains('news-col'));
    if (columns.length < 3) return;
    const oldAction = screen.querySelector('.action-dock');

    const shell = document.createElement('div');
    shell.className = 'news-flipbook-shell';
    const book = document.createElement('div');
    book.className = 'news-flipbook';
    shell.appendChild(book);

    const cover = makePage(0, 'Cover Story');
    if (masthead) cover.inner.appendChild(masthead);
    if (banner) cover.inner.appendChild(banner);
    cover.inner.appendChild(columns[0]);

    const cases = makePage(1, 'Real News Cases');
    cases.inner.appendChild(columns[1]);

    const stats = makePage(2, 'Investigative Stats');
    stats.inner.appendChild(columns[2]);
    if (oldAction) {
      oldAction.classList.add('news-final-action');
      oldAction.removeAttribute('style');
      stats.inner.appendChild(oldAction);
    }

    [cover.page, cases.page, stats.page].forEach((page) => book.appendChild(page));
    layout.remove();
    info.replaceChildren(shell);
    info.dataset.flipbookReady = 'true';

    const controls = document.createElement('div');
    controls.className = 'news-flip-controls';
    controls.innerHTML = '<button type="button" aria-label="Previous newspaper page">←</button><span>Page 1 / 3</span><button type="button" aria-label="Next newspaper page">→</button>';
    shell.appendChild(controls);

    const pages = Array.from(book.querySelectorAll('.news-page'));
    const prev = controls.querySelector('button:first-child');
    const next = controls.querySelector('button:last-child');
    const counter = controls.querySelector('span');
    let active = 0;

    function render(nextIndex) {
      const target = Math.max(0, Math.min(pages.length - 1, nextIndex));
      if (target === active) return;
      const old = pages[active];
      old.classList.remove('active');
      old.classList.add('was-active');
      pages.forEach((page, i) => {
        if (i !== active) page.classList.remove('was-active');
      });
      active = target;
      pages[active].classList.add('active');
      counter.textContent = `Page ${active + 1} / ${pages.length}`;
      prev.disabled = active === 0;
      next.disabled = active === pages.length - 1;
    }

    prev.disabled = true;
    prev.addEventListener('click', () => render(active - 1));
    next.addEventListener('click', () => render(active + 1));

    shell.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') render(active - 1);
      if (event.key === 'ArrowRight') render(active + 1);
    });
    shell.tabIndex = 0;
  }

  installStyles();
  setupFlipbook();
})();
