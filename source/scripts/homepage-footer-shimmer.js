(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const { readCssPixelVariable } = homepage;

  function initFooterShimmer() {
    if (initFooterShimmer.started) return;
    initFooterShimmer.started = true;

    const footerShimmerCanvas = document.getElementById('footerShimmer');
    if (footerShimmerCanvas) {
      const footerCtx = footerShimmerCanvas.getContext('2d');
      const CELL = readCssPixelVariable("--grid-cell", 32);
      let shimmerActive = false;
      let shimmerStart = 0;
      let shimmerRaf = null;

      function resizeFooterShimmer() {
        const dpr = window.devicePixelRatio || 1;
        const w = footerShimmerCanvas.offsetWidth;
        const h = footerShimmerCanvas.offsetHeight;
        footerShimmerCanvas.width = Math.round(w * dpr);
        footerShimmerCanvas.height = Math.round(h * dpr);
        footerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function drawFooterShimmer(now) {
        if (!shimmerActive) return;
        const footerEl = footerShimmerCanvas.closest('footer, .footer, [class*="footer"]');
        const w = footerShimmerCanvas.offsetWidth;
        const h = footerShimmerCanvas.offsetHeight;
        const WAVE_MS  = 3500;
        const PAUSE_MS = 3000;
        const cycle    = WAVE_MS + PAUSE_MS;
        const elapsed  = (now - shimmerStart) % cycle;
        footerCtx.clearRect(0, 0, w, h);
        if (elapsed >= WAVE_MS) {
          shimmerRaf = requestAnimationFrame(drawFooterShimmer);
          return;
        }

        // Read grid offset CSS custom properties so cells align with the footer grid
        let ox = 0, oy = 0;
        if (footerEl) {
          const cs = getComputedStyle(footerEl);
          const rawX = cs.getPropertyValue("--grid-offset-x").trim();
          const rawY = cs.getPropertyValue("--grid-offset-y").trim();
          if (rawX) ox = ((parseFloat(rawX) % CELL) + CELL) % CELL;
          if (rawY) oy = ((parseFloat(rawY) % CELL) + CELL) % CELL;
        }

        const cols = Math.ceil((w - ox) / CELL) + 1;
        const rows = Math.ceil((h - oy) / CELL) + 1;
        const waveX = (elapsed / WAVE_MS) * (cols + 4) - 2;
        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < rows; row++) {
            const waveDist = Math.abs(col + row * 0.4 - waveX);
            const alpha = Math.max(0, 0.13 - waveDist * 0.045);
            if (alpha > 0.003) {
              footerCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
              footerCtx.fillRect(ox + col * CELL + 0.5, oy + row * CELL + 0.5, CELL - 1, CELL - 1);
            }
          }
        }
        shimmerRaf = requestAnimationFrame(drawFooterShimmer);
      }

      const footerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !shimmerActive) {
            shimmerActive = true;
            shimmerStart = performance.now();
            resizeFooterShimmer();
            shimmerRaf = requestAnimationFrame(drawFooterShimmer);
          } else if (!entry.isIntersecting) {
            shimmerActive = false;
            if (shimmerRaf) { cancelAnimationFrame(shimmerRaf); shimmerRaf = null; }
          }
        });
      }, { threshold: 0.05 });

      const footerEl = footerShimmerCanvas.closest('footer, .footer, [class*="footer"]');
      if (footerEl) footerObserver.observe(footerEl);
    }
  }

  homepage.initFooterShimmer = initFooterShimmer;
})();
