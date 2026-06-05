(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  function readCssRgbTriplet(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const parts = value.split(/\s+/).map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback;
  }

  function initCTAStream() {
    const canvas = document.getElementById("usecaseCTAGrid");
    if (!canvas) return;
    if (homepage.reduceMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bgRgb = readCssRgbTriplet("--ink-rgb", [25, 33, 29]);
    const BG = `rgb(${bgRgb.join(",")})`;
    const C_REST   = readCssRgbTriplet("--dark-surface-rgb", [37, 57, 50]);
    const C_LIT    = readCssRgbTriplet("--signal-mid-rgb", [115, 190, 142]);
    const C_SHADOW = [8, 12, 10]; // near-black — darker than BG for full-dark cells

    // Match the site background grid cell size exactly
    const CELL = 32;

    const SHIMMER_WAVE = 36;  // ms per diagonal step
    const SHIMMER_FADE = 400; // ms for each cell to reach full opacity

    const SPD  = 0.000524; // rad/ms — period ≈ 12s
    const CPHS = 0.38;
    const RPHS = 0.22;
    const AMP  = 0.55;

    // Bayer 4×4 ordered dithering matrix
    const BAYER = [
      [ 0, 8, 2,10],
      [12, 4,14, 6],
      [ 3,11, 1, 9],
      [15, 7,13, 5]
    ].map(row => row.map(v => v / 16));

    const DITHER_COLS = 5;

    // Per-cell pulse parameters for alive dither animation
    const PULSE_CACHE = new Map();
    function getPulse(col, row) {
      const key = col * 64 + row;
      if (!PULSE_CACHE.has(key)) {
        const h = ((col * 17 + row * 31) * 0.618033) % 1;
        PULSE_CACHE.set(key, {
          phase: h * Math.PI * 2,
          speed: 0.00055 + 0.00025 * ((col * 7 + row * 13) % 5) / 4
        });
      }
      return PULSE_CACHE.get(key);
    }

    function getRevealJitter(col, row) {
      const hash = Math.sin(col * 127.1 + row * 311.7 + 0.1) * 43758.5453;
      return (hash - Math.floor(hash)) * 14;
    }

    let W = 0, H = 0;
    // Grid alignment offset: use the card's top-right corner as the anchor so
    // the visible canvas edge lands on a clean grid corner.
    let gridOx = 0, gridOy = 0;
    let fadeStart = -1; // -1 = not yet triggered
    let frameHandle = 0;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function lerpRgb(a, b, t) {
      return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t)),
      ];
    }

    function computeGridOffset() {
      gridOx = ((CELL - (Math.round(W) % CELL)) + CELL) % CELL;
      gridOy = 0;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr  = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeGridOffset();
    }

    function render(now) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      if (fadeStart < 0) return; // not triggered yet

      const fadeAge = now - fadeStart;

      // Draw from -gridOx/-gridOy so cells align with the section background grid
      const startC = -1; // one extra column left to cover the partial cell
      const startR = -1;
      const cols = Math.ceil((W + gridOx) / CELL) + 1;
      const rows = Math.ceil((H + gridOy) / CELL) + 1;

      for (let r = startR; r < rows; r++) {
        for (let c = startC; c < cols; c++) {
          const x = c * CELL - gridOx;
          const y = r * CELL - gridOy;

          // Cull off-screen
          if (x + CELL <= 0 || x >= W || y + CELL <= 0 || y >= H) continue;

          // Column index in the dither zone uses pixel column relative to canvas
          // Use a "grid column" index (how many full cells from canvas left edge)
          const gridCol = Math.floor((x + gridOx) / CELL);

          // Base wave signal — keyed by section-aligned column/row position
          const raw = 0.5 + AMP * 0.5 * Math.sin(now * SPD - gridCol * CPHS + r * RPHS);
          let s = raw * raw;

          const revealDelay = ((c - startC) + (r - startR)) * SHIMMER_WAVE + getRevealJitter(c, r);
          const revealElapsed = fadeAge - revealDelay;
          if (revealElapsed < 0) continue;

          const revealT = Math.min(revealElapsed / SHIMMER_FADE, 1);
          const alpha = 1 - (1 - revealT) * (1 - revealT);

          if (gridCol < DITHER_COLS) {
            const threshold = BAYER[((r % 4) + 4) % 4][((gridCol % 4) + 4) % 4];
            const colFade   = (gridCol + 1) / (DITHER_COLS + 1);
            if (colFade <= threshold) continue;

            // Alive pulse for dither cells
            const { phase, speed } = getPulse(gridCol, r);
            const pulse = 0.5 + 0.5 * Math.sin(now * speed + phase);
            s = Math.max(s, pulse * pulse * 0.72);
          }

          if (alpha < 0.004) continue;

          // ~8% of cells go near-black at the wave front, then decay back to green
          const shadowHash  = (Math.abs(Math.sin(c * 171.3 + r * 89.7 + 5.3) * 43758.5453) % 1);
          const isShadow    = shadowHash < 0.08;

          let rgb;
          if (isShadow) {
            const DECAY_MS   = 1400;
            const sinceReveal = revealElapsed - SHIMMER_FADE;
            const decayT     = sinceReveal > 0 ? Math.min(sinceReveal / DECAY_MS, 1) : 0;
            const shadowBlend = (1 - decayT) * (1 - decayT); // ease out: 1→0
            const normalRgb  = lerpRgb(C_REST, C_LIT, s);
            rgb = lerpRgb(normalRgb, C_SHADOW, shadowBlend);
          } else {
            rgb = lerpRgb(C_REST, C_LIT, s);
          }
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
          ctx.fillRect(x, y, CELL - 1, CELL - 1);
        }
      }
    }

    function startFadeIn(startAt = performance.now()) {
      if (fadeStart >= 0) return;
      fadeStart = startAt;
      if (frameHandle) return;

      const frame = (now) => {
        render(now);
        frameHandle = requestAnimationFrame(frame);
      };

      frameHandle = requestAnimationFrame(frame);
    }

    resize();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resize).observe(canvas);
    }

    homepage.triggerCTAStreamReveal = startFadeIn;
    window.addEventListener("ground:usecase-cta-midpoint", () => startFadeIn(), { once: true });
  }

  homepage.initCTAStream = initCTAStream;
})();
