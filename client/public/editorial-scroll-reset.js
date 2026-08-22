(() => {
  const screen = document.querySelector('.screen[data-screen="unifiedLearn"]');
  if (!screen || screen.dataset.editorialScrollResetReady === 'true') return;
  screen.dataset.editorialScrollResetReady = 'true';

  function resetNewspaperToTop() {
    const activePage = screen.querySelector('[data-editorial-page].active');
    const targets = [
      screen,
      screen.querySelector('.screen-inner'),
      screen.querySelector('.editorial-news'),
      screen.querySelector('.editorial-pages'),
      activePage,
      document.scrollingElement
    ].filter(Boolean);

    for (const target of targets) {
      try {
        if (typeof target.scrollTo === 'function') target.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        else target.scrollTop = 0;
      } catch (_) {
        target.scrollTop = 0;
      }
    }

    // Some mobile browsers keep the document viewport independent from the
    // inner screen scroller, so reset both after the newly active page paints.
    try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function resetAfterNavigation() {
    requestAnimationFrame(() => requestAnimationFrame(resetNewspaperToTop));
  }

  const prev = screen.querySelector('#editorialPrev');
  const next = screen.querySelector('#editorialNext');
  prev?.addEventListener('click', resetAfterNavigation, { capture: true });
  next?.addEventListener('click', resetAfterNavigation, { capture: true });

  // Also cover keyboard/programmatic page changes by watching which newspaper
  // page becomes active instead of relying only on the navigation buttons.
  const pages = [...screen.querySelectorAll('[data-editorial-page]')];
  if (pages.length) {
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'class' && mutation.target.classList.contains('active'))) {
        resetAfterNavigation();
      }
    });
    pages.forEach((page) => observer.observe(page, { attributes: true, attributeFilter: ['class'] }));
  }

  window.resetEditorialNewspaperToTop = resetNewspaperToTop;
})();
