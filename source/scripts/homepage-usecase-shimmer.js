(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const { reduceMotion, readCssPixelVariable } = homepage;

  const _UC = {
    CELL: readCssPixelVariable("--grid-cell", 32),
    WAVE: 28,
    JITTER: 14,
    FADE: 140,
    WHITE: [255, 255, 255],
    GREEN: [227, 240, 233],
    DARK: [33, 50, 46]
  };
  let _usecaseActiveCard = null;

function _ucAlignGrid() {
  const section = document.querySelector('.usecases');
  const cards = document.querySelectorAll('.usecases .usecase-card');
  if (!section || !cards.length) return;
  const CELL = _UC.CELL;

  // Snap each card's height to a cell multiple so top and bottom edges both land on grid lines
  cards.forEach(card => {
    card.style.minHeight = '';
    const h = card.offsetHeight;
    card.style.minHeight = (Math.ceil(h / CELL) * CELL) + 'px';
  });

  // Shift background so grid lines land exactly at the first card's left and top edges
  const sr = section.getBoundingClientRect();
  const cr = cards[0].getBoundingClientRect();
  const ox = ((cr.left - sr.left) % CELL + CELL) % CELL;
  const oy = ((cr.top  - sr.top)  % CELL + CELL) % CELL;
  section.style.setProperty('--grid-offset-x', `${ox}px`);
  section.style.setProperty('--grid-offset-y', `${oy}px`);

  // Align footer grid lines to match usecase card edges
  const footer = document.querySelector('.site-footer');
  if (footer) footer.style.setProperty('--grid-offset-x', `${ox}px`);
}

const _ucTokens = new WeakMap();

function _ucRunShimmer(card, fromRgb, toRgb, onComplete, onMidpoint) {
  // Cancel any in-progress shimmer on this card
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
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ r, c, delay: (r + c) * WAVE + Math.random() * JITTER });
    }
  }

  // Midpoint = halfway through the wave's diagonal travel
  const maxDiagDelay = (cols - 1 + rows - 1) * WAVE;
  const midpoint = (maxDiagDelay + FADE) / 2;
  let midpointFired = false;

  const start = performance.now();

  function frame(now) {
    if (token.cancelled) { canvas.remove(); return; }

    if (onMidpoint && !midpointFired && now - start >= midpoint) {
      midpointFired = true;
      onMidpoint();
    }

    ctx.clearRect(0, 0, W, H);
    if (fromRgb) {
      ctx.fillStyle = `rgb(${fromRgb.join(',')})`;
      ctx.fillRect(0, 0, W, H);
    }
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

function initUsecaseShimmer() {
  const cards = document.querySelectorAll('.usecases .usecase-card');
  if (!cards.length) return;

  // Align background grid to card edges on load and resize
  _ucAlignGrid();
  if ('ResizeObserver' in window) {
    new ResizeObserver(_ucAlignGrid).observe(document.querySelector('.usecases'));
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);

      const card = entry.target;
      const isCta = card.classList.contains('usecase-card--cta');
      const prev = _usecaseActiveCard;
      if (!isCta) _usecaseActiveCard = card;

      // De-highlight previous card (skip if it's the CTA — it stays dark)
      if (prev && prev !== card && !prev.classList.contains('usecase-card--cta')) {
        _ucRunShimmer(prev, _UC.GREEN, _UC.WHITE, () => {
          prev.style.transition = 'none';
          prev.classList.add('is-revealed');
          prev.classList.remove('is-highlighted');
          requestAnimationFrame(() => { prev.style.transition = ''; });
        });
      }

      // Reveal card: shimmer transparent → dark (CTA) or green (regular)
      const revealColor = isCta ? _UC.DARK : _UC.GREEN;
      _ucRunShimmer(card, null, revealColor, () => {
        card.style.transition = 'none';
        card.classList.add('is-revealed');
        if (!isCta) card.classList.add('is-highlighted');
        requestAnimationFrame(() => { card.style.transition = ''; });
      }, () => {
        if (isCta) {
          window.dispatchEvent(new CustomEvent("ground:usecase-cta-midpoint"));
        }

        // onMidpoint: stagger text in while shimmer is still running
        const targets = [...card.querySelectorAll('h2, h3, p, .use-label, .usecase-cta-actions')];
        targets.forEach((el, i) => {
          el.style.transitionDelay = `${i * 120}ms`;
          el.style.opacity = '1';
          el.style.transform = 'none';
        });
      });
    });
  }, { threshold: 0.1 });

  cards.forEach(card => observer.observe(card));
}

  const originalInitUsecaseShimmer = initUsecaseShimmer;
  initUsecaseShimmer = function initUsecaseShimmerWrapper() {
    if (initUsecaseShimmer.started) return;
    initUsecaseShimmer.started = true;

    if (reduceMotion) {
      document.querySelectorAll('.usecases .usecase-card').forEach((card) => {
        card.classList.add('is-revealed');
        if (!card.classList.contains('usecase-card--cta')) card.classList.add('is-highlighted');
      });
      return;
    }

    originalInitUsecaseShimmer();
  };

  homepage.initUsecaseShimmer = initUsecaseShimmer;
})();
