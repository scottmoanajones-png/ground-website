(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const { reduceMotion } = homepage;

  // Isometric tile dimensions (screen pixels)
  const CELL_W  = 48;   // diamond face width
  const CELL_H  = 24;   // diamond face height  (2:1 iso ratio)
  const CUBE_H  = 20;   // cube extrusion height
  const HW      = CELL_W / 2;
  const HH      = CELL_H / 2;

  // Timing
  const WAVE    = 30;   // ms added per diagonal step
  const JITTER  = 12;   // random timing scatter per tile
  const SETTLE  = 260;  // ms each tile takes to rise to full height

  // Face colours — subtle dark-green depth
  const TOP   = [54, 82, 67];
  const RIGHT = [38, 58, 48];
  const LEFT  = [26, 40, 34];
  const SHINE = [100, 155, 122]; // highlight that rides the wave front

  function buildGrid(W, H) {
    // Grid origin: horizontally centred, top offset so tallest cube fits
    const ox = W / 2;
    const oy = CUBE_H + HH;

    // Tile (col, row) screen centre:
    //   sx = ox + (col - row) * HW
    //   sy = oy + (col + row) * HH
    // Let s = col + row (diagonal index), d = col - row
    const maxS = Math.ceil((H + CUBE_H + HH * 2) / HH) + 2;
    const maxD = Math.ceil(W / HW) + 2;

    const cells = [];
    for (let s = 0; s <= maxS; s++) {
      for (let d = -maxD; d <= maxD; d++) {
        if ((s + d) % 2 !== 0) continue; // only integer col/row pairs
        const col = (s + d) / 2;
        const row = (s - d) / 2;
        if (col < 0 || row < 0) continue;

        const sx = ox + d * HW;
        const sy = oy + s * HH;

        // Cull tiles entirely off-canvas
        if (sx + HW < 0 || sx - HW > W)          continue;
        if (sy - CUBE_H - HH > H || sy + HH < 0) continue;

        cells.push({
          sx,
          sy,
          s,
          delay: s * WAVE + Math.random() * JITTER,
        });
      }
    }

    // Sort back-to-front: ascending s (diagonal), then ascending col
    cells.sort((a, b) => a.s - b.s || (a.sx - b.sx));
    return cells;
  }

  function face(ctx, pts, rgb, alpha) {
    if (alpha < 0.004) return;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.fill();
  }

  function runIsoShimmer(card, onComplete, onMidpoint) {
    card.querySelectorAll('canvas.usecase-card-canvas').forEach(c => c.remove());

    const canvas = document.createElement('canvas');
    canvas.className = 'usecase-card-canvas';
    card.insertBefore(canvas, card.firstChild);

    const rect  = card.getBoundingClientRect();
    const W     = Math.round(rect.width);
    const H     = Math.round(rect.height);
    canvas.width  = W;
    canvas.height = H;
    const ctx   = canvas.getContext('2d');

    const cells     = buildGrid(W, H);
    const maxDelay  = cells.reduce((m, c) => Math.max(m, c.delay), 0);
    const midpoint  = (maxDelay + SETTLE) / 2;
    let midFired    = false;
    let cancelled   = false;
    const start     = performance.now();

    const topStr   = TOP.join(',');
    const rightStr = RIGHT.join(',');
    const leftStr  = LEFT.join(',');
    const shineStr = SHINE.join(',');

    function frame(now) {
      if (cancelled) return;

      if (onMidpoint && !midFired && now - start >= midpoint) {
        midFired = true;
        onMidpoint();
      }

      ctx.clearRect(0, 0, W, H);

      let allDone = true;

      for (const { sx, sy, delay } of cells) {
        const elapsed = now - start - delay;
        if (elapsed < 0) { allDone = false; continue; }

        const t    = Math.min(elapsed / SETTLE, 1);
        if (t < 1) allDone = false;

        // Ease-out cubic: fast rise, soft landing
        const ease = 1 - Math.pow(1 - t, 3);
        const h    = CUBE_H * ease;

        // Highlight envelope: peaks near t=0.35, fades before t=0.75
        const hl   = Math.max(0, 1 - Math.abs(t - 0.35) / 0.32);

        // Key points
        const nx = sx,      ny = sy - HH - h; // north (top of diamond)
        const ex = sx + HW, ey = sy - h;       // east
        const ssx = sx,     ssy = sy + HH - h; // south
        const wx = sx - HW, wy = sy - h;       // west
        //       ground-level east and south
        const grE = sy,     grS = sy + HH;

        // Right face (east side)
        face(ctx, [ex, ey, ssx, ssy, ssx, grS, ex, grE], rightStr, ease);
        // Left face (west side)
        face(ctx, [wx, wy, ssx, ssy, ssx, grS, wx, grE], leftStr,  ease);
        // Top face
        face(ctx, [nx, ny, ex, ey, ssx, ssy, wx, wy],    topStr,   ease);

        // Rolling shine on the wave front
        if (hl > 0.01) {
          face(ctx, [nx, ny, ex, ey, ssx, ssy, wx, wy], shineStr, hl * 0.45);
        }
      }

      if (allDone) {
        setTimeout(() => {
          if (!cancelled && onComplete) onComplete();
        }, 40);
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
    return () => { cancelled = true; };
  }

  function initCtaIsoShimmer() {
    if (initCtaIsoShimmer.started) return;
    initCtaIsoShimmer.started = true;

    const card = document.querySelector('[data-cta-iso-shimmer]');
    if (!card) return;

    if (reduceMotion) {
      card.classList.add('is-revealed');
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);

        const el = entry.target;

        runIsoShimmer(el, () => {
          el.style.transition = 'none';
          el.classList.add('is-revealed');
          requestAnimationFrame(() => { el.style.transition = ''; });
        }, () => {
          el.querySelectorAll('h2, h3, p, .usecase-cta-actions').forEach((node, i) => {
            node.style.transitionDelay = `${i * 120}ms`;
            node.style.opacity         = '1';
            node.style.transform       = 'none';
          });
        });
      });
    }, { threshold: 0.1 });

    observer.observe(card);
  }

  homepage.initCtaIsoShimmer = initCtaIsoShimmer;
})();
