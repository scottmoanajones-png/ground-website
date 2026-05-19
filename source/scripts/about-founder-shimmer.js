(() => {
  const cards = document.querySelectorAll('.founder');
  if (!cards.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    cards.forEach(card => {
      card.classList.add('is-revealed');
      card.querySelector('.founder-photo-wrap').style.opacity = '1';
      card.querySelectorAll('.founder-bio > *').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    });
    return;
  }

  const CELL = 32;
  const WAVE = 26;
  const JITTER = 10;
  const FADE = 110; // ms per half of flash (0→peak→0 over FADE*2)

  // Flash reveal: cells sweep 0 → peak → 0 (no lingering white, no pop on clear)
  function runReveal(card, staggerDelay, onDone) {
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
          cells.push({ r, c, d: (r + c) * WAVE + Math.random() * JITTER });
        }
      }

      // Midpoint = when the wave front is halfway across the diagonal
      const maxDiag = (cols - 1 + rows - 1) * WAVE;
      const midpoint = maxDiag * 0.5 + FADE;
      let midFired = false;
      const start = performance.now();

      function frame(now) {
        const elapsed = now - start;

        if (!midFired && elapsed >= midpoint) {
          midFired = true;
          // Card chrome appears instantly (no transition flash)
          card.style.transition = 'none';
          card.classList.add('is-revealed');
          requestAnimationFrame(() => { card.style.transition = ''; });

          // Photo fades in first
          const photoWrap = card.querySelector('.founder-photo-wrap');
          if (photoWrap) photoWrap.style.opacity = '1';
        }

        ctx.clearRect(0, 0, W, H);
        let allDone = true;

        for (const { r, c, d } of cells) {
          const e = elapsed - d;
          if (e < FADE * 2) allDone = false;
          if (e <= 0 || e >= FADE * 2) continue;

          // Triangle flash: ease-in up, ease-out down
          let a;
          if (e < FADE) {
            const t = e / FADE;
            a = t * t;
          } else {
            const t = (e - FADE) / FADE;
            a = 1 - t * t;
          }

          ctx.fillStyle = `rgba(255,255,255,${(a * 0.82).toFixed(3)})`;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }

        if (allDone) {
          // All cells back to transparent — no pop, just stagger text in
          ctx.clearRect(0, 0, W, H);
          card.querySelectorAll('.founder-bio > *').forEach((el, i) => {
            el.style.transitionDelay = `${i * 90}ms`;
            el.style.opacity = '1';
            el.style.transform = 'none';
          });
          if (onDone) onDone();
        } else {
          requestAnimationFrame(frame);
        }
      }

      requestAnimationFrame(frame);
    }, staggerDelay);
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

      gx += (tx - gx) * (isIdle ? 0.016 : 0.072);
      gy += (ty - gy) * (isIdle ? 0.016 : 0.072);

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

  // Observe cards, stagger reveal by index
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      // Find index among all cards for stagger
      const idx = [...cards].indexOf(entry.target);
      runReveal(entry.target, idx * 100, () => initHoverShimmer(entry.target));
    });
  }, { threshold: 0.1 });

  cards.forEach(card => observer.observe(card));
})();
