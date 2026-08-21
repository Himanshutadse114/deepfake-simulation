(() => {
  const screen = document.querySelector('.screen[data-screen="unifiedLearn"]');
  if (!screen) return;

  const pages = Array.from(screen.querySelectorAll('[data-editorial-page]'));
  const nav = screen.querySelector('.editorial-nav');
  const oldButton = screen.querySelector('.editorial-quiz');
  if (!pages.length || !nav || !oldButton) return;

  const cta = document.createElement('div');
  cta.className = 'editorial-final-cta';
  cta.setAttribute('aria-live', 'polite');

  oldButton.textContent = 'Start knowledge check →';
  oldButton.classList.add('editorial-final-cta-button');
  cta.appendChild(oldButton);
  nav.before(cta);

  const updateVisibility = () => {
    const finalPageActive = pages[pages.length - 1]?.classList.contains('active');
    cta.classList.toggle('show', Boolean(finalPageActive));
  };

  const observer = new MutationObserver(updateVisibility);
  pages.forEach(page => observer.observe(page, { attributes: true, attributeFilter: ['class'] }));
  updateVisibility();

  const style = document.createElement('style');
  style.textContent = `
    .editorial-final-cta{
      flex:none;
      display:none;
      justify-content:center;
      align-items:center;
      width:100%;
      margin:6px 0 4px;
      position:relative;
      z-index:40;
    }
    .editorial-final-cta.show{display:flex}
    .editorial-final-cta-button{
      width:min(430px,90vw)!important;
      min-height:48px!important;
      margin:0!important;
      font-size:13px!important;
      box-shadow:0 10px 26px rgba(241,90,36,.22)!important;
    }

    /* The CTA no longer belongs to the torn paper card, so the article can use
       its own height without clipping the navigation action. */
    .editorial-page[data-editorial-page="2"] .paper-story:nth-child(3){padding-bottom:18px!important}

    @media(max-width:900px){
      .editorial-news{padding-bottom:150px!important}
      .editorial-final-cta{
        position:fixed;
        left:12px;
        right:12px;
        bottom:72px;
        width:auto;
        margin:0;
        z-index:97;
        pointer-events:none;
      }
      .editorial-final-cta.show{display:flex}
      .editorial-final-cta-button{
        width:min(100%,520px)!important;
        min-height:50px!important;
        pointer-events:auto;
      }
    }
  `;
  document.head.appendChild(style);
})();
