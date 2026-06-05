(() => {
  const navToggle = document.querySelector(".nav-toggle");
  const navMobile = document.querySelector(".nav-mobile");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rootStyles = getComputedStyle(document.documentElement);

  function readCssRgbTriplet(name, fallback) {
    const value = rootStyles.getPropertyValue(name).trim();
    const parts = value.split(/\s+/).map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback;
  }

  if (navToggle && navMobile) {
    let cancelShimmer = null;
    let cancelMobileShimmer = null;

    function navLinks() {
      return [...navMobile.querySelectorAll(".nav-mobile-links a, .nav-mobile-cta")];
    }

    function resetLinks() {
      navLinks().forEach((el) => {
        el.style.transitionDelay = "";
        el.style.opacity = "0";
        el.style.transform = "translateY(20px)";
      });
    }

    function staggerLinks() {
      navLinks().forEach((el, i) => {
        el.style.transitionDelay = `${i * 80}ms`;
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    }

    // Cell-by-cell diagonal shimmer reveal — no GroundHomepage dependency
    function runShimmer(container, onMidpoint) {
      const CELL = 32;
      const WAVE = 10;
      const JITTER = 8;
      const FADE = 70;
      const [r, g, b] = readCssRgbTriplet("--paper-rgb", [236, 241, 240]);

      const canvas = document.createElement("canvas");
      canvas.className = "nav-overlay-canvas";
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;";
      container.insertBefore(canvas, container.firstChild);

      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      const cols = Math.ceil(W / CELL);
      const rows = Math.ceil(H / CELL);
      const cells = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          cells.push({ row, col, delay: (col + row) * WAVE + Math.random() * JITTER });
        }
      }

      const maxDelay = (cols - 1 + rows - 1) * WAVE;
      const midpoint = (maxDelay + FADE) / 2;
      let midpointFired = false;
      let cancelled = false;
      let rafId;
      const start = performance.now();

      function frame(now) {
        if (cancelled) { canvas.remove(); return; }
        const elapsed = now - start;

        if (!midpointFired && elapsed >= midpoint) {
          midpointFired = true;
          onMidpoint && onMidpoint();
        }

        ctx.clearRect(0, 0, W, H);
        let allDone = true;
        for (const { row, col, delay } of cells) {
          const t = Math.min(Math.max((elapsed - delay) / FADE, 0), 1);
          if (t < 1) allDone = false;
          if (t <= 0) continue;
          const a = 1 - (1 - t) * (1 - t);
          ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
          ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
        }

        if (allDone) {
          setTimeout(() => {
            if (cancelled) return;
            canvas.remove();
          }, 40);
        } else {
          rafId = requestAnimationFrame(frame);
        }
      }

      rafId = requestAnimationFrame(frame);
      return () => { cancelled = true; cancelAnimationFrame(rafId); canvas.remove(); };
    }

    function initMobileShimmer() {
      if (cancelMobileShimmer) { cancelMobileShimmer(); cancelMobileShimmer = null; }
      const canvas = navMobile.querySelector(".nav-shimmer-canvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const CELL = 32, WAVE_MS = 3500, PAUSE_MS = 5000, cycle = WAVE_MS + PAUSE_MS;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let cancelled = false;
      const start = performance.now();
      let rafId;

      function frame(now) {
        if (cancelled) return;
        ctx.clearRect(0, 0, w, h);
        const elapsed = (now - start) % cycle;
        if (elapsed < WAVE_MS) {
          const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
          const waveX = (elapsed / WAVE_MS) * (cols + 4) - 2;
          for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
              const waveDist = Math.abs(col + row * 0.4 - waveX);
              const alpha = Math.max(0, 0.11 - waveDist * 0.038);
              if (alpha > 0.003) {
                ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
                ctx.fillRect(col * CELL + 0.5, row * CELL + 0.5, CELL - 1, CELL - 1);
              }
            }
          }
        }
        rafId = requestAnimationFrame(frame);
      }

      rafId = requestAnimationFrame(frame);
      cancelMobileShimmer = () => { cancelled = true; cancelAnimationFrame(rafId); };
    }

    function openNav() {
      resetLinks();
      navMobile.querySelectorAll(".nav-overlay-canvas").forEach((c) => c.remove());
      navMobile.style.display = "flex";
      navMobile.setAttribute("aria-hidden", "false");
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", "Close menu");

      if (reduceMotion) {
        staggerLinks();
        return;
      }

      if (!reduceMotion) initMobileShimmer();
      if (cancelShimmer) cancelShimmer();
      cancelShimmer = runShimmer(navMobile, staggerLinks);
    }

    function closeNav() {
      if (cancelShimmer) { cancelShimmer(); cancelShimmer = null; }
      if (cancelMobileShimmer) { cancelMobileShimmer(); cancelMobileShimmer = null; }
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open menu");
      navMobile.setAttribute("aria-hidden", "true");
      navMobile.style.transition = "opacity 180ms ease";
      navMobile.style.opacity = "0";

      setTimeout(() => {
        navMobile.style.display = "none";
        navMobile.style.opacity = "";
        navMobile.style.transition = "";
        navMobile.querySelectorAll(".nav-overlay-canvas").forEach((c) => c.remove());
        resetLinks();
      }, 200);
    }

    navToggle.addEventListener("click", () => {
      navMobile.style.display === "flex" ? closeNav() : openNav();
    });

    navMobile.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navMobile.style.display === "flex") {
        closeNav();
        navToggle.focus();
      }
    });
  }

  const revealItems = document.querySelectorAll("[data-reveal]");

  if (reduceMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else if (revealItems.length) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16 }
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  // Nav shimmer — cell-based diagonal wave matching footer shimmer style
  (function () {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.querySelector(".nav-shimmer-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 32;
    const WAVE_MS  = 3500;
    const PAUSE_MS = 5000;
    const cycle    = WAVE_MS + PAUSE_MS;
    let w = 0, h = 0, dpr = 1;
    let start = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize, { passive: true });
    resize();
    start = performance.now();

    function shimmerFrame(now) {
      ctx.clearRect(0, 0, w, h);
      const elapsed = (now - start) % cycle;
      if (elapsed < WAVE_MS) {
        const cols = Math.ceil(w / CELL);
        const rows = Math.ceil(h / CELL);
        const waveX = (elapsed / WAVE_MS) * (cols + 4) - 2;
        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < rows; row++) {
            const waveDist = Math.abs(col + row * 0.4 - waveX);
            const alpha = Math.max(0, 0.11 - waveDist * 0.038);
            if (alpha > 0.003) {
              ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
              ctx.fillRect(col * CELL + 0.5, row * CELL + 0.5, CELL - 1, CELL - 1);
            }
          }
        }
      }
      requestAnimationFrame(shimmerFrame);
    }
    requestAnimationFrame(shimmerFrame);
  }());

  // Delegated FAQ accordion. One listener handles every .faq-trigger.
  // Each item toggles independently — multiple can be open at once.
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".faq-trigger");
    if (!trigger) return;

    const item = trigger.closest(".faq-item");
    if (!item) return;

    const isOpen = item.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
})();
