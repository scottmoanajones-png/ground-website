(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const {
    reduceMotion,
    clamp,
    mix,
    smoothstep,
    easeOutCubic,
    easeInCubic,
    mixRgb,
    rgbString,
    renderValueRenderer,
    renderSceneRenderer,
    resizeSceneRenderer
  } = homepage;
  const getAboutSceneRenderers = () => (homepage.getAboutSceneRenderers ? homepage.getAboutSceneRenderers() : []);
  const getPlatformRenderer = () => (homepage.getPlatformRenderer ? homepage.getPlatformRenderer() : null);

  function wipeEase(t) {
    const clamped = clamp(t, 0, 1);
    const snap = 1 - Math.pow(1 - clamped, 4);
    return mix(clamped, snap, 0.72);
  }

  function lerpPoint(point, destination, amount) {
    point.x += (destination.x - point.x) * amount;
    point.y += (destination.y - point.y) * amount;
  }

  function initHeroGrid() {
    if (initHeroGrid.started) return;
    initHeroGrid.started = true;

    const heroCopy = document.querySelector(".hero-copy");

    const heroSection = document.querySelector(".hero");
    const heroCanvas = document.getElementById("heroGrid");
    const heroContext = heroCanvas.getContext("2d");

    const heroConfig = {
      cellSize: 30,
      hoverRadius: 0,
      hoverRadiusCells: 6.8,
      signalInterval: 2.2,
      signalSpeed: 0.16,
      signalWidth: 0.026,
      pathTrail: 1.85,
      pathSpeed: 19,
      pathFade: 0.54,
      logoLoopInterval: 1.65,
      logoLoopMinSteps: 20,
      logoLoopMaxSteps: 30,
      logoLoopSpeed: 4.8,
      logoLoopFadeDuration: 1.08,
      logoLoopWaveSpan: 4.6,
      logoLoopHeadWidth: 1.85,
      logoLoopPeakLift: 0.5,
      logoLoopTurnChance: 0.72,
      logoLoopMaxTurns: 2,
      logoLoopMinSegment: 5,
      logoIntroDelay: 0.22,
      logoRiseDuration: 0.96,
      logoSecondCubeDelay: 0.28,
      logoUpperRevealThreshold: 0.18,
      logoStagger: 0.03,
      cubeHeightRatio: 1.04,
      logoAnchorX: 0.44,
      logoEdgeOffset: 0.024,
      splitOriginX: 0.26,
      splitPixelSlope: 0.5,
      splitStartY: -0.225,
      splitSlope: 0.86,
      splitFeather: 0.012
    };

    const PALETTE = {
      dark: {
        fillLight: [48, 72, 64],
        fillDark: [28, 44, 39],
        line: [95, 128, 114],
        cubeTop: [227, 237, 232],
        cubeLeft: [207, 219, 213],
        cubeRight: [188, 202, 196],
        cubeLine: [164, 181, 174],
        cubeShadow: [16, 24, 21, 0.18]
      },
      light: {
        fillLight: [244, 242, 237],
        fillDark: [233, 230, 224],
        line: [183, 188, 181],
        cubeTop: [237, 244, 241],
        cubeLeft: [215, 225, 221],
        cubeRight: [194, 206, 201],
        cubeLine: [177, 189, 184],
        cubeShadow: [141, 151, 147, 0.14]
      },
      signal: [46, 168, 102]
    };

    const LOGO_CUBE_PALETTE = {
      top: [242, 249, 247],
      left: [218, 227, 225],
      right: [181, 195, 192]
    };

    let heroWidth = 0;
    let heroHeight = 0;
    let hoverRadiusSq = 0;
    let cells = [];
    let cellLookup = new Map();
    let logoCells = [];
    let logoLoopSources = [];
    let signals = [];
    let signalTimer = 0;
    let pathSignals = [];
    let logoLoopSignals = [];
    let activeCells = new Map();
    let lastActivatedCell = null;
    let lastHoveredCellKey = null;
    let lastHoverActivationAt = 0;
    let lastFrameTime = performance.now();
    const logoAnimationStart = performance.now();
    let nextLogoLoopAt = logoAnimationStart + 1400;
    let heroAutoNudgeAt = Infinity;
    let heroAutoNudgeHandled = reduceMotion;
    let heroAutoNudgeAnimationFrame = null;
    let pointer = { x: -1000, y: -1000 };
    let target = { x: -1000, y: -1000 };
    let logoPinCells = [];
    let darkCapturePool = [];
    let nextCaptureAt = 0;

    function animateScrollTo(targetY, duration) {
      if (heroAutoNudgeAnimationFrame) {
        cancelAnimationFrame(heroAutoNudgeAnimationFrame);
        heroAutoNudgeAnimationFrame = null;
      }

      const startY = window.scrollY;
      const distance = targetY - startY;
      const startedAt = performance.now();

      function step(now) {
        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = easeOutCubic(progress);
        window.scrollTo(0, startY + distance * eased);

        if (progress < 1) {
          heroAutoNudgeAnimationFrame = requestAnimationFrame(step);
        } else {
          heroAutoNudgeAnimationFrame = null;
        }
      }

      heroAutoNudgeAnimationFrame = requestAnimationFrame(step);
    }

    function isoToScreen(x, y) {
      return {
        x: (x - y) * heroConfig.cellSize + heroWidth / 2,
        y: (x + y) * heroConfig.cellSize * 0.5 + heroHeight / 2
      };
    }

    function screenToIso(px, py) {
      const sx = (px - heroWidth / 2) / heroConfig.cellSize;
      const sy = (py - heroHeight / 2) / (heroConfig.cellSize * 0.5);

      return {
        x: Math.round((sy + sx) * 0.5),
        y: Math.round((sy - sx) * 0.5)
      };
    }

    function buildPathBetween(start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      const path = [];
      const seen = new Set();

      if (steps === 0) {
        return [{ x: start.x, y: start.y, key: start.key }];
      }

      for (let index = 0; index <= steps; index += 1) {
        const progress = index / steps;
        const x = Math.round(start.x + dx * progress);
        const y = Math.round(start.y + dy * progress);
        const key = `${x}-${y}`;

        if (!seen.has(key)) {
          seen.add(key);
          path.push({ x, y, key });
        }
      }

      return path;
    }

    function createPathSignal(start, end) {
      const signalCells = buildPathBetween(start, end);
      const indexByKey = new Map();
      signalCells.forEach((cell, index) => indexByKey.set(cell.key, index));

      return {
        startedAt: performance.now(),
        cells: signalCells,
        indexByKey,
        travelDuration: Math.max(0.72, signalCells.length / heroConfig.pathSpeed),
        fadeDuration: heroConfig.pathFade
      };
    }

    function createCaptureSignal(start, end) {
      const signalCells = buildPathBetween(start, end);
      const indexByKey = new Map();
      signalCells.forEach((cell, index) => indexByKey.set(cell.key, index));

      return {
        startedAt: performance.now(),
        cells: signalCells,
        indexByKey,
        travelDuration: Math.max(2.2, signalCells.length / 7),
        fadeDuration: heroConfig.pathFade
      };
    }

    function createLogoLoopSignal(path, now) {
      const indexByKey = new Map();
      path.forEach((cell, index) => indexByKey.set(cell.key, index));
      const entryOffset = Math.max(0.5, heroConfig.logoLoopWaveSpan - 0.35);

      return {
        startedAt: now,
        cells: path,
        indexByKey,
        entryOffset,
        travelDuration: Math.max(0.96, (path.length + entryOffset) / heroConfig.logoLoopSpeed),
        fadeDuration: heroConfig.logoLoopFadeDuration
      };
    }

    function splitLogoLoopMoves(totalMoves, segmentCount) {
      const minSegment = heroConfig.logoLoopMinSegment;
      if (totalMoves < segmentCount * minSegment) {
        return null;
      }

      const lengths = new Array(segmentCount).fill(minSegment);
      let remaining = totalMoves - segmentCount * minSegment;

      while (remaining > 0) {
        const index = Math.floor(Math.random() * segmentCount);
        lengths[index] += 1;
        remaining -= 1;
      }

      return lengths;
    }

    function buildLogoLoopPath(source, desiredSteps) {
      const startCell = cellLookup.get(source.key);
      if (!startCell || surfaceBlend(startCell) <= 0.72) {
        return [];
      }

      const totalMoves = Math.max(0, desiredSteps - 1);
      const shouldTurn = Math.random() < heroConfig.logoLoopTurnChance;
      const turnCount = shouldTurn ? 1 + Math.floor(Math.random() * heroConfig.logoLoopMaxTurns) : 0;
      const segmentLengths = splitLogoLoopMoves(totalMoves, turnCount + 1);

      if (!segmentLengths) {
        return [];
      }

      const directions = [
        { dx: 0, dy: 1 },
        { dx: 1, dy: 0 }
      ];
      const path = [startCell];
      const seen = new Set([startCell.key]);
      let current = startCell;
      let directionIndex = 0;

      for (const segmentLength of segmentLengths) {
        const direction = directions[directionIndex];

        for (let step = 0; step < segmentLength; step += 1) {
          const nextKey = `${current.x + direction.dx}-${current.y + direction.dy}`;
          const nextCell = cellLookup.get(nextKey);

          if (!nextCell || surfaceBlend(nextCell) <= 0.72 || seen.has(nextKey)) {
            return [];
          }

          path.push(nextCell);
          seen.add(nextKey);
          current = nextCell;
        }

        directionIndex = 1 - directionIndex;
      }

      return path;
    }

    function surfaceBlend(cell) {
      const xNorm = cell.screenX / Math.max(heroWidth, 1);
      const yNorm = cell.screenY / Math.max(heroHeight, 1);
      const splitY = heroConfig.splitStartY + xNorm * heroConfig.splitSlope;
      return smoothstep(
        splitY - heroConfig.splitFeather,
        splitY + heroConfig.splitFeather,
        yNorm
      );
    }

    function getSurfaceFill(cell, intensity) {
      const splitBlend = surfaceBlend(cell);
      const darkBase = mixRgb(PALETTE.dark.fillDark, PALETTE.dark.fillLight, intensity);
      const lightBase = mixRgb(PALETTE.light.fillDark, PALETTE.light.fillLight, intensity);
      return mixRgb(darkBase, lightBase, splitBlend);
    }

    function getSurfaceLine(cell, intensity) {
      const splitBlend = surfaceBlend(cell);
      const darkLine = mixRgb(PALETTE.dark.line, PALETTE.signal, intensity * 0.45);
      const lightLine = mixRgb(PALETTE.light.line, PALETTE.signal, intensity * 0.24);
      return mixRgb(darkLine, lightLine, splitBlend);
    }

    function getCellBase(cell, pointerInfluence) {
      const hovered = Math.floor(pointerInfluence * 8) / 8;
      const base = clamp(0.16 + hovered * 0.6 + cell.variance * 0.028, 0, 1);
      return base;
    }

    function drawDiamond(cx, cy, size, fillColor, lineColor, lineAlpha) {
      heroContext.beginPath();
      heroContext.moveTo(cx, cy - size * 0.5);
      heroContext.lineTo(cx + size, cy);
      heroContext.lineTo(cx, cy + size * 0.5);
      heroContext.lineTo(cx - size, cy);
      heroContext.closePath();
      heroContext.fillStyle = rgbString(fillColor, 1);
      heroContext.fill();
      heroContext.strokeStyle = rgbString(lineColor, lineAlpha);
      heroContext.lineWidth = 1;
      heroContext.stroke();
    }

    function rebuildLogoCells() {
      const anchorY =
        heroConfig.splitStartY +
        heroConfig.logoAnchorX * heroConfig.splitSlope +
        heroConfig.logoEdgeOffset;

      const topStart = screenToIso(heroWidth * heroConfig.logoAnchorX, heroHeight * anchorY);

      const blueprint = [
        {
          length: 12,
          height: 2,
          start: topStart
        },
        {
          length: 8,
          height: 2,
          start: {
            x: topStart.x + 2,
            y: topStart.y + 4
          }
        },
        {
          length: 4,
          height: 2,
          start: {
            x: topStart.x + 4,
            y: topStart.y + 8
          }
        }
      ];

      const nextLogoCells = [];
      let order = 0;

      blueprint.forEach((row, rowIndex) => {
        for (let depth = 0; depth < row.height; depth += 1) {
          for (let index = 0; index < row.length; index += 1) {
            const x = row.start.x + index;
            const y = row.start.y + depth;
            const key = `${x}-${y}`;
            const baseCell = cellLookup.get(key);

            if (!baseCell) {
              continue;
            }

            nextLogoCells.push({
              ...baseCell,
              order,
              reverseOrder: 0,
              rowIndex,
              indexInRow: index,
              depth
            });
            order += 1;
          }
        }
      });

      const total = nextLogoCells.length;
      logoCells = nextLogoCells.map((cell, index) => ({
        ...cell,
        reverseOrder: total - index - 1
      }));

      // Build grounding pin: 2-cell-wide vertical column above logo top center
      const pinLength = 5;
      const pinCenterX = Math.round(topStart.x) + 3;
      const pinBaseY = Math.round(topStart.y);
      const nextPinCells = [];
      for (let k = 1; k <= pinLength; k += 1) {
        for (let w = 0; w < 2; w += 1) {
          const px = pinCenterX + w;
          const py = pinBaseY - k;
          const pinCell = cellLookup.get(`${px}-${py}`);
          if (pinCell) {
            nextPinCells.push({ ...pinCell, pinStep: k });
          }
        }
      }
      logoPinCells = nextPinCells;

      const lowestLogoY = logoCells.reduce((maxY, cell) => Math.max(maxY, cell.y), -Infinity);
      logoLoopSources = logoCells
        .filter((cell) => cell.y === lowestLogoY)
        .filter((cell) => {
          const sourceCell = cellLookup.get(cell.key);
          return sourceCell && surfaceBlend(sourceCell) > 0.72;
        })
        .sort((a, b) => a.screenX - b.screenX || a.screenY - b.screenY);

      if (!heroAutoNudgeHandled && logoCells.length) {
        const finalOrder = logoCells.reduce((maxOrder, cell) => Math.max(maxOrder, cell.order), 0);
        const introDurationMs =
          (heroConfig.logoIntroDelay + finalOrder * heroConfig.logoStagger + heroConfig.logoRiseDuration) * 1000;
        heroAutoNudgeAt = logoAnimationStart + introDurationMs + 300;
      }
    }

    function maybeAutoNudgeHero(now) {
      if (heroAutoNudgeHandled || !heroCopy) {
        return;
      }

      if (heroCopy.classList.contains("is-visible") || window.scrollY > 8) {
        heroAutoNudgeHandled = true;
        return;
      }

      if (now < heroAutoNudgeAt) {
        return;
      }

      heroAutoNudgeHandled = true;
      animateScrollTo(
        Math.min(240, Math.round(heroSection.getBoundingClientRect().height * 0.19)),
        3000
      );
    }

    function rebuildGrid() {
      const rect = heroSection.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      heroWidth = Math.max(1, Math.round(rect.width));
      heroHeight = Math.max(1, Math.round(rect.height));
      heroConfig.splitSlope = heroConfig.splitPixelSlope * heroWidth / heroHeight;
      heroConfig.splitStartY = -heroConfig.splitSlope * heroConfig.splitOriginX;
      heroConfig.cellSize = clamp(Math.round(Math.min(heroWidth, heroHeight) * 0.0315), 18, 32);
      heroConfig.hoverRadius = heroConfig.cellSize * heroConfig.hoverRadiusCells;
      hoverRadiusSq = heroConfig.hoverRadius * heroConfig.hoverRadius;

      const splitRightY = clamp((heroConfig.splitStartY + heroConfig.splitSlope) * 100, 0, 100);
      heroSection.style.setProperty("--split-origin-x", `${heroConfig.splitOriginX * 100}%`);
      heroSection.style.setProperty("--split-right-y", `${splitRightY}%`);

      heroCanvas.width = Math.round(heroWidth * dpr);
      heroCanvas.height = Math.round(heroHeight * dpr);
      heroCanvas.style.width = `${heroWidth}px`;
      heroCanvas.style.height = `${heroHeight}px`;
      heroContext.setTransform(dpr, 0, 0, dpr, 0, 0);

      const range = Math.ceil((heroWidth + heroHeight) / heroConfig.cellSize / 2) + 10;
      const corners = [
        isoToScreen(-range, -range),
        isoToScreen(range, -range),
        isoToScreen(-range, range),
        isoToScreen(range, range)
      ];

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      corners.forEach((corner) => {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      });

      const spanX = maxX - minX;
      const spanY = maxY - minY;

      cells = [];
      cellLookup = new Map();
      for (let y = -range; y <= range; y += 1) {
        for (let x = -range; x <= range; x += 1) {
          const screen = isoToScreen(x, y);
          const nx = (screen.x - minX) / spanX;
          const ny = (screen.y - minY) / spanY;

          const cell = {
            x,
            y,
            screenX: screen.x,
            screenY: screen.y,
            diag: (nx + ny) * 0.5,
            variance: (((x * 13 + y * 29) % 9) - 4) * 0.2,
            key: `${x}-${y}`
          };

          cells.push(cell);
          cellLookup.set(cell.key, cell);
        }
      }

      rebuildLogoCells();
      darkCapturePool = cells.filter((c) => surfaceBlend(c) < 0.12);
      nextCaptureAt = performance.now() + 2000;
    }

    function getLogoElapsed(now) {
      return Math.max(0, (now - logoAnimationStart) / 1000);
    }

    function getLogoCellLift(cell, elapsed) {
      const local = clamp(
        (elapsed - heroConfig.logoIntroDelay - cell.order * heroConfig.logoStagger) / heroConfig.logoRiseDuration,
        0,
        1
      );
      return easeOutCubic(local);
    }

    function getLogoCellPreview(cell, elapsed) {
      const preOffset = 0.14;
      const preview = getLogoCellLift(cell, Math.max(0, elapsed + preOffset));
      return clamp(preview * 0.74, 0, 1);
    }

    function spawnLogoLoop(now) {
      if (!logoLoopSources.length) {
        return;
      }

      const candidatePaths = [];

      logoLoopSources.forEach((source) => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const desiredSteps =
            heroConfig.logoLoopMinSteps +
            Math.floor(Math.random() * (heroConfig.logoLoopMaxSteps - heroConfig.logoLoopMinSteps + 1));
          const path = buildLogoLoopPath(source, desiredSteps);

          if (path.length >= heroConfig.logoLoopMinSteps) {
            candidatePaths.push(path);
          }
        }
      });

      if (!candidatePaths.length) {
        return;
      }

      const path = candidatePaths[Math.floor(Math.random() * candidatePaths.length)];
      logoLoopSignals.push(createLogoLoopSignal(path, now));
    }

    function getLogoLoopState(now) {
      const overlayByKey = new Map();
      const headCubes = [];

      for (const loopSignal of logoLoopSignals) {
        const lastIndex = Math.max(loopSignal.cells.length - 1, 1);
        const elapsed = (now - loopSignal.startedAt) / 1000;
        const routeProgress = smoothstep(0, 1, clamp(elapsed / loopSignal.travelDuration, 0, 1));
        const fade =
          elapsed <= loopSignal.travelDuration
            ? 1
            : 1 - (elapsed - loopSignal.travelDuration) / loopSignal.fadeDuration;

        if (fade <= 0) {
          continue;
        }

        const head = mix(-loopSignal.entryOffset, lastIndex, routeProgress);

        loopSignal.cells.forEach((cell, index) => {
          const distance = Math.abs(index - head);
          const trail = clamp(1 - distance / heroConfig.logoLoopWaveSpan, 0, 1) * fade;
          const entry = overlayByKey.get(cell.key) || { trail: 0, line: 0 };
          entry.trail = Math.max(entry.trail, trail);
          entry.line = Math.max(entry.line, trail * 0.84);
          overlayByKey.set(cell.key, entry);

          const headLift =
            smoothstep(0, 1, clamp(1 - distance / heroConfig.logoLoopHeadWidth, 0, 1)) * fade;
          if (headLift > 0.001) {
            headCubes.push({ cell, lift: easeOutCubic(headLift) });
          }
        });
      }

      return { overlayByKey, headCubes };
    }

    function drawCube(cell, lift, baseFill, splitBlend, stackOffset = 0, shadowFactor = 1, faceOverride = null) {
      if (lift <= 0.001) {
        return;
      }

      const finalTop = faceOverride
        ? faceOverride.top
        : mixRgb(PALETTE.dark.cubeTop, PALETTE.light.cubeTop, splitBlend);
      const finalLeft = faceOverride
        ? faceOverride.left
        : mixRgb(PALETTE.dark.cubeLeft, PALETTE.light.cubeLeft, splitBlend);
      const finalRight = faceOverride
        ? faceOverride.right
        : mixRgb(PALETTE.dark.cubeRight, PALETTE.light.cubeRight, splitBlend);
      const finalLine = mixRgb(PALETTE.dark.cubeLine, PALETTE.light.cubeLine, splitBlend);
      const shadowBase = mixRgb(PALETTE.dark.cubeShadow, PALETTE.light.cubeShadow, splitBlend);
      const shadowAlpha = mix(PALETTE.dark.cubeShadow[3], PALETTE.light.cubeShadow[3], splitBlend);

      const faceSeparation = smoothstep(0.02, 0.96, lift);
      const cubeTop = mixRgb(baseFill, finalTop, faceSeparation);
      const cubeLeft = mixRgb(baseFill, finalLeft, faceSeparation * 0.92);
      const cubeRight = mixRgb(baseFill, finalRight, faceSeparation * 0.94);
      const cubeLine = mixRgb(baseFill, finalLine, faceSeparation);
      const glow = smoothstep(0.3, 1, lift);

      const size = heroConfig.cellSize;
      const stackRise = size * heroConfig.cubeHeightRatio * stackOffset;
      const rise = size * heroConfig.cubeHeightRatio * lift + stackRise;
      const cx = cell.screenX;
      const cy = cell.screenY;
      const topY = cy - rise;
      const lineWidth = Math.max(1, size * 0.022);
      const contactShadowFade = smoothstep(0.42, 0.78, splitBlend);
      const contactShadowAlpha = shadowAlpha * lift * shadowFactor * contactShadowFade * 0.68;

      if (contactShadowAlpha > 0.008) {
        const contactSpread = size * 0.62;
        const contactOffsetY = size * (0.04 + lift * 0.03);

        heroContext.beginPath();
        heroContext.moveTo(cx, cy - size * 0.14 + contactOffsetY);
        heroContext.lineTo(cx + contactSpread, cy + size * 0.08 + contactOffsetY);
        heroContext.lineTo(cx, cy + size * 0.3 + contactOffsetY);
        heroContext.lineTo(cx - contactSpread, cy + size * 0.08 + contactOffsetY);
        heroContext.closePath();
        heroContext.fillStyle = rgbString(shadowBase, contactShadowAlpha);
        heroContext.fill();
      }

      heroContext.lineWidth = lineWidth;
      heroContext.strokeStyle = rgbString(cubeLine, 0.84);
      heroContext.lineJoin = "round";
      heroContext.lineCap = "round";

      heroContext.beginPath();
      heroContext.moveTo(cx - size, topY);
      heroContext.lineTo(cx, topY + size * 0.5);
      heroContext.lineTo(cx, cy + size * 0.5);
      heroContext.lineTo(cx - size, cy);
      heroContext.closePath();
      heroContext.fillStyle = rgbString(cubeLeft, 1);
      heroContext.fill();
      heroContext.stroke();

      heroContext.beginPath();
      heroContext.moveTo(cx, topY + size * 0.5);
      heroContext.lineTo(cx + size, topY);
      heroContext.lineTo(cx + size, cy);
      heroContext.lineTo(cx, cy + size * 0.5);
      heroContext.closePath();
      heroContext.fillStyle = rgbString(cubeRight, 1);
      heroContext.fill();
      heroContext.stroke();

      heroContext.beginPath();
      heroContext.moveTo(cx, topY - size * 0.5);
      heroContext.lineTo(cx + size, topY);
      heroContext.lineTo(cx, topY + size * 0.5);
      heroContext.lineTo(cx - size, topY);
      heroContext.closePath();
      heroContext.fillStyle = rgbString(cubeTop, 1);
      heroContext.fill();
      heroContext.stroke();

      if (glow > 0.04) {
        heroContext.beginPath();
        heroContext.moveTo(cx, topY - size * 0.5);
        heroContext.lineTo(cx + size, topY);
        heroContext.lineTo(cx, topY + size * 0.5);
        heroContext.lineTo(cx - size, topY);
        heroContext.closePath();
        heroContext.fillStyle = rgbString(PALETTE.signal, 0.05 + glow * 0.06);
        heroContext.fill();
      }
    }

    function drawCubeColumn(cell, lift, baseFill, splitBlend, faceOverride = null) {
      const lowerLift = clamp(lift * 1.45, 0, 1);
      const upperLift = clamp(
        (lift - heroConfig.logoSecondCubeDelay) / (1 - heroConfig.logoSecondCubeDelay),
        0,
        1
      );

      if (lowerLift > 0.001) {
        drawCube(cell, lowerLift, baseFill, splitBlend, 0, 1, faceOverride);
      }

      if (upperLift > heroConfig.logoUpperRevealThreshold) {
        const upperDrawLift = smoothstep(heroConfig.logoUpperRevealThreshold, 1, upperLift);
        drawCube(cell, upperDrawLift, baseFill, splitBlend, 1, 0.72, faceOverride);
      }
    }

    function drawGrid(now, dtSeconds) {
      if (now >= nextLogoLoopAt) {
        spawnLogoLoop(now);
        nextLogoLoopAt =
          now + (heroConfig.logoLoopInterval + Math.random() * 0.6) * 1000;
      }

      if (heroConfig.signalInterval > 0) {
        signalTimer += dtSeconds;
        if (signalTimer >= heroConfig.signalInterval) {
          signalTimer = 0;
          signals.push({ t: -0.08 });
        }
      }

      signals = signals
        .map((signal) => ({ t: signal.t + dtSeconds * heroConfig.signalSpeed }))
        .filter((signal) => signal.t < 1.12);

      pathSignals = pathSignals.filter((pathSignal) => {
        const elapsed = (now - pathSignal.startedAt) / 1000;
        return elapsed < pathSignal.travelDuration + pathSignal.fadeDuration;
      });

      logoLoopSignals = logoLoopSignals.filter((loopSignal) => {
        const elapsed = (now - loopSignal.startedAt) / 1000;
        return elapsed < loopSignal.travelDuration + loopSignal.fadeDuration;
      });

      // Converging capture signals: dark-area cells flowing toward the logo
      if (now >= nextCaptureAt && darkCapturePool.length > 0 && logoCells.length > 0) {
        const spawnCount = 2 + Math.floor(Math.random() * 2);
        for (let ci = 0; ci < spawnCount; ci += 1) {
          const source = darkCapturePool[Math.floor(Math.random() * darkCapturePool.length)];
          const target = logoCells[Math.floor(Math.random() * Math.min(16, logoCells.length))];
          pathSignals.push(createCaptureSignal(source, target));
        }
        nextCaptureAt = now + 400 + Math.random() * 500;
      }

      const cycleElapsed = getLogoElapsed(now);
      const logoState = new Map();
      logoCells.forEach((cell) => {
        logoState.set(cell.key, {
          lift: getLogoCellLift(cell, cycleElapsed),
          preview: getLogoCellPreview(cell, cycleElapsed)
        });
      });

      const logoLoopState = getLogoLoopState(now);

      for (const cell of cells) {
        const dx = cell.screenX - pointer.x;
        const dy = cell.screenY - pointer.y;
        const distSq = dx * dx + dy * dy;
        const pointerInfluence = clamp(1 - distSq / hoverRadiusSq, 0, 1);

        let intensity = getCellBase(cell, pointerInfluence);
        let lineBoost = pointerInfluence * 0.12;

        if (activeCells.has(cell.key)) {
          const life = activeCells.get(cell.key);
          intensity += life * 0.22;
          const nextLife = Math.max(0, life - dtSeconds * 1.5);
          if (nextLife <= 0.02) {
            activeCells.delete(cell.key);
          } else {
            activeCells.set(cell.key, nextLife);
          }
        }

        for (const signal of signals) {
          const wave = Math.abs(cell.diag - signal.t);
          if (wave < heroConfig.signalWidth) {
            const local = 1 - wave / heroConfig.signalWidth;
            intensity += local * 0.12;
            lineBoost += local * 0.16;
          }
        }

        for (const pathSignal of pathSignals) {
          if (!pathSignal.indexByKey.has(cell.key)) {
            continue;
          }

          const index = pathSignal.indexByKey.get(cell.key);
          const lastIndex = Math.max(pathSignal.cells.length - 1, 1);
          const elapsed = (now - pathSignal.startedAt) / 1000;
          const routeProgress = clamp(elapsed / pathSignal.travelDuration, 0, 1);
          const fade =
            elapsed <= pathSignal.travelDuration
              ? 1
              : 1 - (elapsed - pathSignal.travelDuration) / pathSignal.fadeDuration;
          const head = routeProgress * lastIndex;
          const trail = clamp(1 - Math.abs(index - head) / heroConfig.pathTrail, 0, 1);

          intensity += trail * 0.22 * fade;
          lineBoost += trail * 0.3 * fade;
        }

        const logoMotion = logoState.get(cell.key);
        const preview = logoMotion ? logoMotion.preview : 0;
        const loopOverlay = logoLoopState.overlayByKey.get(cell.key);
        const splitBlend = surfaceBlend(cell);
        let fillColor = getSurfaceFill(cell, intensity);
        let lineColor = getSurfaceLine(cell, intensity + lineBoost);
        let lineAlpha = 0.18 + pointerInfluence * 0.16 + lineBoost * 0.22;

        if (loopOverlay) {
          const loopFill = mixRgb(fillColor, [184, 222, 188], loopOverlay.trail * 0.92);
          fillColor = loopFill;
          lineColor = mixRgb(lineColor, PALETTE.signal, loopOverlay.line * 0.72);
          lineAlpha += loopOverlay.line * 0.2;
        }

        if (preview > 0.001) {
          const preTint = mixRgb(fillColor, mixRgb(PALETTE.dark.cubeTop, PALETTE.light.cubeTop, splitBlend), preview * 0.82);
          fillColor = preTint;
          lineColor = mixRgb(lineColor, PALETTE.signal, preview * 0.28);
          lineAlpha += preview * 0.18;
        }

        drawDiamond(
          cell.screenX,
          cell.screenY,
          heroConfig.cellSize,
          fillColor,
          lineColor,
          clamp(lineAlpha, 0.12, 0.58)
        );
      }

      // Grounding pin — animates on after first logo row, subtle living glow
      if (logoPinCells.length > 0) {
        const pinElapsed = getLogoElapsed(now);
        const firstRowMaxOrder = logoCells.reduce(
          (max, c) => (c.rowIndex === 0 ? Math.max(max, c.order) : max),
          0
        );
        const pinRevealStart =
          heroConfig.logoIntroDelay +
          firstRowMaxOrder * heroConfig.logoStagger +
          heroConfig.logoRiseDuration;
        const pinT = now * 0.001;
        logoPinCells.forEach((cell) => {
          const stepRevealAt = pinRevealStart + (cell.pinStep - 1) * 0.18;
          const revealFade = easeOutCubic(clamp((pinElapsed - stepRevealAt) / 0.5, 0, 1));
          if (revealFade < 0.005) return;
          const t = 1 - (cell.pinStep - 1) / 5;
          const wave = 0.45 + 0.55 * Math.sin(pinT * 1.8 + cell.pinStep * 0.6);
          const alpha = revealFade * t * (0.09 + wave * 0.13) * 1.35;
          if (alpha < 0.005) return;
          heroContext.beginPath();
          heroContext.moveTo(cell.screenX, cell.screenY - heroConfig.cellSize * 0.5);
          heroContext.lineTo(cell.screenX + heroConfig.cellSize, cell.screenY);
          heroContext.lineTo(cell.screenX, cell.screenY + heroConfig.cellSize * 0.5);
          heroContext.lineTo(cell.screenX - heroConfig.cellSize, cell.screenY);
          heroContext.closePath();
          heroContext.fillStyle = rgbString(PALETTE.signal, alpha);
          heroContext.fill();
        });
      }

      const activeLogoCells = logoCells
        .map((cell) => ({
          ...cell,
          lift: logoState.get(cell.key).lift
        }))
        .filter((cell) => cell.lift > 0.001)
        .sort((a, b) => a.screenY - b.screenY || a.screenX - b.screenX);

      activeLogoCells.forEach((cell) => {
        const intensity = getCellBase(cell, 0.4);
        const splitBlend = surfaceBlend(cell);
        drawCubeColumn(cell, cell.lift, getSurfaceFill(cell, intensity), splitBlend, LOGO_CUBE_PALETTE);
      });

      const activeLoopCubes = logoLoopState.headCubes
        .filter(({ cell }) => !logoState.has(cell.key))
        .sort((a, b) => a.cell.screenY - b.cell.screenY || a.cell.screenX - b.cell.screenX);

      activeLoopCubes.forEach(({ cell, lift }) => {
        const splitBlend = surfaceBlend(cell);
        const baseFill = mixRgb(getSurfaceFill(cell, 0.24), [184, 222, 188], 0.82);
        drawCube(cell, lift * heroConfig.logoLoopPeakLift, baseFill, splitBlend, 0, 0.42);
      });
    }

    function frame(now) {
      const dtSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      heroContext.clearRect(0, 0, heroWidth, heroHeight);
      const followAmount = 1 - Math.exp(-dtSeconds * 7.2);
      lerpPoint(pointer, target, followAmount);
      drawGrid(now, dtSeconds);
      getAboutSceneRenderers().forEach((renderer) => renderValueRenderer(renderer, now, dtSeconds));
      const platformRenderer = getPlatformRenderer();
      if (platformRenderer) renderSceneRenderer(platformRenderer, now);
      maybeAutoNudgeHero(now);
      requestAnimationFrame(frame);
    }

    // Cache the hero rect; invalidate on scroll/resize. Avoids a forced layout
    // on every pointermove (which can fire many times per frame).
    let cachedHeroRect = null;
    function getHeroRect() {
      if (!cachedHeroRect) cachedHeroRect = heroSection.getBoundingClientRect();
      return cachedHeroRect;
    }
    window.addEventListener("scroll", () => { cachedHeroRect = null; }, { passive: true });

    function activateFromPointer(clientX, clientY) {
      const rect = getHeroRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const cell = screenToIso(x, y);
      const nextCell = { x: cell.x, y: cell.y, key: `${cell.x}-${cell.y}` };
      const now = performance.now();

      if (lastHoveredCellKey === nextCell.key || now - lastHoverActivationAt < 120) {
        return;
      }

      lastHoveredCellKey = nextCell.key;
      lastHoverActivationAt = now;
      activeCells.set(nextCell.key, 1);

      if (lastActivatedCell && lastActivatedCell.key !== nextCell.key) {
        pathSignals.push(createPathSignal(lastActivatedCell, nextCell));
        activeCells.set(lastActivatedCell.key, 1);
      }

      lastActivatedCell = nextCell;
    }

    function handlePointerMove(event) {
      const rect = getHeroRect();
      target.x = event.clientX - rect.left;
      target.y = event.clientY - rect.top;
      activateFromPointer(event.clientX, event.clientY);
    }

    function handlePointerLeave() {
      target.x = heroWidth * 0.5;
      target.y = heroHeight * 0.42;
      lastHoveredCellKey = null;
    }

    function handleResize() {
      cachedHeroRect = null;
      rebuildGrid();
      pointer = { x: heroWidth * 0.5, y: heroHeight * 0.42 };
      target = { ...pointer };
      getAboutSceneRenderers().forEach((renderer) => resizeSceneRenderer(renderer));
      const platformRenderer = getPlatformRenderer();
      if (platformRenderer) resizeSceneRenderer(platformRenderer);
    }

    // Coalesce resize events into one rAF tick. Native resize can fire dozens
    // of times during a window drag; rebuildGrid + scene resizes are expensive.
    let resizeQueued = false;
    window.addEventListener("resize", () => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        handleResize();
      });
    });
    heroSection.addEventListener("pointermove", handlePointerMove);
    heroSection.addEventListener("pointerleave", handlePointerLeave);

    rebuildGrid();
    pointer = { x: heroWidth * 0.5, y: heroHeight * 0.42 };
    target = { ...pointer };
    getAboutSceneRenderers().forEach((renderer) => resizeSceneRenderer(renderer));
    {
      const platformRenderer = getPlatformRenderer();
      if (platformRenderer) resizeSceneRenderer(platformRenderer);
    }

    // Rotating hero headline
    const HERO_ACCENT_WORDS = ["Banks", "Fintechs", "Treasuries", "Wallets", "Exchanges"];
    let heroAccentIndex = 0;
    const heroAccentEl = document.getElementById("heroAccentWord");

    // Rotate the accent word every 3s. Skip the DOM work when the tab is
    // hidden, and don't run at all under reduced-motion.
    if (heroAccentEl && !reduceMotion) {
      setInterval(() => {
        if (document.visibilityState !== "visible") return;
        heroAccentEl.classList.add("is-hidden");
        setTimeout(() => {
          heroAccentIndex = (heroAccentIndex + 1) % HERO_ACCENT_WORDS.length;
          heroAccentEl.textContent = HERO_ACCENT_WORDS[heroAccentIndex];
          heroAccentEl.classList.remove("is-hidden");
        }, 230);
      }, 3000);
    }

    requestAnimationFrame(frame);
  }

  homepage.initHeroGrid = initHeroGrid;
})();
