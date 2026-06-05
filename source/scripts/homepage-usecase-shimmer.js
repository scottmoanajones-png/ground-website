(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const { reduceMotion, readCssPixelVariable } = homepage;

  const _UC = {
    CELL:  readCssPixelVariable("--grid-cell", 32),
    WAVE:  28,
    JITTER: 14,
    FADE:  140,
    DARK:  [33, 50, 46]
  };

  function _ucAlignGrid() {
    const CELL = _UC.CELL;

    const ctaSection = document.querySelector('.cta-section');
    const ctaCard    = document.querySelector('.cta-section .usecase-card--cta');
    if (ctaSection && ctaCard) {
      // Snap card height to a cell boundary so the shimmer rows meet the bottom edge cleanly.
      ctaCard.style.minHeight = '';
      ctaCard.style.minHeight = (Math.ceil(ctaCard.offsetHeight / CELL) * CELL) + 'px';

      const sr = ctaSection.getBoundingClientRect();
      const cr = ctaCard.getBoundingClientRect();

      // background-position is relative to the padding box, but getBoundingClientRect
      // returns the border box — subtract any section border so the offset is exact.
      const sectionStyle = getComputedStyle(ctaSection);
      const borderTop    = parseFloat(sectionStyle.borderTopWidth)  || 0;
      const borderLeft   = parseFloat(sectionStyle.borderLeftWidth) || 0;

      // Round to integer so background-position never lands on a sub-pixel boundary.
      const ox = Math.round(((cr.left - sr.left - borderLeft) % CELL + CELL) % CELL);
      const oy = Math.round(((cr.top  - sr.top  - borderTop)  % CELL + CELL) % CELL);
      ctaSection.style.setProperty('--grid-offset-x', `${ox}px`);
      ctaSection.style.setProperty('--grid-offset-y', `${oy}px`);

      const footer = document.querySelector('.site-footer');
      if (footer) footer.style.setProperty('--grid-offset-x', `${ox}px`);
    }
  }

  const _ucTokens = new WeakMap();

  function _ucRunShimmer(card, toRgb, onComplete, onMidpoint) {
    const prev = _ucTokens.get(card);
    if (prev) prev.cancelled = true;
    card.querySelectorAll('canvas.usecase-card-canvas').forEach(c => c.remove());

    const token = { cancelled: false };
    _ucTokens.set(card, token);

    const { CELL, WAVE, JITTER, FADE } = _UC;
    const canvas = document.createElement('canvas');
    canvas.className = 'usecase-card-canvas';
    card.insertBefore(canvas, card.firstChild);

    const rect = card.getBoundingClientRect();
    const W = Math.round(rect.width);
    const H = Math.round(rect.height);
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const cols  = Math.ceil(W / CELL);
    const rows  = Math.ceil(H / CELL);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ r, c, delay: (r + c) * WAVE + Math.random() * JITTER });
      }
    }

    const maxDiagDelay = (cols - 1 + rows - 1) * WAVE;
    const midpoint     = (maxDiagDelay + FADE) / 2;
    let midpointFired  = false;

    const start = performance.now();

    function frame(now) {
      if (token.cancelled) { canvas.remove(); return; }

      if (onMidpoint && !midpointFired && now - start >= midpoint) {
        midpointFired = true;
        onMidpoint();
      }

      ctx.clearRect(0, 0, W, H);
      let allDone = true;
      for (const { r, c, delay } of cells) {
        const elapsed = now - start - delay;
        if (elapsed < 0) { allDone = false; continue; }
        const t = Math.min(elapsed / FADE, 1);
        if (t < 1) allDone = false;
        const alpha = 1 - (1 - t) * (1 - t);
        ctx.fillStyle = `rgba(${toRgb.join(',')},${alpha})`;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
      if (allDone) {
        setTimeout(() => {
          if (token.cancelled) return;
          canvas.remove();
          if (onComplete) onComplete();
        }, 40);
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  function _ucRunShimmerOut(el, fromRgb, onComplete) {
    const canvas = document.createElement('canvas');
    canvas.className = 'usecase-reveal-canvas';
    el.insertBefore(canvas, el.firstChild);

    const rect = el.getBoundingClientRect();
    const W = Math.round(rect.width);
    const H = Math.round(rect.height);
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const { CELL, WAVE, JITTER, FADE } = _UC;
    const cols = Math.ceil(W / CELL);
    const rows = Math.ceil(H / CELL);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ r, c, delay: (r + c) * WAVE + Math.random() * JITTER });
      }
    }

    const fromStr = fromRgb.join(',');
    let cancelled = false;
    const start = performance.now();

    function frame(now) {
      if (cancelled) { canvas.remove(); return; }

      ctx.clearRect(0, 0, W, H);

      let allDone = true;
      for (const { r, c, delay } of cells) {
        const elapsed = now - start - delay;

        if (elapsed < 0) {
          // Wave hasn't reached this cell yet — draw solid white.
          allDone = false;
          ctx.fillStyle = `rgb(${fromStr})`;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          continue;
        }

        const t = Math.min(elapsed / FADE, 1);
        if (t < 1) {
          // Cell is fading — draw with decreasing alpha so the card shows through.
          allDone = false;
          const alpha = (1 - t) * (1 - t); // ease-in quad: fast initial clear, soft tail
          ctx.fillStyle = `rgba(${fromStr},${alpha})`;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
        // t === 1: cell fully cleared — draw nothing, card is visible underneath.
      }

      if (allDone) {
        setTimeout(() => {
          if (!cancelled) { canvas.remove(); if (onComplete) onComplete(); }
        }, 40);
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
    return () => { cancelled = true; };
  }

  function initUsecaseReveal() {
    const pairs = document.querySelectorAll('[data-usecase-reveal]');
    if (!pairs.length) return;

    if (reduceMotion) return; // pairs are visible by default; nothing to do

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        _ucRunShimmerOut(entry.target, [255, 255, 255]);
      });
    }, { threshold: 0.1 });

    pairs.forEach(pair => observer.observe(pair));
  }

  function initUsecaseShimmer() {
    const ctaCard = document.querySelector('.cta-section [data-usecase-shimmer]');
    if (!ctaCard) return;

    _ucAlignGrid();
    if ('ResizeObserver' in window) {
      const ctaSection = document.querySelector('.cta-section');
      if (ctaSection) new ResizeObserver(_ucAlignGrid).observe(ctaSection);
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);

        const card = entry.target;

        _ucRunShimmer(card, _UC.DARK, () => {
          card.style.transition = 'none';
          card.classList.add('is-revealed');
          requestAnimationFrame(() => { card.style.transition = ''; });
        }, () => {
          window.dispatchEvent(new CustomEvent("ground:usecase-cta-midpoint"));
          const targets = [...card.querySelectorAll('h2, h3, p, .usecase-cta-actions')];
          targets.forEach((el, i) => {
            el.style.transitionDelay = `${i * 120}ms`;
            el.style.opacity         = '1';
            el.style.transform       = 'none';
          });
        });
      });
    }, { threshold: 0.1 });

    observer.observe(ctaCard);
  }

  const originalInit = initUsecaseShimmer;
  initUsecaseShimmer = function initUsecaseShimmerWrapper() {
    if (initUsecaseShimmer.started) return;
    initUsecaseShimmer.started = true;

    if (reduceMotion) {
      const ctaCard = document.querySelector('.cta-section [data-usecase-shimmer]');
      if (ctaCard) ctaCard.classList.add('is-revealed');
      return;
    }

    originalInit();
  };

  homepage.initUsecaseShimmer = initUsecaseShimmer;
  homepage.initUsecaseReveal  = initUsecaseReveal;
  homepage.initUsecasePanel   = () => {};
})();
