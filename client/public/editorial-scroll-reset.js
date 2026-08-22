(() => {
  const screen = document.querySelector('.screen[data-screen="unifiedLearn"]');
  if (!screen || screen.dataset.editorialScrollResetReady === 'true') return;
  screen.dataset.editorialScrollResetReady = 'true';
  const mobileQuery = window.matchMedia('(max-width: 900px)');

  function resetNewspaperToTop() {
    if (!mobileQuery.matches) return;
    const activePage = screen.querySelector('[data-editorial-page].active');
    const targets = [screen, screen.querySelector('.screen-inner'), screen.querySelector('.editorial-news'), screen.querySelector('.editorial-pages'), activePage, document.scrollingElement].filter(Boolean);
    targets.forEach((target) => {
      try {
        if (typeof target.scrollTo === 'function') target.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        else target.scrollTop = 0;
      } catch (_) { target.scrollTop = 0; }
    });
    try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function resetAfterNavigation() {
    if (!mobileQuery.matches) return;
    requestAnimationFrame(() => requestAnimationFrame(resetNewspaperToTop));
  }

  screen.querySelector('#editorialPrev')?.addEventListener('click', resetAfterNavigation);
  screen.querySelector('#editorialNext')?.addEventListener('click', resetAfterNavigation);

  const pages = [...screen.querySelectorAll('[data-editorial-page]')];
  if (pages.length) {
    const observer = new MutationObserver((mutations) => {
      if (!mobileQuery.matches) return;
      if (mutations.some((mutation) => mutation.attributeName === 'class' && mutation.target.classList.contains('active'))) resetAfterNavigation();
    });
    pages.forEach((page) => observer.observe(page, { attributes: true, attributeFilter: ['class'] }));
  }

  window.resetEditorialNewspaperToTop = resetNewspaperToTop;
})();
