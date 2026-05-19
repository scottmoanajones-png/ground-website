(() => {
  const homepage = window.GroundHomepage || (window.GroundHomepage = {});
  homepage.state = homepage.state || {};

  // Module map:
  // - foundation: shared math, scene construction, renderers, exported helpers
  // - value/platform/hero/footer/usecase files: feature-specific init and runtime
  // Keep cross-module state on window.GroundHomepage so the homepage bootstrap
  // can initialize modules in order without reintroducing one giant script.

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rootStyles = getComputedStyle(document.documentElement);

  function readCssPixelVariable(name, fallback) {
    const value = Number.parseFloat(rootStyles.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  function mixRgb(from, to, blend) {
    return [
      Math.round(mix(from[0], to[0], blend)),
      Math.round(mix(from[1], to[1], blend)),
      Math.round(mix(from[2], to[2], blend))
    ];
  }

  function rgbString(color, alpha = 1) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${clamp(alpha, 0, 1)})`;
  }

  // Shared palette data for the static scene renderer and the animated stream renderer.
  const SCENE_PALETTES = {
      about: {
        groundEmpty: [32, 50, 44],
        groundOccupied: [48, 72, 64],
        groundLine: [95, 128, 114],
        top: [227, 237, 232],
        left: [207, 219, 213],
        right: [188, 202, 196],
        line: [164, 181, 174],
        signalTop: [75, 195, 128],
        signalLeft: [22, 105, 58],
        signalRight: [15, 80, 42],
        signalLine: [55, 145, 95],
        mutedTop: [55, 72, 62],
        mutedLeft: [38, 52, 44],
        mutedRight: [28, 40, 32],
        mutedLine: [60, 80, 68],
        groundAlpha: 0.38
      },
      platform: {
        groundEmpty: [239, 243, 240],
        groundOccupied: [231, 236, 232],
        groundLine: [42, 61, 55],
        top: [237, 244, 241],
        left: [207, 217, 212],
        right: [188, 200, 195],
        line: [42, 61, 55],
        signalTop: [109, 184, 141],
        signalLeft: [83, 160, 116],
        signalRight: [68, 140, 98],
        signalLine: [55, 123, 86],
        mutedTop: [221, 231, 224],
        mutedLeft: [201, 212, 204],
        mutedRight: [184, 194, 187],
        mutedLine: [98, 114, 107],
        groundAlpha: 0.22
      }
    };

  const STREAM_SCENE_PALETTES = {
      dark: {
        groundEmpty: [12, 20, 17],
        groundOccupied: [16, 28, 23],
        groundLine: [57, 86, 74],
        top: [220, 230, 225],
        left: [190, 202, 195],
        right: [161, 173, 166],
        line: [129, 145, 137],
        wakeTop: [244, 247, 245],
        wakeLeft: [217, 224, 220],
        wakeRight: [191, 199, 194],
        wakeLine: [186, 197, 191],
        signalTop: [145, 225, 172],
        signalLeft: [85, 178, 129],
        signalRight: [41, 121, 81],
        signalLine: [103, 185, 138],
        glow: [121, 206, 155],
        groundAlpha: 0.44
      },
      light: {
        groundEmpty: [246, 249, 247],
        groundOccupied: [235, 241, 237],
        groundLine: [172, 186, 177],
        top: [252, 254, 252],
        left: [236, 242, 238],
        right: [219, 228, 223],
        line: [155, 169, 160],
        wakeTop: [255, 255, 255],
        wakeLeft: [245, 249, 246],
        wakeRight: [232, 238, 234],
        wakeLine: [191, 202, 194],
        signalTop: [115, 190, 142],
        signalLeft: [83, 162, 114],
        signalRight: [63, 138, 95],
        signalLine: [82, 153, 111],
        glow: [115, 190, 142],
        groundAlpha: 0.2
      }
    };

  // Scene-building helpers used by both value cards and platform scenes.
  function pseudoRandom(a, b, seed = 0) {
      const value = Math.sin(a * 127.1 + b * 311.7 + seed * 74.5 + 0.1) * 43758.5453;
      return value - Math.floor(value);
    }

    function createScene(key, cols, rows, getCell) {
      const cells = [];

      for (let gy = 0; gy < rows; gy += 1) {
        for (let gx = 0; gx < cols; gx += 1) {
          const cell = getCell(gx, gy);
          cells.push({
            gx,
            gy,
            h: cell.h,
            tone: cell.tone || "base",
            key: `${gx}:${gy}`
          });
        }
      }

      return { key, cols, rows, cells };
    }

    function resolveSceneAssetPayload(sceneId) {
      try {
        if (!window.GroundGridAssets) {
          return null;
        }

        const resolved = window.GroundGridAssets.resolveScene(sceneId);
        if (!resolved || !resolved.scene || !resolved.shape) {
          return null;
        }

        const sceneAsset = resolved.scene;
        const shapeAsset = resolved.shape;
        const signalSet = new Set((sceneAsset.signalCells || []).map(([row, col]) => `${col}:${row}`));
        const mutedSet = new Set((sceneAsset.mutedCells || []).map(([row, col]) => `${col}:${row}`));

        const scene = createScene(sceneAsset.id, shapeAsset.cols, shapeAsset.rows, (gx, gy) => {
          const toneKey = `${gx}:${gy}`;
          let tone = "base";

          if (signalSet.has(toneKey)) {
            tone = "signal";
          } else if (mutedSet.has(toneKey)) {
            tone = "muted";
          }

          return {
            h: shapeAsset.grid[gy][gx],
            tone
          };
        });

        return {
          sceneAsset,
          shapeAsset,
          animationAsset: resolved.animation || null,
          scene
        };
      } catch (_) {
        return null;
      }
    }

    function createSceneFromAsset(sceneId, fallbackFactory) {
      const payload = resolveSceneAssetPayload(sceneId);
      if (!payload || payload.sceneAsset.renderer !== "grid-object") {
        return fallbackFactory();
      }

      return payload.scene;
    }

    const aboutDefragScene = createSceneFromAsset("about-defrag", () => createScene("defrag", 10, 7, (gx, gy) => {
      const depth = gx + gy;
      const random = pseudoRandom(gx, gy);
      let height = 0;

      if (depth < 3) {
        height = random > 0.72 ? 1 : 0;
      } else if (depth < 6) {
        height = random > 0.48 ? 1 : 0;
      } else if (depth < 9) {
        if (random >= 0.22) {
          height = random > 0.62 ? 2 : 1;
        }
      } else if (depth < 12) {
        height = 1 + Math.floor(random * 2.4);
      } else {
        height = 2 + Math.floor(random * 2);
      }

      const isSignal = depth >= 7 && depth <= 11 && pseudoRandom(gx, gy, 7) > 0.5;
      return { h: height, tone: isSignal ? "signal" : "base" };
    }));

    const aboutRouteScene = createScene("route", 10, 7, (gx, gy) => {
      const direct = gy === 3;
      const indirect =
        (gx === 0 && (gy === 3 || gy === 4 || gy === 5)) ||
        (gy === 5 && gx >= 1 && gx <= 9) ||
        (gx === 9 && (gy === 3 || gy === 4));

      if (direct) {
        return { h: 1, tone: "signal" };
      }

      if (indirect) {
        return { h: 1, tone: "muted" };
      }

      return { h: 0, tone: "base" };
    });

    const terrainHeights = [2, 3, 4, 5, 3, 7, 5, 4, 3, 2];
    const aboutTerrainScene = createScene("terrain", 10, 5, (gx, gy) => ({
      h: Math.max(1, terrainHeights[gx] - Math.round(gy * 0.35)),
      tone: gx === 5 ? "signal" : "base"
    }));

    function createPlatformScene(key, rows, signalCells) {
      const signalSet = new Set(signalCells.map(([row, col]) => `${col}:${row}`));
      return createScene(key, rows[0].length, rows.length, (gx, gy) => ({
        h: rows[gy][gx],
        tone: signalSet.has(`${gx}:${gy}`) ? "signal" : "base"
      }));
    }

    // Platform scenes need GroundGridAssets (loaded lazily by lazy-grid.js).
    // Building deferred until the library is ready; see initPlatformScene below.
    function buildPlatformScenes() {
      return [
        { key: "consumer",       sceneId: "scene-platform-consumer" },
        { key: "infrastructure", sceneId: "scene-platform-infrastructure" },
        { key: "institutions",   sceneId: "scene-platform-institutions" },
      ].map(({ key, sceneId }) => {
        const sceneAsset = window.GroundGridAssets?.getScene(sceneId);
        const shapeAsset = sceneAsset ? window.GroundGridAssets?.getShape(sceneAsset.shapeId) : null;
        if (sceneAsset && shapeAsset) {
          return createPlatformScene(key, shapeAsset.grid, sceneAsset.signalCells || []);
        }
        return null;
      }).filter(Boolean);
    }

    const SCENE_LIBRARY = {
      defrag: aboutDefragScene,
      route: aboutRouteScene,
      terrain: aboutTerrainScene
    };

  // Base grid-object renderer: layout, projection, resize, and static scene drawing.
  function createSceneRenderer(canvas, options) {
      if (!canvas || !options.scene) {
        return null;
      }

      const renderer = {
        kind: "grid-object",
        canvas,
        ctx: canvas.getContext("2d"),
        palette: options.palette,
        scene: options.scene,
        layoutOptions: options.layoutOptions || null,
        scrollElement: options.scrollElement || canvas,
        view: reduceMotion ? 1 : 0,
        targetView: reduceMotion ? 1 : 0,
        currentHeights: Float32Array.from(options.scene.cells.map((cell) => cell.h)),
        targetHeights: Float32Array.from(options.scene.cells.map((cell) => cell.h)),
        activeSignals: new Set(
          options.scene.cells.filter((cell) => cell.tone === "signal").map((cell) => cell.key)
        ),
        dynamic: Boolean(options.dynamic),
        width: 0,
        height: 0,
        dpr: 0,
        onAdvance: options.onAdvance || null
      };

      if (options.dynamic) {
        renderer.scenes = options.scenes;
        renderer.activeSceneIndex = options.activeSceneIndex || 0;
        renderer.nextSceneAt = performance.now() + 3200;
        renderer.userPausedUntil = 0;
      }

      return renderer;
    }

    function resizeSceneRenderer(renderer) {
      if (!renderer) {
        return;
      }

      const rect = renderer.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = window.devicePixelRatio || 1;

      if (renderer.width === width && renderer.height === height && renderer.dpr === dpr) {
        return;
      }

      renderer.width = width;
      renderer.height = height;
      renderer.dpr = dpr;
      renderer.canvas.width = Math.round(width * dpr);
      renderer.canvas.height = Math.round(height * dpr);
      renderer.canvas.style.width = `${width}px`;
      renderer.canvas.style.height = `${height}px`;
      renderer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

  // Scroll/view helpers shared by multiple render modes.
  function getScrollTilt(element) {
      if (reduceMotion || !element) {
        return 1;
      }

      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
      const start = viewport * 0.84;
      const end = viewport * 0.28;
      const progress = (start - rect.top) / Math.max(1, start - end);
      const delayedProgress = clamp((progress - 0.25) / 0.75, 0, 1);

      return smoothstep(0, 1, delayedProgress);
    }

    function getExitScrollTilt(element) {
      if (reduceMotion || !element) {
        return 0;
      }

      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
      // 0 while card is in the reading zone; ramps to 1 as top edge exits at the top
      const start = viewport * 0.22;
      const end = viewport * -0.26;
      const progress = (start - rect.top) / Math.max(1, start - end);

      return smoothstep(0, 1, clamp(progress, 0, 1));
    }

    function getDelayedExitScrollTilt(element, options = {}) {
      if (reduceMotion || !element) {
        return 0;
      }

      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
      const start = viewport * (Number.isFinite(options.startRatio) ? options.startRatio : 0.18);
      const end = viewport * (Number.isFinite(options.endRatio) ? options.endRatio : -0.24);
      const delay = clamp(
        Number.isFinite(options.delayProgress) ? options.delayProgress : 0.28,
        0,
        0.95
      );
      const progress = (start - rect.top) / Math.max(1, start - end);
      const delayedProgress = clamp((progress - delay) / Math.max(0.05, 1 - delay), 0, 1);

      return smoothstep(0, 1, delayedProgress);
    }

  // Projection and drawing utilities for isometric scene rendering.
  function getProjectionBasis(view) {
      const eased = smoothstep(0, 1, view);
      return {
        xAxis: {
          x: mix(1, 1.04, eased),
          y: mix(0, 0.52, eased)
        },
        yAxis: {
          x: mix(0, -1.04, eased),
          y: mix(1, 0.52, eased)
        },
        zLift: mix(0, 1.04, eased)
      };
    }

    function projectScenePoint(x, y, z, basis, scale, offsetX, offsetY) {
      return {
        x: (x * basis.xAxis.x + y * basis.yAxis.x) * scale + offsetX,
        y: (x * basis.xAxis.y + y * basis.yAxis.y - z * basis.zLift) * scale + offsetY
      };
    }

    function resolveViewResponsiveOption(value, view, fallback) {
      if (Number.isFinite(value)) {
        return value;
      }

      if (!value || typeof value !== "object") {
        return fallback;
      }

      const flat = Number.isFinite(value.flat) ? value.flat : fallback;
      const tilt = Number.isFinite(value.tilt) ? value.tilt : flat;
      const start = Number.isFinite(value.start) ? value.start : 0.02;
      const end = Number.isFinite(value.end) ? value.end : 0.34;
      const progress = smoothstep(start, end, clamp(view, 0, 1));
      return mix(flat, tilt, progress);
    }

    function getSceneLayout(scene, heights, view, width, height, options = null) {
      const basis = getProjectionBasis(view);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      scene.cells.forEach((cell, index) => {
        const level = heights[index];
        const points = [
          { x: cell.gx, y: cell.gy, z: 0 },
          { x: cell.gx + 1, y: cell.gy, z: 0 },
          { x: cell.gx + 1, y: cell.gy + 1, z: 0 },
          { x: cell.gx, y: cell.gy + 1, z: 0 },
          { x: cell.gx, y: cell.gy, z: level },
          { x: cell.gx + 1, y: cell.gy, z: level },
          { x: cell.gx + 1, y: cell.gy + 1, z: level },
          { x: cell.gx, y: cell.gy + 1, z: level }
        ];

        points.forEach((point) => {
          const rawX = point.x * basis.xAxis.x + point.y * basis.yAxis.x;
          const rawY = point.x * basis.xAxis.y + point.y * basis.yAxis.y - point.z * basis.zLift;
          minX = Math.min(minX, rawX);
          minY = Math.min(minY, rawY);
          maxX = Math.max(maxX, rawX);
          maxY = Math.max(maxY, rawY);
        });
      });

      const fallbackPadding = Math.max(20, Math.min(width, height) * 0.08);
      const requestedPadding = options
        ? resolveViewResponsiveOption(options.padding, view, fallbackPadding)
        : fallbackPadding;
      const padding = requestedPadding != null
        ? requestedPadding
        : Math.max(20, Math.min(width, height) * 0.08);
      const boundsWidth = Math.max(1, maxX - minX);
      const boundsHeight = Math.max(1, maxY - minY);
      let scale = Math.min(
        (width - padding * 2) / boundsWidth,
        (height - padding * 2) / boundsHeight
      );
      if (options) {
        scale *= resolveViewResponsiveOption(options.scale, view, 1);
      }
      const offsetX = width * 0.5 - ((minX + maxX) * 0.5) * scale;
      const offsetY = height * 0.5 - ((minY + maxY) * 0.5) * scale;

      return {
        basis,
        scale,
        offsetX,
        offsetY
      };
    }

    function drawSceneFace(ctx, points, fill, stroke, alpha) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
      }
      ctx.closePath();
      ctx.fillStyle = rgbString(fill);
      ctx.fill();
      ctx.strokeStyle = rgbString(stroke, alpha);
      ctx.stroke();
    }

    function getToneFaces(palette, tone) {
      if (tone === "signal") {
        return {
          top: palette.signalTop,
          left: palette.signalLeft,
          right: palette.signalRight,
          line: palette.signalLine
        };
      }

      if (tone === "muted") {
        return {
          top: palette.mutedTop,
          left: palette.mutedLeft,
          right: palette.mutedRight,
          line: palette.mutedLine
        };
      }

      return {
        top: palette.top,
        left: palette.left,
        right: palette.right,
        line: palette.line
      };
    }

    function getRendererTone(renderer, cell) {
      if (renderer.dynamic) {
        return renderer.activeSignals.has(cell.key) ? "signal" : "base";
      }

      return cell.tone;
    }

  function renderSceneRenderer(renderer, now) {
      if (!renderer) {
        return;
      }

      resizeSceneRenderer(renderer);

      renderer.targetView = getScrollTilt(renderer.scrollElement);
      renderer.view += (renderer.targetView - renderer.view) * (reduceMotion ? 1 : 0.12);

      if (renderer.dynamic && !reduceMotion && now >= renderer.userPausedUntil && now >= renderer.nextSceneAt) {
        if (typeof renderer.onAdvance === "function") {
          renderer.onAdvance((renderer.activeSceneIndex + 1) % renderer.scenes.length, false, now);
        }
      }

      for (let index = 0; index < renderer.currentHeights.length; index += 1) {
        const delta = renderer.targetHeights[index] - renderer.currentHeights[index];
        if (Math.abs(delta) < 0.002) {
          renderer.currentHeights[index] = renderer.targetHeights[index];
        } else {
          renderer.currentHeights[index] += delta * (reduceMotion ? 1 : 0.12);
        }
      }

      const ctx = renderer.ctx;
      const palette = SCENE_PALETTES[renderer.palette];
      const layout = getSceneLayout(
        renderer.scene,
        renderer.currentHeights,
        renderer.view,
        renderer.width,
        renderer.height,
        renderer.layoutOptions
      );
      const visibleSides = renderer.view > 0.04;
      const orderedCells = renderer.scene.cells
        .slice()
        .sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx);

      ctx.clearRect(0, 0, renderer.width, renderer.height);
      ctx.lineWidth = 0.85;
      ctx.lineJoin = "round";

      orderedCells.forEach((cell) => {
        const index = cell.gy * renderer.scene.cols + cell.gx;
        const heightValue = renderer.currentHeights[index];
        const tone = getRendererTone(renderer, cell);
        const faces = getToneFaces(palette, tone);
        const groundPoints = [
          projectScenePoint(cell.gx, cell.gy, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy + 1, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx, cell.gy + 1, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY)
        ];

        drawSceneFace(
          ctx,
          groundPoints,
          heightValue > 0.02 ? palette.groundOccupied : palette.groundEmpty,
          palette.groundLine,
          palette.groundAlpha
        );

        if (heightValue <= 0.02) {
          return;
        }

        const topPoints = [
          projectScenePoint(cell.gx, cell.gy, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy + 1, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx, cell.gy + 1, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY)
        ];

        if (visibleSides) {
          drawSceneFace(
            ctx,
            [groundPoints[3], groundPoints[2], topPoints[2], topPoints[3]],
            faces.left,
            faces.line,
            0.84
          );
          drawSceneFace(
            ctx,
            [groundPoints[1], groundPoints[2], topPoints[2], topPoints[1]],
            faces.right,
            faces.line,
            0.84
          );
        }

        drawSceneFace(ctx, topPoints, faces.top, faces.line, 0.84);
      });
    }

  // Stream-grid defaults and profile presets for the animated value-card scenes.
  const STREAM_RENDER_DEFAULTS = {
      surfaceTheme: "auto",
      restDurationMs: 1180,
      warmupMs: 320,
      wakeIntervalMs: 110,
      spawnCount: 7,
      spawnIntervalMs: 91,
      gatherMaxDurationMs: 1350,
      centerBand: 0.9,
      streamLockBand: 0.42,
      approachSpeedNear: 1.45,
      approachSpeedCenter: 2.9,
      streamSpeed: 5.8,
      streamSpeedMax: 7.2,
      streamAcceleration: 4.6,
      headLift: 2.25,
      trailLift: 0.95,
      headRadiusX: 1.2,
      headRadiusY: 0.92,
      trailRadiusX: 3.8,
      trailRadiusY: 1.28,
      previewRadiusX: 1.45,
      previewRadiusY: 1.05,
      gatherSpring: 0.034,
      streamSpring: 0.05,
      damping: 0.81,
      streamSettleMs: 1080,
      exitPaddingCols: 2.5
    };

    const SAVE_TIME_KEYFRAME_DEFAULTS = {
      cycleDurationMs: 0,
      spawnDurationMs: 880,
      travelDurationMs: 980,
      convergeDurationMs: 1040,
      lineDurationMs: 840,
      liftDurationMs: 920,
      holdDurationMs: 220,
      releaseDurationMs: 1040,
      resetDurationMs: 520
    };

    const GROW_BALANCE_BAR_DEFAULTS = {
      cycleDurationMs: 0,
      buildDurationMs: 3000,
      holdDurationMs: 1480,
      releaseDurationMs: 920,
      resetDurationMs: 380,
      idleDurationMs: 500
    };

    const OVERSEE_SCAN_LOCK_DEFAULTS = {
      cycleDurationMs: 0,
      scanDurationMs: 1880,
      lockDurationMs: 1520,
      releaseDurationMs: 960,
      resetDurationMs: 460,
      idleDurationMs: 520
    };

    const VALUE_WIDE_GRID_LAYOUT = {
      scale: {
        flat: 1.14,
        tilt: 1.18,
        start: 0.03,
        end: 0.34
      },
      cameraT: 0.02,
      padding: {
        flat: -24,
        tilt: -92,
        start: 0.03,
        end: 0.34
      }
    };

    const VALUE_WIDE_GRID_SCROLL_TILT = {
      startRatio: 0.6,
      endRatio: -0.24,
      delayProgress: 0.04
    };

    const SAVE_TIME_KEYFRAME_ROUTES = [
      {
        spawnAt: 0,
        continueCells: 14,
        points: [
          { x: 25.5, y: 3.5 },
          { x: 25.5, y: 4.5 },
          { x: 8.5, y: 4.5 },
          { x: 8.5, y: 8.5 },
          { x: 14.5, y: 8.5 }
        ]
      },
      {
        spawnAt: 110,
        continueCells: 13,
        points: [
          { x: 21.5, y: 7.5 },
          { x: 8.5, y: 7.5 },
          { x: 14.8, y: 7.5 }
        ]
      },
      {
        spawnAt: 210,
        continueCells: 12,
        points: [
          { x: 16.5, y: 9.5 },
          { x: 15.2, y: 9.5 }
        ]
      },
      {
        spawnAt: 320,
        continueCells: 13,
        points: [
          { x: 25.5, y: 13.5 },
          { x: 8.5, y: 13.5 },
          { x: 8.5, y: 10.5 },
          { x: 14.6, y: 10.5 }
        ]
      },
      {
        spawnAt: 360,
        continueCells: 12,
        points: [
          { x: -2.5, y: 8.5 },
          { x: 8.5, y: 8.5 },
          { x: 16.4, y: 8.5 }
        ]
      },
      {
        spawnAt: 470,
        continueCells: 12,
        points: [
          { x: -3.5, y: 9.5 },
          { x: 8.5, y: 9.5 },
          { x: 15.5, y: 9.5 }
        ]
      },
      {
        spawnAt: 560,
        continueCells: 11,
        points: [
          { x: 10.5, y: 5.5 },
          { x: 8.5, y: 5.5 },
          { x: 8.5, y: 8.5 },
          { x: 15.8, y: 8.5 }
        ]
      },
      {
        spawnAt: 680,
        continueCells: 11,
        points: [
          { x: -2.8, y: 10.5 },
          { x: 8.5, y: 10.5 },
          { x: 15.1, y: 10.5 }
        ]
      },
      {
        spawnAt: 760,
        continueCells: 13,
        points: [
          { x: -4.2, y: 7.5 },
          { x: 9.8, y: 7.5 },
          { x: 18.6, y: 8.5 }
        ]
      },
      {
        spawnAt: 860,
        continueCells: 12,
        points: [
          { x: -4.6, y: 11.5 },
          { x: 10.2, y: 11.5 },
          { x: 18.1, y: 10.5 }
        ]
      }
    ];

  // Stream-grid construction and path/packet helpers.
  function createStreamSceneRenderer(canvas, options) {
      if (!canvas) {
        return null;
      }

      const sceneAsset = options.sceneAsset || { view: {}, stream: {} };
      const scene = options.scene;
      const tiltMode = options.tiltMode || "enter";
      const streamConfig = {
        ...STREAM_RENDER_DEFAULTS,
        ...(sceneAsset.stream || {}),
        ...(options.surfaceTheme ? { surfaceTheme: options.surfaceTheme } : {})
      };
      const motionProfile = options.motionProfile || streamConfig.motionProfile || "default";
      const layoutOptions = motionProfile === "save-time-keyframe"
        ? {
            ...(sceneAsset.view || {}),
            cameraT: 0.02,
            padding: {
              flat: -24,
              tilt: -100,
              start: 0.03,
              end: 0.34
            },
            scale: {
              flat: 1.11,
              tilt: 1.16,
              start: 0.03,
              end: 0.34
            }
          }
        : (sceneAsset.view || null);
      const baseView = clamp(
        Number.isFinite(layoutOptions && layoutOptions.cameraT) ? layoutOptions.cameraT : 0.62,
        0,
        1
      );
      const initialView = motionProfile === "save-time-keyframe"
        ? (reduceMotion ? 0.05 : 0.015)
        : tiltMode === "exit"
        ? (reduceMotion ? baseView : options.flatAtRest ? 0.015 : baseView)
        : (reduceMotion ? baseView : Math.max(0.36, baseView * 0.72));
      const now = performance.now();

      return {
        kind: "stream-grid",
        canvas,
        ctx: canvas.getContext("2d"),
        scene,
        sceneAsset,
        shapeAsset: options.shapeAsset || null,
        layoutOptions,
        scrollElement: options.scrollElement || canvas,
        stream: streamConfig,
        motionProfile,
        tiltMode,
        scrollTiltOptions: options.scrollTiltOptions || null,
        flatAtRest: Boolean(options.flatAtRest),
        baseView,
        view: initialView,
        targetView: baseView,
        currentHeights: new Float32Array(scene.cells.length),
        currentSignal: new Float32Array(scene.cells.length),
        currentWake: new Float32Array(scene.cells.length),
        targetHeights: new Float32Array(scene.cells.length),
        targetSignal: new Float32Array(scene.cells.length),
        targetWake: new Float32Array(scene.cells.length),
        overlaySegments: [],
        packets: [],
        phase: "rest",
        phaseStartedAt: now - streamConfig.restDurationMs + 260,
        cycleIndex: 0,
        width: 0,
        height: 0,
        dpr: 0
      };
    }

    function getPolylineLength(points) {
      let length = 0;

      for (let index = 1; index < points.length; index += 1) {
        const prev = points[index - 1];
        const next = points[index];
        length += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
      }

      return length;
    }

    function getPointAlongPolyline(points, progress) {
      if (points.length === 1) {
        return { x: points[0].x, y: points[0].y };
      }

      const totalLength = getPolylineLength(points);
      if (totalLength <= 0.001) {
        return { x: points[0].x, y: points[0].y };
      }

      let remaining = clamp(progress, 0, 1) * totalLength;

      for (let index = 1; index < points.length; index += 1) {
        const prev = points[index - 1];
        const next = points[index];
        const segmentLength = Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);

        if (remaining <= segmentLength || index === points.length - 1) {
          const segmentProgress = segmentLength <= 0.001 ? 0 : remaining / segmentLength;
          return {
            x: mix(prev.x, next.x, segmentProgress),
            y: mix(prev.y, next.y, segmentProgress)
          };
        }

        remaining -= segmentLength;
      }

      const last = points[points.length - 1];
      return { x: last.x, y: last.y };
    }

    function getSaveTimeKeyframeTiming(renderer) {
      const configured = renderer.stream.saveTimeKeyframe || {};
      const merged = { ...SAVE_TIME_KEYFRAME_DEFAULTS, ...configured };
      const totalDuration =
        merged.spawnDurationMs +
        merged.travelDurationMs +
        merged.convergeDurationMs +
        merged.lineDurationMs +
        merged.liftDurationMs +
        merged.holdDurationMs +
        merged.releaseDurationMs +
        merged.resetDurationMs;
      merged.cycleDurationMs = Math.max(totalDuration, merged.cycleDurationMs || 0);
      return merged;
    }

    function getGrowBalanceBarTiming(renderer) {
      const configured = renderer.stream.growBalanceBars || {};
      const merged = { ...GROW_BALANCE_BAR_DEFAULTS, ...configured };
      const totalDuration =
        merged.buildDurationMs +
        merged.holdDurationMs +
        merged.releaseDurationMs +
        merged.resetDurationMs +
        merged.idleDurationMs;
      merged.cycleDurationMs = Math.max(totalDuration, merged.cycleDurationMs || 0);
      return merged;
    }

    function getOverseeScanLockTiming(renderer) {
      const configured = renderer.stream.overseeScanLock || {};
      const merged = { ...OVERSEE_SCAN_LOCK_DEFAULTS, ...configured };
      const totalDuration =
        merged.scanDurationMs +
        merged.lockDurationMs +
        merged.releaseDurationMs +
        merged.resetDurationMs +
        merged.idleDurationMs;
      merged.cycleDurationMs = Math.max(totalDuration, merged.cycleDurationMs || 0);
      return merged;
    }

    function addOverlaySegment(segments, start, end, alpha, width = 1) {
      if (alpha <= 0.001) {
        return;
      }

      segments.push({ start, end, alpha, width });
    }

    function addPolylineOverlay(segments, points, reveal, alpha, width = 1) {
      const clampedReveal = clamp(reveal, 0, 1);
      if (clampedReveal <= 0.001) {
        return;
      }

      const totalLength = getPolylineLength(points);
      let remaining = totalLength * clampedReveal;

      for (let index = 1; index < points.length && remaining > 0; index += 1) {
        const prev = points[index - 1];
        const next = points[index];
        const segmentLength = Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
        const visibleLength = Math.min(remaining, segmentLength);
        const segmentProgress = segmentLength <= 0.001 ? 0 : visibleLength / segmentLength;

        addOverlaySegment(
          segments,
          prev,
          {
            x: mix(prev.x, next.x, segmentProgress),
            y: mix(prev.y, next.y, segmentProgress)
          },
          alpha,
          width
        );

        remaining -= visibleLength;
      }
    }

    function applyLineBand(field, cols, row, startX, endX, strength) {
      if (strength <= 0.001) {
        return;
      }

      const clampedStart = Math.max(0, Math.min(startX, endX));
      const clampedEnd = Math.min(cols - 0.2, Math.max(startX, endX));
      const minCol = Math.max(0, Math.floor(clampedStart - 1));
      const maxCol = Math.min(cols - 1, Math.ceil(clampedEnd + 1));

      for (let col = minCol; col <= maxCol; col += 1) {
        const distance =
          col < clampedStart ? clampedStart - col : col > clampedEnd ? col - clampedEnd : 0;
        const influence = strength * Math.exp(-distance * distance * 2.8);
        const index = Math.round(row) * cols + col;
        field[index] = Math.min(1.9, field[index] + influence);
      }
    }

    function resolveStreamSceneTheme(renderer) {
      const explicit = renderer.stream.surfaceTheme;
      if (explicit === "dark" || explicit === "light") {
        return explicit;
      }

      const rootTheme = document.documentElement.dataset.theme;
      if (rootTheme === "dark" || rootTheme === "light") {
        return rootTheme;
      }

      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }

      return "light";
    }

    function createStreamPacket(renderer, now, entry, index) {
      const centerRow = (renderer.scene.rows - 1) * 0.5;
      const wakeAt = now + index * renderer.stream.spawnIntervalMs;
      const wakeDuration =
        renderer.stream.warmupMs * mix(0.72, 1.18, pseudoRandom(entry.seed, renderer.cycleIndex, 29)) +
        renderer.stream.wakeIntervalMs * 0.35;

      return {
        seed: entry.seed,
        startX: entry.startX,
        startY: entry.startY,
        x: entry.startX,
        y: entry.startY,
        vx: 0,
        vy: 0,
        targetY:
          centerRow +
          (pseudoRandom(entry.seed, renderer.cycleIndex, 37) - 0.5) * renderer.stream.centerBand * 2,
        wakeAt,
        moveAt: wakeAt + wakeDuration,
        gatherDeadline: wakeAt + wakeDuration + renderer.stream.gatherMaxDurationMs,
        streamStartedAt: 0,
        phase: "queued",
        baseOpacity: 0.74 + pseudoRandom(entry.seed, renderer.cycleIndex, 43) * 0.24,
        streamBias: 0.9 + pseudoRandom(entry.seed, renderer.cycleIndex, 47) * 0.24,
        wavePhase: pseudoRandom(entry.seed, renderer.cycleIndex, 53) * Math.PI * 2,
        burstDecayMs: 400
      };
    }

    function startStreamCycle(renderer, now) {
      const count = Math.max(1, Math.round(renderer.stream.spawnCount));
      const centerRow = (renderer.scene.rows - 1) * 0.5;
      const entries = [];

      for (let index = 0; index < count; index += 1) {
        const seed = renderer.cycleIndex * 97 + index * 17 + 1;
        const xSpread = pseudoRandom(seed, renderer.cycleIndex, 11);
        const ySpread = pseudoRandom(seed, renderer.cycleIndex, 17);
        const startX = mix(0.35, Math.max(1.2, renderer.scene.cols - 2.2), Math.pow(xSpread, 0.9));
        const startY = mix(0.45, Math.max(0.55, renderer.scene.rows - 1.45), ySpread);
        const orderMetric =
          startX * 0.68 +
          Math.abs(startY - centerRow) * 1.14 +
          pseudoRandom(seed, renderer.cycleIndex, 23) * 1.35;

        entries.push({ seed, startX, startY, orderMetric });
      }

      entries.sort((a, b) => a.orderMetric - b.orderMetric);
      renderer.packets = entries.map((entry, index) => createStreamPacket(renderer, now, entry, index));
      renderer.phase = "active";
      renderer.phaseStartedAt = now;
    }

    function updateStreamPacket(renderer, packet, now, dtSeconds) {
      const centerRow = (renderer.scene.rows - 1) * 0.5;

      if (packet.phase === "queued" && now >= packet.wakeAt) {
        packet.phase = "wake";
      }

      if (packet.phase === "wake" && now >= packet.moveAt) {
        packet.phase = "gather";
        packet.vx = renderer.stream.approachSpeedNear * (0.8 + packet.streamBias * 0.12) * 1.8;
        packet.vy += (Math.random() - 0.5) * 0.8;
      }

      if (packet.phase === "gather" || packet.phase === "stream") {
        if (
          packet.phase === "gather" &&
          (
            Math.abs(packet.y - centerRow) <= renderer.stream.streamLockBand ||
            packet.x >= renderer.scene.cols * 0.48 ||
            now >= packet.gatherDeadline
          )
        ) {
          packet.phase = "stream";
          packet.streamStartedAt = now;
          packet.targetY = centerRow;
          packet.vx = Math.max(packet.vx, renderer.stream.streamSpeed * packet.streamBias);
        }

        const spring = packet.phase === "stream" ? renderer.stream.streamSpring : renderer.stream.gatherSpring;
        const dy = packet.targetY - packet.y;
        packet.vy = (packet.vy + dy * spring) * renderer.stream.damping;
        packet.y += packet.vy * dtSeconds * 60;

        const proximity = 1 - clamp(
          Math.abs(packet.y - centerRow) / Math.max(1, renderer.scene.rows * 0.5),
          0,
          1
        );
        const proximityEase = easeOutCubic(Math.pow(proximity, 1.55));
        let targetSpeed = mix(
          renderer.stream.approachSpeedNear,
          renderer.stream.approachSpeedCenter,
          proximityEase
        );

        if (packet.phase === "stream") {
          const streamElapsed = Math.max(0, (now - packet.streamStartedAt) / 1000);
          const settleProgress = clamp(
            (streamElapsed * 1000) / Math.max(1, renderer.stream.streamSettleMs),
            0,
            1
          );
          targetSpeed = mix(
            Math.max(renderer.stream.streamSpeed * 0.92, targetSpeed),
            renderer.stream.streamSpeedMax,
            easeOutCubic(settleProgress)
          ) * packet.streamBias;
          if ((now - packet.wakeAt) < (packet.burstDecayMs || 400)) {
            const burstFactor = 1 + 0.8 * easeOutCubic(1 - Math.min(1, (now - packet.wakeAt) / (packet.burstDecayMs || 400)));
            targetSpeed *= burstFactor;
          }
        }

        packet.vx += (targetSpeed - packet.vx) * (packet.phase === "stream" ? 0.18 : 0.12);
        packet.x += packet.vx * dtSeconds * 60;
      }

      return packet.x <= renderer.scene.cols + renderer.stream.exitPaddingCols;
    }

    function accumulateStreamField(field, cols, rows, centerX, centerY, radiusX, radiusY, amount) {
      if (amount <= 0.001) {
        return;
      }

      const colReach = Math.max(1, Math.ceil(radiusX * 2.8));
      const rowReach = Math.max(1, Math.ceil(radiusY * 2.8));
      const minCol = Math.max(0, Math.floor(centerX - colReach));
      const maxCol = Math.min(cols - 1, Math.ceil(centerX + colReach));
      const minRow = Math.max(0, Math.floor(centerY - rowReach));
      const maxRow = Math.min(rows - 1, Math.ceil(centerY + rowReach));

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const dx = (col - centerX) / Math.max(radiusX, 0.01);
          const dy = (row - centerY) / Math.max(radiusY, 0.01);
          const dist = dx * dx + dy * dy;

          if (dist > 5.5) {
            continue;
          }

          const influence = amount * Math.exp(-dist * 1.18);
          const index = row * cols + col;
          field[index] = Math.min(1.6, field[index] + influence);
        }
      }
    }

    function getStreamToneFaces(palette, signalAmount, wakeAmount) {
      const wakeBlend = clamp(wakeAmount, 0, 1);
      const signalBlend = clamp(signalAmount, 0, 1);
      const wakeTop = mixRgb(palette.top, palette.wakeTop, wakeBlend);
      const wakeLeft = mixRgb(palette.left, palette.wakeLeft, wakeBlend);
      const wakeRight = mixRgb(palette.right, palette.wakeRight, wakeBlend);
      const wakeLine = mixRgb(palette.line, palette.wakeLine, wakeBlend * 0.88);

      return {
        top: mixRgb(wakeTop, palette.signalTop, signalBlend),
        left: mixRgb(wakeLeft, palette.signalLeft, signalBlend * 0.94),
        right: mixRgb(wakeRight, palette.signalRight, signalBlend * 0.96),
        line: mixRgb(wakeLine, palette.signalLine, signalBlend * 0.9)
      };
    }

  // Motion profile: "grow-balance-bars"
  function applyGrowBalanceBarsProfile(renderer, now) {
      const timing = getGrowBalanceBarTiming(renderer);
      const loopMs = timing.cycleDurationMs;
      const localMs = ((now - renderer.phaseStartedAt) % loopMs + loopMs) % loopMs;
      const buildEnd = timing.buildDurationMs;
      const holdEnd = buildEnd + timing.holdDurationMs;
      const releaseEnd = holdEnd + timing.releaseDurationMs;
      const resetEnd = releaseEnd + timing.resetDurationMs;
      const rows = renderer.scene.rows;
      const cols = renderer.scene.cols;
      const isoLift = smoothstep(0.035, 0.34, Math.max(renderer.view, renderer.targetView));
      const isoHeightReveal = easeOutCubic(
        smoothstep(0.12, 0.34, Math.max(renderer.view, renderer.targetView))
      );
      const baseRow = 15;
      const bars = [
        { start: 4, width: 3, cells: 2, maxHeight: 2.8, signal: 0.48 },
        { start: 8, width: 3, cells: 3, maxHeight: 4.2, signal: 0.54 },
        { start: 12, width: 3, cells: 4, maxHeight: 6.0, signal: 0.60 },
        { start: 16, width: 3, cells: 5, maxHeight: 8.2, signal: 0.66 },
        { start: 20, width: 3, cells: 6, maxHeight: 10.8, signal: 0.72 },
        { start: 24, width: 3, cells: 7, maxHeight: 12.0, signal: 0.80 }
      ];

      const cellStaggerX = 260;
      const cellStaggerY = 110;
      const cellStaggerCol = 55;
      const cellRiseDuration = 820;
      const wavePulseMs = 280;
      const waveDepth = 0.15;

      renderer.overlaySegments = [];

      const baselineFade = localMs < releaseEnd
        ? 1
        : localMs < resetEnd
        ? 1 - easeInCubic((localMs - releaseEnd) / Math.max(1, timing.resetDurationMs))
        : 0;

      if (baselineFade > 0.001) {
        applyLineBand(renderer.targetWake, cols, baseRow + 0.5, -2.4, cols + 2.4, (0.08 + isoLift * 0.06) * baselineFade);
        applyLineBand(renderer.targetHeights, cols, baseRow + 0.5, -2.4, cols + 2.4, 0.06 * baselineFade);
      }

      bars.forEach((bar, barIndex) => {
        const columnLift = mix(1.0, bar.maxHeight, isoHeightReveal);
        const pulse = 0.92 + 0.08 * Math.sin(now * 0.0032 + barIndex * 0.7);

        for (let widthOffset = 0; widthOffset < bar.width; widthOffset += 1) {
          const gx = bar.start + widthOffset;

          for (let level = 0; level < bar.cells; level += 1) {
            const cellDelay = barIndex * cellStaggerX + level * cellStaggerY + widthOffset * cellStaggerCol;
            let fill = 0;
            let opacity = 1;

            if (localMs < holdEnd) {
              const cellMs = Math.max(0, localMs - cellDelay);
              fill = easeOutCubic(clamp(cellMs / cellRiseDuration, 0, 1));
              const waveArrivalAt = cellDelay + cellRiseDuration;
              const waveT = clamp((localMs - waveArrivalAt) / wavePulseMs, 0, 1);
              fill *= 1 - waveDepth * Math.sin(waveT * Math.PI);
            } else if (localMs < releaseEnd) {
              const releaseDelay = barIndex * 30 + level * 20 + widthOffset * 15;
              const releaseProgress = clamp((localMs - holdEnd - releaseDelay) / Math.max(1, timing.releaseDurationMs), 0, 1);
              const riseMs = Math.max(0, holdEnd - cellDelay);
              fill = easeOutCubic(clamp(riseMs / cellRiseDuration, 0, 1)) * Math.max(0, 1 - easeInCubic(releaseProgress));
              opacity = 1 - easeInCubic(clamp((localMs - holdEnd) / Math.max(1, timing.releaseDurationMs), 0, 1)) * 0.72;
            } else if (localMs < resetEnd) {
              const resetProgress = clamp((localMs - releaseEnd) / Math.max(1, timing.resetDurationMs), 0, 1);
              fill = Math.max(0, 0.22 - resetProgress * 0.22);
              opacity = Math.max(0, 0.28 - resetProgress * 0.28);
            } else {
              return;
            }

            if (fill <= 0.001 || opacity <= 0.001) {
              continue;
            }

            const gy = baseRow - level;
            if (gy < 0 || gy >= rows) {
              continue;
            }

            const index = gy * cols + gx;
            const topCell = level >= bar.cells - 1;
            const crest = topCell ? 0.08 + isoLift * 0.14 : 0;
            const signal = Math.min(1.2, (0.34 + bar.signal) * (0.76 + fill * 0.24 + crest) * pulse) * opacity;
            const wake = Math.min(0.9, (0.22 + crest + (1 - fill) * 0.08) * fill) * opacity;
            const waveSettled = clamp((localMs - (cellDelay + cellRiseDuration + wavePulseMs)) / 500, 0, 1);
            const xFraction = barIndex / (bars.length - 1); // 0 = leftmost bar, 1 = rightmost
            const textureDrift = Math.sin(now * 0.00028 + level * 1.1) * 0.16;
            const textureOffset = (xFraction * 0.75 + textureDrift * 0.25) * 0.09 * waveSettled * Math.min(fill, 1);
            const height = Math.max(
              renderer.targetHeights[index],
              (fill + textureOffset) * columnLift * opacity
            );

            renderer.targetSignal[index] = Math.max(renderer.targetSignal[index], signal);
            renderer.targetWake[index] = Math.max(renderer.targetWake[index], wake);
            renderer.targetHeights[index] = height;
          }
        }

        const topCellDelay = barIndex * cellStaggerX + (bar.cells - 1) * cellStaggerY;
        const topCellMs = Math.max(0, Math.min(holdEnd, localMs) - topCellDelay);
        const shimmerProgress = localMs < holdEnd
          ? easeOutCubic(clamp(topCellMs / cellRiseDuration, 0, 1))
          : localMs < releaseEnd
          ? (1 - clamp((localMs - holdEnd) / Math.max(1, timing.releaseDurationMs), 0, 1) * 0.35)
          : 0;

        if (shimmerProgress > 0.001) {
          const shimmerX = bar.start + bar.width * 0.5;
          const shimmerY = baseRow - bar.cells + 0.35;
          accumulateStreamField(
            renderer.targetWake,
            cols,
            rows,
            shimmerX,
            shimmerY,
            1.1,
            0.7,
            shimmerProgress * (0.12 + bar.signal * 0.12)
          );
        }
      });
    }

  // Motion profile: "oversee-scan-lock"
  function applyOverseeScanLockProfile(renderer, now) {
      const timing = getOverseeScanLockTiming(renderer);
      const loopMs = timing.cycleDurationMs;
      const localMs = ((now - renderer.phaseStartedAt) % loopMs + loopMs) % loopMs;
      const cycleNumber = Math.floor((now - renderer.phaseStartedAt) / loopMs);
      const scanEnd = timing.scanDurationMs;
      const lockEnd = scanEnd + timing.lockDurationMs;
      const releaseEnd = lockEnd + timing.releaseDurationMs;
      const resetEnd = releaseEnd + timing.resetDurationMs;
      const rows = renderer.scene.rows;
      const cols = renderer.scene.cols;
      const isoHeightReveal = easeOutCubic(
        smoothstep(0.12, 0.34, Math.max(renderer.view, renderer.targetView))
      );
      const sweepBands = [
        { row: 5, thickness: 4, length: 13.8, delay: 0, signal: 0.34, wake: 0.18, lift: 0.56 },
        { row: 10, thickness: 5, length: 16.2, delay: 180, signal: 0.46, wake: 0.24, lift: 0.74 },
        { row: 15, thickness: 4, length: 14.6, delay: 360, signal: 0.38, wake: 0.2, lift: 0.6 }
      ];
      const HIGHLIGHT_SQUARES = [
        { x: 3,  y: 4, w: 10, h: 10 },
        { x: 12, y: 3, w: 11, h: 10 },
        { x: 17, y: 6, w: 10, h: 9  }
      ];
      const square = HIGHLIGHT_SQUARES[cycleNumber % HIGHLIGHT_SQUARES.length];

      renderer.overlaySegments = [];

      if (localMs < scanEnd) {
        sweepBands.forEach((band) => {
          const progress = easeOutCubic(
            clamp((localMs - band.delay) / Math.max(760, timing.scanDurationMs - band.delay * 0.24), 0, 1)
          );
          const leadX = mix(-band.length - 3.8, cols + band.length + 4.8, progress);
          const segmentStart = leadX - band.length;
          const bandFade =
            smoothstep(0.02, 0.16, progress) *
            (1 - smoothstep(0.84, 1, progress));
          const halfThickness = Math.floor(band.thickness * 0.5);

          for (let rowOffset = -halfThickness; rowOffset <= halfThickness; rowOffset += 1) {
            const targetRow = band.row + rowOffset;
            if (targetRow < 0 || targetRow >= rows) {
              continue;
            }
            const widthFalloff = 1 - Math.abs(rowOffset) / Math.max(1, halfThickness + 0.75);
            const rowSignal = band.signal * bandFade * (0.56 + widthFalloff * 0.44);
            const rowWake = band.wake * bandFade * (0.64 + widthFalloff * 0.36);
            const rowLift = band.lift * bandFade * (0.62 + widthFalloff * 0.38);

            applyLineBand(renderer.targetSignal, cols, targetRow, segmentStart, leadX, rowSignal);
            applyLineBand(renderer.targetWake, cols, targetRow, segmentStart - 1.2, leadX + 1.2, rowWake);
            applyLineBand(renderer.targetHeights, cols, targetRow, segmentStart, leadX, rowLift);
          }

          accumulateStreamField(renderer.targetSignal, cols, rows, leadX, band.row, 3.6, 1.6, 0.28 + band.signal * 0.42);
          accumulateStreamField(renderer.targetWake, cols, rows, leadX + 0.75, band.row, 4.1, 1.9, 0.14 + band.signal * 0.22);
        });
      }

      if (localMs >= scanEnd && localMs < releaseEnd) {
        const squareIdx = cycleNumber % HIGHLIGHT_SQUARES.length;

        let squareProgress;
        if (localMs < lockEnd) {
          squareProgress = easeOutCubic((localMs - scanEnd) / Math.max(1, timing.lockDurationMs));
        } else {
          squareProgress = 1 - easeInCubic((localMs - lockEnd) / Math.max(1, timing.releaseDurationMs));
        }

        const maxCellHeight = mix(1.4, 9.6, isoHeightReveal);
        const cellCascadeDuration = 340;
        const cellRevealDuration = 460;

        // Each cycle shows a distinct data-viz chart type.
        // 0 = bar chart, 1 = donut/pie, 2 = area/line chart
        const chartType = squareIdx % 3;
        const BAR_VALUES    = [0.32, 0.52, 0.72, 0.94, 0.78, 0.58, 0.42, 0.62];
        const SECTOR_VALUES = [0.85, 0.52, 0.76, 0.38, 0.64];

        for (let dx = 0; dx < square.w; dx += 1) {
          for (let dy = 0; dy < square.h; dy += 1) {
            const gx = square.x + dx;
            const gy = square.y + dy;
            if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) {
              continue;
            }

            // Wave sweeps left-to-right with subtle vertical ripple (wave/shimmer vs defrag diagonal)
            const waveRipple = 0.22 * (1 - Math.abs(dy - (square.h - 1) * 0.5) / Math.max(1, square.h * 0.5));
            const cellDelay = (dx / Math.max(1, square.w - 1) + waveRipple * (dy / Math.max(1, square.h - 1))) * cellCascadeDuration;
            const cellMs = Math.max(0, (localMs - scanEnd) - cellDelay);
            const cellProgress = easeOutCubic(clamp(cellMs / cellRevealDuration, 0, 1));
            const fill = cellProgress * squareProgress;

            if (fill <= 0.001) {
              continue;
            }

            const index = gy * cols + gx;
            let heightFraction, signal, wake;

            if (chartType === 0) {
              // Bar chart: columns of increasing-then-decreasing height
              const barVal = BAR_VALUES[Math.min(dx, BAR_VALUES.length - 1)];
              const barFloor = Math.floor(square.h * (1 - barVal));
              const inBar = dy >= barFloor;
              const isBarTop = dy === barFloor;
              heightFraction = inBar ? barVal : 0.04;
              signal = inBar ? 0.44 + barVal * 0.54 : 0.08;
              wake = inBar ? 0.14 + (isBarTop ? 0.24 : 0) : 0.04;
            } else if (chartType === 1) {
              // Donut / pie: radial sectors at varying heights
              const cx = (square.w - 1) * 0.5;
              const cy = (square.h - 1) * 0.5;
              const ddx = dx - cx;
              const ddy = dy - cy;
              const r = Math.sqrt(ddx * ddx + ddy * ddy);
              const maxR = Math.min(square.w, square.h) * 0.5;
              const angle = Math.atan2(ddy, ddx);
              const sector = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * SECTOR_VALUES.length);
              const sectorVal = SECTOR_VALUES[sector % SECTOR_VALUES.length];
              const rNorm = r / Math.max(0.5, maxR);
              const inDonut = rNorm >= 0.28 && rNorm <= 0.88;
              const onSectorEdge = Math.abs(rNorm - 0.58) < 0.18;
              heightFraction = inDonut ? sectorVal * (0.6 + rNorm * 0.4) : 0.04;
              signal = inDonut ? 0.38 + sectorVal * 0.58 : 0.06;
              wake = inDonut && onSectorEdge ? 0.28 : inDonut ? 0.1 : 0.02;
            } else {
              // Area / line chart: smooth wave profile
              const wavePhase = (dx / Math.max(1, square.w - 1)) * Math.PI * 1.8;
              const waveVal = 0.38 + 0.54 * (0.5 + 0.5 * Math.sin(wavePhase));
              const lineRow = square.h * (1 - waveVal);
              const inArea = dy >= Math.floor(lineRow);
              const isLine = Math.abs(dy - lineRow) < 1.2;
              heightFraction = inArea ? waveVal * (0.5 + (square.h - dy) / square.h * 0.5) : 0.04;
              signal = isLine ? 0.9 : inArea ? 0.36 + waveVal * 0.4 : 0.06;
              wake = isLine ? 0.32 : inArea ? 0.1 : 0.02;
            }

            // Shimmer: slow wave rolls diagonally across chart cells after reveal
            const shimmer = 1 + 0.07 * Math.sin(now * 0.0016 + gx * 0.35 + gy * 0.48);
            const cellHeight = maxCellHeight * heightFraction * fill;
            renderer.targetSignal[index] = Math.max(renderer.targetSignal[index], signal * fill * shimmer);
            renderer.targetWake[index] = Math.max(renderer.targetWake[index], wake * fill);
            renderer.targetHeights[index] = Math.max(renderer.targetHeights[index], cellHeight);
          }
        }

        // Glow at square center
        const centerX = square.x + square.w * 0.5;
        const centerY = square.y + square.h * 0.5;
        accumulateStreamField(renderer.targetSignal, cols, rows, centerX, centerY, square.w * 0.6, square.h * 0.5, 0.18 * squareProgress);
        accumulateStreamField(renderer.targetWake, cols, rows, centerX, centerY, square.w * 0.5, square.h * 0.4, 0.10 * squareProgress);
      }

      // ── Sonar pulse: radiating ring from locked square after release ──
      if (localMs >= releaseEnd && localMs < resetEnd) {
        const pulseDuration = timing.resetDurationMs;
        const pulseT = clamp((localMs - releaseEnd) / Math.max(1, pulseDuration), 0, 1);
        const centerX = square.x + square.w * 0.5;
        const centerY = square.y + square.h * 0.5;
        // Ring expands outward: radius grows from 0 to ~10, fades as it expands
        const maxRadius = 10.0;
        const ringRadius = pulseT * maxRadius;
        const ringFade = Math.max(0, 1 - pulseT) * (1 - easeInCubic(pulseT));
        if (ringFade > 0.01) {
          // Sample a ring of points and accumulate small field blobs at each
          const ringPoints = 24;
          const ringThickness = 1.8;
          for (let i = 0; i < ringPoints; i++) {
            const angle = (i / ringPoints) * Math.PI * 2;
            const rx = centerX + Math.cos(angle) * ringRadius;
            const ry = centerY + Math.sin(angle) * ringRadius * 0.62;
            if (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
              accumulateStreamField(renderer.targetSignal, cols, rows, rx, ry, ringThickness, ringThickness * 0.62, ringFade * 0.34);
              accumulateStreamField(renderer.targetWake, cols, rows, rx, ry, ringThickness * 1.2, ringThickness * 0.75, ringFade * 0.18);
            }
          }
        }
      }
    }

  // Motion profile: "save-time-keyframe"
  function applySaveTimeKeyframeProfile(renderer, now) {
      const cols = renderer.scene.cols;
      const rows = renderer.scene.rows;
      const centerRow = Math.round((rows - 1) * 0.5);
      const isoHeightReveal = easeOutCubic(
        smoothstep(0.12, 0.34, Math.max(renderer.view, renderer.targetView))
      );

      renderer.overlaySegments = [];

      // ── Stream: always-on traveling wave ──
      const streamBaseH   = 0.6;
      const streamWaveAmp = 5.0;
      const streamCycles  = 2.2;
      const streamSpeedMs = 1400;

      for (let gx = 0; gx < cols; gx++) {
        const phase  = (gx / (cols - 1)) * streamCycles * Math.PI * 2 - (now / streamSpeedMs) * Math.PI * 2;
        const wave   = 0.5 + 0.5 * Math.sin(phase);
        const h      = (streamBaseH + streamWaveAmp * wave) * isoHeightReveal;
        const signal = 0.82 + 0.36 * wave;
        const wake   = 0.18 + 0.26 * wave;
        const idx    = centerRow * cols + gx;
        renderer.targetHeights[idx] = Math.max(renderer.targetHeights[idx], h);
        renderer.targetSignal[idx]  = Math.max(renderer.targetSignal[idx],  signal);
        renderer.targetWake[idx]    = Math.max(renderer.targetWake[idx],    wake);
      }

      // ── Travelers: cells converging from above and below ──
      const loopMs     = 3000;
      const travelMs   = 1000;
      const trailLen   = 3;
      const trailStep  = 0.08; // look-back distance per trail cell (in progress units)
      const srcAbove   = 2;
      const srcBelow   = rows - 3;
      const turnRowGap = 1;   // 1 cell from center before turning
      const turnCells  = 4;   // cells swept right along turn row
      // Progress fractions for three orthogonal segments
      const p1End = 0.72; // vertical approach ends
      const p2End = 0.92; // horizontal sweep ends, final 1-row drop begins

      // Returns {row, col} for a traveler at a given progress value
      const getTravelerPos = (p, srcRow, turnRow, startGx, endGx) => {
        if (p <= 0) return { row: srcRow, col: startGx };
        if (p < p1End) {
          return { row: Math.round(mix(srcRow, turnRow, p / p1End)), col: startGx };
        } else if (p < p2End) {
          return { row: turnRow, col: Math.round(mix(startGx, endGx, (p - p1End) / (p2End - p1End))) };
        } else {
          return { row: Math.round(mix(turnRow, centerRow, (p - p2End) / (1 - p2End))), col: endGx };
        }
      };

      const travelers = [
        { gx:  3, fromAbove: true,  offset:    0 },
        { gx:  8, fromAbove: false, offset:  230 },
        { gx: 14, fromAbove: true,  offset:  460 },
        { gx: 19, fromAbove: false, offset:  680 },
        { gx: 24, fromAbove: true,  offset:  900 },
        { gx: 27, fromAbove: false, offset: 1150 },
        { gx:  6, fromAbove: false, offset: 1480 },
        { gx: 11, fromAbove: true,  offset: 1700 },
        { gx: 17, fromAbove: false, offset: 1950 },
        { gx: 22, fromAbove: true,  offset: 2180 },
        { gx:  5, fromAbove: false, offset: 2480 },
        { gx: 26, fromAbove: true,  offset: 2720 },
      ];

      travelers.forEach(({ gx, fromAbove, offset }) => {
        if (gx < 0 || gx >= cols) return;
        const elapsed  = ((now % loopMs) - offset + loopMs) % loopMs;
        if (elapsed >= travelMs) return;

        const progress = clamp(elapsed / travelMs, 0, 1);
        const srcRow   = fromAbove ? srcAbove : srcBelow;
        const turnRow  = fromAbove ? centerRow - turnRowGap : centerRow + turnRowGap;
        const arrGx    = Math.min(cols - 1, gx + turnCells);

        // Trail follows the real path by computing positions at earlier progress values
        for (let t = 0; t <= trailLen; t++) {
          const tp  = Math.max(0, progress - t * trailStep);
          const pos = getTravelerPos(tp, srcRow, turnRow, gx, arrGx);
          if (pos.row < 0 || pos.row >= rows || pos.row === centerRow) continue;
          if (pos.col < 0 || pos.col >= cols) continue;

          const fade      = t === 0 ? 1.0 : Math.max(0, 1 - t / (trailLen + 1));
          const proximity = 1 - Math.abs(pos.row - centerRow) / Math.abs(srcRow - centerRow);
          const idx       = pos.row * cols + pos.col;
          renderer.targetSignal[idx]  = Math.max(renderer.targetSignal[idx],  fade * (0.72 + proximity * 0.46));
          renderer.targetWake[idx]    = Math.max(renderer.targetWake[idx],    fade * 0.26);
          renderer.targetHeights[idx] = Math.max(renderer.targetHeights[idx], fade * (0.3 + proximity * 0.9) * isoHeightReveal);
        }

        // Merge flash at arrival column as traveler reaches centerRow
        if (progress > 0.90) {
          const mergeFade = easeOutCubic(clamp((progress - 0.90) / 0.10, 0, 1));
          accumulateStreamField(renderer.targetSignal, cols, rows, arrGx, centerRow, 1.4, 0.7, mergeFade * 0.38);
        }
      });
    }


  // Final stream-grid draw pass.
  function drawStreamOverlays(renderer, layout, palette, themeMode) {
      if (!renderer.overlaySegments || !renderer.overlaySegments.length) {
        return;
      }

      const ctx = renderer.ctx;
      renderer.overlaySegments.forEach((segment) => {
        const start = projectScenePoint(segment.start.x, segment.start.y, 0.01, layout.basis, layout.scale, layout.offsetX, layout.offsetY);
        const end = projectScenePoint(segment.end.x, segment.end.y, 0.01, layout.basis, layout.scale, layout.offsetX, layout.offsetY);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineWidth = segment.width;
        ctx.strokeStyle = rgbString(themeMode === "light" ? palette.signalLine : palette.glow, segment.alpha);
        ctx.stroke();
      });
    }

    function renderStreamSceneRenderer(renderer, now, dtSeconds) {
      if (!renderer) {
        return;
      }

      resizeSceneRenderer(renderer);

      renderer.targetHeights.fill(0);
      renderer.targetSignal.fill(0);
      renderer.targetWake.fill(0);
      renderer.overlaySegments = [];

      const centerRow = (renderer.scene.rows - 1) * 0.5;
      const isSaveTimeKeyframe = renderer.motionProfile === "save-time-keyframe";
      const isGrowBalanceBars = renderer.motionProfile === "grow-balance-bars";
      const isOverseeScanLock = renderer.motionProfile === "oversee-scan-lock";

      if (reduceMotion) {
        if (isSaveTimeKeyframe || isGrowBalanceBars || isOverseeScanLock) {
          renderer.targetView = 0.05;
          if (isSaveTimeKeyframe) {
            applySaveTimeKeyframeProfile(renderer, now);
          } else if (isGrowBalanceBars) {
            applyGrowBalanceBarsProfile(renderer, now);
          } else {
            applyOverseeScanLockProfile(renderer, now);
          }
        } else {
          renderer.targetView = renderer.baseView;
          renderer.scene.cells.forEach((cell, index) => {
            const band = Math.max(0, 1 - Math.abs(cell.gy - centerRow) / 1.35);
            renderer.targetWake[index] = band * 0.12;
            renderer.targetSignal[index] = band * 0.24;
            renderer.targetHeights[index] = band * 0.52;
          });
        }
      } else if (isSaveTimeKeyframe) {
        const scrollTilt = renderer.scrollTiltOptions
          ? getDelayedExitScrollTilt(renderer.scrollElement, renderer.scrollTiltOptions)
          : getDelayedExitScrollTilt(renderer.scrollElement, VALUE_WIDE_GRID_SCROLL_TILT);
        renderer.targetView = mix(0.015, 0.34, scrollTilt);
        applySaveTimeKeyframeProfile(renderer, now);
      } else if (isGrowBalanceBars) {
        const scrollTilt = renderer.scrollTiltOptions
          ? getDelayedExitScrollTilt(renderer.scrollElement, renderer.scrollTiltOptions)
          : getDelayedExitScrollTilt(renderer.scrollElement, VALUE_WIDE_GRID_SCROLL_TILT);
        renderer.targetView = mix(0.015, 0.34, scrollTilt);
        applyGrowBalanceBarsProfile(renderer, now);
      } else if (isOverseeScanLock) {
        const scrollTilt = renderer.scrollTiltOptions
          ? getDelayedExitScrollTilt(renderer.scrollElement, renderer.scrollTiltOptions)
          : getDelayedExitScrollTilt(renderer.scrollElement, VALUE_WIDE_GRID_SCROLL_TILT);
        renderer.targetView = mix(0.015, 0.34, scrollTilt);
        applyOverseeScanLockProfile(renderer, now);
      } else {
        const scrollTilt = renderer.tiltMode === "exit"
          ? renderer.scrollTiltOptions
            ? getDelayedExitScrollTilt(renderer.scrollElement, renderer.scrollTiltOptions)
            : getExitScrollTilt(renderer.scrollElement)
          : getScrollTilt(renderer.scrollElement);
        renderer.targetView = renderer.tiltMode === "exit"
          ? mix(0, 0.54, scrollTilt)
          : mix(renderer.baseView * 0.72, Math.min(1, renderer.baseView + 0.22), scrollTilt);

        if (renderer.phase === "rest" && now - renderer.phaseStartedAt >= renderer.stream.restDurationMs) {
          startStreamCycle(renderer, now);
        } else if (renderer.phase === "active") {
          renderer.packets = renderer.packets.filter((packet) =>
            updateStreamPacket(renderer, packet, now, dtSeconds)
          );

          if (!renderer.packets.length) {
            renderer.phase = "rest";
            renderer.phaseStartedAt = now;
            renderer.cycleIndex += 1;
          }
        }

        renderer.packets.forEach((packet) => {
          if (packet.phase === "queued" && now < packet.wakeAt) {
            return;
          }

          const wakeDuration = Math.max(180, packet.moveAt - packet.wakeAt);
          const wakeProgress = clamp((now - packet.wakeAt) / wakeDuration, 0, 1);
          const wakeEnvelope = Math.sin(wakeProgress * Math.PI * 0.88);

          if (packet.phase === "wake") {
            const wakeStrength = packet.baseOpacity * (0.18 + wakeEnvelope * 0.74);
            accumulateStreamField(
              renderer.targetWake,
              renderer.scene.cols,
              renderer.scene.rows,
              packet.startX,
              packet.startY,
              renderer.stream.previewRadiusX,
              renderer.stream.previewRadiusY,
              wakeStrength
            );
            accumulateStreamField(
              renderer.targetHeights,
              renderer.scene.cols,
              renderer.scene.rows,
              packet.startX,
              packet.startY,
              renderer.stream.previewRadiusX,
              renderer.stream.previewRadiusY,
              wakeStrength * 0.62
            );
            return;
          }

          const motionWave = 0.88 + 0.12 * Math.sin(now * 0.0062 + packet.wavePhase + packet.x * 0.28);
          const signalStrength = packet.baseOpacity * (packet.phase === "stream" ? 1 : 0.74) * motionWave;
          const trailStrength = signalStrength * (packet.phase === "stream" ? 0.55 : 0.34);
          const previewStrength = packet.phase === "stream" ? 0.16 : 0.24;

          accumulateStreamField(
            renderer.targetSignal,
            renderer.scene.cols,
            renderer.scene.rows,
            packet.x,
            packet.y,
            renderer.stream.headRadiusX,
            renderer.stream.headRadiusY,
            signalStrength
          );
          accumulateStreamField(
            renderer.targetHeights,
            renderer.scene.cols,
            renderer.scene.rows,
            packet.x,
            packet.y,
            renderer.stream.headRadiusX,
            renderer.stream.headRadiusY,
            signalStrength * renderer.stream.headLift
          );

          accumulateStreamField(
            renderer.targetSignal,
            renderer.scene.cols,
            renderer.scene.rows,
            packet.x - 1.15,
            packet.y,
            renderer.stream.trailRadiusX,
            renderer.stream.trailRadiusY,
            trailStrength * 0.78
          );
          accumulateStreamField(
            renderer.targetHeights,
            renderer.scene.cols,
            renderer.scene.rows,
            packet.x - 1.15,
            packet.y,
            renderer.stream.trailRadiusX,
            renderer.stream.trailRadiusY,
            trailStrength * renderer.stream.trailLift
          );

          accumulateStreamField(
            renderer.targetWake,
            renderer.scene.cols,
            renderer.scene.rows,
            packet.x + 0.4,
            packet.y,
            renderer.stream.previewRadiusX,
            renderer.stream.previewRadiusY,
            previewStrength
          );
        });

        if (renderer.phase === "rest") {
          const restProgress = clamp(
            (now - renderer.phaseStartedAt) / Math.max(renderer.stream.restDurationMs, 1),
            0,
            1
          );
          const dormantBreath = 0.38 + 0.62 * Math.sin(restProgress * Math.PI);

          renderer.scene.cells.forEach((cell, index) => {
            const band = Math.max(0, 1 - Math.abs(cell.gy - centerRow) / 1.55);
            if (band <= 0) {
              return;
            }

            renderer.targetWake[index] = Math.max(
              renderer.targetWake[index],
              band * dormantBreath * 0.11
            );
            renderer.targetHeights[index] = Math.max(
              renderer.targetHeights[index],
              band * dormantBreath * 0.18
            );
          });
        }
      }

      renderer.view += (renderer.targetView - renderer.view) * (1 - Math.exp(-dtSeconds * 7.6));

      for (let index = 0; index < renderer.currentHeights.length; index += 1) {
        const heightDelta = renderer.targetHeights[index] - renderer.currentHeights[index];
        const signalDelta = renderer.targetSignal[index] - renderer.currentSignal[index];
        const wakeDelta = renderer.targetWake[index] - renderer.currentWake[index];
        const heightFollow = 1 - Math.exp(-dtSeconds * (heightDelta >= 0 ? 10.2 : 7.1));
        const toneFollow = 1 - Math.exp(-dtSeconds * ((signalDelta >= 0 || wakeDelta >= 0) ? 12.4 : 8.1));
        renderer.currentHeights[index] += heightDelta * heightFollow;
        renderer.currentSignal[index] += signalDelta * toneFollow;
        renderer.currentWake[index] += wakeDelta * toneFollow;
      }

      const themeMode = resolveStreamSceneTheme(renderer);
      const palette = STREAM_SCENE_PALETTES[themeMode];
      const layout = getSceneLayout(
        renderer.scene,
        renderer.currentHeights,
        renderer.view,
        renderer.width,
        renderer.height,
        renderer.layoutOptions
      );
      const visibleSides = renderer.view > 0.04;
      const orderedCells = renderer.scene.cells
        .slice()
        .sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx);
      const ctx = renderer.ctx;

      ctx.clearRect(0, 0, renderer.width, renderer.height);
      ctx.lineWidth = 0.85;
      ctx.lineJoin = "round";

      // Boost glow-to-ground blend for save-time so the accent reads in flat/top-down view.
      const glowGroundBlend = isSaveTimeKeyframe ? 0.26 : 0.08;

      const axisStart = projectScenePoint(0, centerRow + 0.5, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY);
      const axisEnd = projectScenePoint(
        renderer.scene.cols,
        centerRow + 0.5,
        0,
        layout.basis,
        layout.scale,
        layout.offsetX,
        layout.offsetY
      );
      ctx.beginPath();
      ctx.moveTo(axisStart.x, axisStart.y);
      ctx.lineTo(axisEnd.x, axisEnd.y);
      ctx.strokeStyle = rgbString(palette.glow, themeMode === "dark" ? 0.12 : 0.16);
      ctx.stroke();

      drawStreamOverlays(renderer, layout, palette, themeMode);

      orderedCells.forEach((cell) => {
        const index = cell.gy * renderer.scene.cols + cell.gx;
        const heightValue = renderer.currentHeights[index];
        const signalAmount = clamp(renderer.currentSignal[index], 0, 1);
        const wakeAmount = clamp(renderer.currentWake[index], 0, 1);
        const groundMix = clamp(heightValue * 0.18 + wakeAmount * 0.42 + signalAmount * 0.56, 0, 1);
        const groundFill = mixRgb(
          mixRgb(palette.groundEmpty, palette.groundOccupied, groundMix),
          palette.glow,
          signalAmount * glowGroundBlend
        );
        const groundPoints = [
          projectScenePoint(cell.gx, cell.gy, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy + 1, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx, cell.gy + 1, 0, layout.basis, layout.scale, layout.offsetX, layout.offsetY)
        ];

        drawSceneFace(ctx, groundPoints, groundFill, palette.groundLine, palette.groundAlpha);

        if (heightValue <= 0.02) {
          return;
        }

        const faces = getStreamToneFaces(palette, signalAmount, wakeAmount);
        const topPoints = [
          projectScenePoint(cell.gx, cell.gy, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx + 1, cell.gy + 1, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY),
          projectScenePoint(cell.gx, cell.gy + 1, heightValue, layout.basis, layout.scale, layout.offsetX, layout.offsetY)
        ];

        if (visibleSides) {
          drawSceneFace(
            ctx,
            [groundPoints[3], groundPoints[2], topPoints[2], topPoints[3]],
            faces.left,
            faces.line,
            0.84
          );
          drawSceneFace(
            ctx,
            [groundPoints[1], groundPoints[2], topPoints[2], topPoints[1]],
            faces.right,
            faces.line,
            0.84
          );
        }

        drawSceneFace(ctx, topPoints, faces.top, faces.line, 0.84);

        if (signalAmount > 0.03) {
          ctx.beginPath();
          ctx.moveTo(topPoints[0].x, topPoints[0].y);
          for (let pointIndex = 1; pointIndex < topPoints.length; pointIndex += 1) {
            ctx.lineTo(topPoints[pointIndex].x, topPoints[pointIndex].y);
          }
          ctx.closePath();
          ctx.fillStyle = rgbString(palette.glow, 0.03 + signalAmount * 0.08);
          ctx.fill();
        }
      });
    }

  // Public foundation API consumed by the feature modules and homepage bootstrap.
  Object.assign(homepage, {
    reduceMotion,
    readCssPixelVariable,
    clamp,
    mix,
    smoothstep,
    easeOutCubic,
    easeInCubic,
    mixRgb,
    rgbString,
    pseudoRandom,
    SCENE_PALETTES,
    STREAM_SCENE_PALETTES,
    VALUE_WIDE_GRID_LAYOUT,
    VALUE_WIDE_GRID_SCROLL_TILT,
    SCENE_LIBRARY,
    aboutRouteScene,
    createScene,
    resolveSceneAssetPayload,
    createSceneFromAsset,
    buildPlatformScenes,
    createSceneRenderer,
    resizeSceneRenderer,
    renderSceneRenderer,
    createStreamSceneRenderer,
    renderStreamSceneRenderer
  });
})();
