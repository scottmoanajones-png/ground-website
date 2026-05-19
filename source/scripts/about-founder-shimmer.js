(() => {
  const cards = document.querySelectorAll('.founder');
  if (!cards.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    cards.forEach(card => {
      card.classList.add('is-revealed');
      card.querySelectorAll('.founder-bio > *').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    });
    return;
  }

  const CELL = 32, WAVE = 26, JITTER = 12, FADE = 130;
  const WHITE = [255, 255, 255];

  // Wave shimmer reveal: transparent → card chrome
  function runReveal(card, delay, onDone) {
    setTimeout(() => {
      const canvas = card.querySelector('.founder-shimmer-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const rect = card.getBoundingClientRect();
      const W = Math.round(rect.width);
      const H = Math.round(rect.height);
      canvas.width = W;
      canvas.height = H;

      const cols = Math.ceil(W / CELL);
      const rows = Math.ceil(H / CELL);
      const cells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells.push({ r, c, delay: (r + c) * WAVE + Math.random() * JITTER });
        }
      }

      const maxDiag = (cols - 1 + rows - 1) * WAVE;
      const midpoint = (maxDiag + FADE) / 2;
      let midFired = false;
      const start = performance.now();

      function frame(now) {
        const elapsed = now - start;

        if (!midFired && elapsed >= midpoint) {
          midFired = true;
          card.style.transition = 'none';
          card.classList.add('is-revealed');
          requestAnimationFrame(() => { card.style.transition = ''; });
          card.querySelectorAll('.founder-bio > *').forEach((el, i) => {
            el.style.transitionDelay = `${i * 90}ms`;
            el.style.opacity = '1';
            el.style.transform = 'none';
          });
        }

        ctx.clearRect(0, 0, W, H);
        let allDone = true;
        for (const { r, c, delay: d } of cells) {
          const t = Math.min(Math.max((elapsed - d) / FADE, 0), 1);
          if (t < 1) allDone = false;
          if (t <= 0) continue;
          const a = 1 - (1 - t) * (1 - t);
          ctx.fillStyle = `rgba(${WHITE.join(',')},${a.toFixed(3)})`;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }

        if (allDone) {
          setTimeout(() => {
            ctx.clearRect(0, 0, W, H);
            if (onDone) onDone();
          }, 40);
        } else {
          requestAnimationFrame(frame);
        }
      }

      requestAnimationFrame(frame);
    }, delay);
  }

  // Cursor-following shimmer with idle drift
  function initHoverShimmer(card) {
    const canvas = card.querySelector('.founder-shimmer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    let gx = 0.5, gy = 0.32;
    let tx = 0.5, ty = 0.32;
    let phase = Math.random() * Math.PI * 2;
    let lastMoveTime = 0;

    function resize() {
      const rect = card.getBoundingClientRect();
      W = Math.round(rect.width);
      H = Math.round(rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      tx = (e.clientX - rect.left) / rect.width;
      ty = (e.clientY - rect.top) / rect.height;
      lastMoveTime = performance.now();
    });

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(card);
    resize();

    function frame(now) {
      const isIdle = now - lastMoveTime > 900;

      if (isIdle) {
        phase += 0.0003 * 16;
        tx = 0.5 + Math.sin(phase) * 0.2;
        ty = 0.35 + Math.cos(phase * 0.68) * 0.15;
      }

      gx += ((tx - gx)) * (isIdle ? 0.016 : 0.072);
      gy += ((ty - gy)) * (isIdle ? 0.016 : 0.072);

      ctx.clearRect(0, 0, W, H);

      if (W > 0 && H > 0) {
        const cx = gx * W;
        const cy = gy * H;
        const r = Math.max(W, H) * 0.68;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0,    'rgba(186, 230, 205, 0.10)');
        grad.addColorStop(0.42, 'rgba(186, 230, 205, 0.035)');
        grad.addColorStop(1,    'rgba(186, 230, 205, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  // Stagger reveal on scroll into view
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      runReveal(entry.target, i * 120, () => initHoverShimmer(entry.target));
    });
  }, { threshold: 0.1 });

  cards.forEach(card => observer.observe(card));
})();
