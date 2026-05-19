(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const { reduceMotion, clamp, smoothstep, easeOutCubic, mixRgb, rgbString } = homepage;

  const section = document.querySelector(".error-hero");
  const canvas = document.getElementById("error404Grid");
  if (!section || !canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;
  const errorCopy = section.querySelector(".error-copy");

  const sceneConfig = {
    cellSize: 30,
    cubeHeight: 1.04,
    gridLineAlpha: 0.24,
    hoverRadiusCells: 6.4,
    pathTrail: 1.85,
    pathSpeed: 19,
    pathFade: 0.54,
    logoIntroDelay: 0.22,
    logoRiseDuration: 0.96,
    logoSecondCubeDelay: 0.28,
    logoUpperRevealThreshold: 0.18,
    logoStagger: 0.03,
    copyGapCells: 3,
    shimmerTravelMs: 2600,
    shimmerPauseMs: 1700,
    centerY: 0.4,
    cameraTransitionStart: 0.05
  };

  const PALETTE = {
    surfaceDark: [233, 230, 224],
    surfaceLight: [244, 242, 237],
    line: [183, 188, 181],
    cubeTop: [237, 244, 241],
    cubeLeft: [215, 225, 221],
    cubeRight: [194, 206, 201],
    cubeLine: [177, 189, 184],
    cubeShadow: [141, 151, 147, 0.14],
    signal: [46, 168, 102]
  };

  const MARK_CUBE_PALETTE = {
    top: [242, 249, 247],
    left: [218, 227, 225],
    right: [181, 195, 192]
  };

  let sceneWidth = 0;
  let sceneHeight = 0;
  let hoverRadiusSq = 0;
  let gridRange = 0;
  let cells = [];
  let cellLookup = new Map();
  let markCells = [];
  let pathSignals = [];
  let activeCells = new Map();
  let pointer = { x: -1000, y: -1000 };
  let target = { x: -1000, y: -1000 };
  let lastHoveredCellKey = null;
  let lastHoverActivationAt = 0;
  let lastActivatedCell = null;
  let currentView = 1;
  let currentBasis = null;
  let lastFrameTime = performance.now();
  let cachedRect = null;
  const sceneAnimationStart = performance.now();
  let introDurationMs = 0;

  function getProjectionBasis(view) {
    const eased = smoothstep(0, 1, view);
    return {
      xAxis: {
        x: 1 + (1.04 - 1) * eased,
        y: 0.52 * eased
      },
      yAxis: {
        x: -1.04 * eased,
        y: 1 - 0.48 * eased
      },
      zLift: 1.04 * eased
    };
  }

  function projectPoint(x, y, z, basis) {
    const scale = sceneConfig.cellSize;
    return {
      x: (x * basis.xAxis.x + y * basis.yAxis.x) * scale + sceneWidth / 2,
      y: (x * basis.xAxis.y + y * basis.yAxis.y - z * basis.zLift) * scale + sceneHeight * sceneConfig.centerY
    };
  }

  function getSurfaceFill(intensity) {
    return mixRgb(PALETTE.surfaceDark, PALETTE.surfaceLight, intensity);
  }

  function getSurfaceLine(intensity) {
    return mixRgb(PALETTE.line, PALETTE.signal, intensity * 0.18);
  }

  function getCellBase(cell, pointerInfluence = 0) {
    return clamp(0.16 + cell.variance * 0.028 + pointerInfluence * 0.58, 0, 1);
  }

  function drawFace(points, fill, stroke, alpha) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.closePath();
    context.fillStyle = rgbString(fill, 1);
    context.fill();
    context.strokeStyle = rgbString(stroke, alpha);
    context.stroke();
  }

  function drawGroundCell(cell, intensity, lineBoost, basis) {
    const fill = getSurfaceFill(intensity);
    const line = getSurfaceLine(intensity + lineBoost);
    const groundPoints = [
      projectPoint(cell.x, cell.y, 0, basis),
      projectPoint(cell.x + 1, cell.y, 0, basis),
      projectPoint(cell.x + 1, cell.y + 1, 0, basis),
      projectPoint(cell.x, cell.y + 1, 0, basis)
    ];

    drawFace(groundPoints, fill, line, sceneConfig.gridLineAlpha + lineBoost * 0.18);
  }

  function drawPrism(cell, zStart, zEnd, baseFill, basis, faceOverride = null) {
    const visibleSides = currentView > 0.04;
    const finalTop = faceOverride ? faceOverride.top : PALETTE.cubeTop;
    const finalLeft = faceOverride ? faceOverride.left : PALETTE.cubeLeft;
    const finalRight = faceOverride ? faceOverride.right : PALETTE.cubeRight;
    const finalLine = PALETTE.cubeLine;

    const topPoints = [
      projectPoint(cell.x, cell.y, zEnd, basis),
      projectPoint(cell.x + 1, cell.y, zEnd, basis),
      projectPoint(cell.x + 1, cell.y + 1, zEnd, basis),
      projectPoint(cell.x, cell.y + 1, zEnd, basis)
    ];
    const lowerPoints = [
      projectPoint(cell.x, cell.y, zStart, basis),
      projectPoint(cell.x + 1, cell.y, zStart, basis),
      projectPoint(cell.x + 1, cell.y + 1, zStart, basis),
      projectPoint(cell.x, cell.y + 1, zStart, basis)
    ];

    const faceBlend = smoothstep(0.04, 1, zEnd - zStart);
    const cubeTop = mixRgb(baseFill, finalTop, faceBlend);
    const cubeLeft = mixRgb(baseFill, finalLeft, faceBlend * 0.92);
    const cubeRight = mixRgb(baseFill, finalRight, faceBlend * 0.94);
    const cubeLine = mixRgb(baseFill, finalLine, faceBlend);

    context.lineWidth = Math.max(0.9, sceneConfig.cellSize * 0.02);
    context.lineJoin = "round";
    context.lineCap = "round";

    if (visibleSides) {
      drawFace([lowerPoints[3], lowerPoints[2], topPoints[2], topPoints[3]], cubeLeft, cubeLine, 0.84);
      drawFace([lowerPoints[1], lowerPoints[2], topPoints[2], topPoints[1]], cubeRight, cubeLine, 0.84);
    }

    drawFace(topPoints, cubeTop, cubeLine, 0.84);
  }

  function drawCubeColumn(cell, lift, baseFill, basis, faceOverride = null) {
    const lowerLift = clamp(lift * 1.45, 0, 1);
    const upperLift = clamp(
      (lift - sceneConfig.logoSecondCubeDelay) / (1 - sceneConfig.logoSecondCubeDelay),
      0,
      1
    );

    if (lowerLift > 0.001) {
      drawPrism(cell, 0, lowerLift, baseFill, basis, faceOverride);
    }

    if (upperLift > sceneConfig.logoUpperRevealThreshold) {
      const upperDrawLift = smoothstep(sceneConfig.logoUpperRevealThreshold, 1, upperLift);
      drawPrism(cell, 1, 1 + upperDrawLift, baseFill, basis, faceOverride);
    }
  }

  function paintRect(target, startX, startY, width, height) {
    for (let y = startY; y < startY + height; y += 1) {
      for (let x = startX; x < startX + width; x += 1) {
        target.add(`${x}:${y}`);
      }
    }
  }

  function buildFourCells() {
    const cellsSet = new Set();
    paintRect(cellsSet, 0, 0, 2, 6);
    paintRect(cellsSet, 4, 0, 2, 10);
    paintRect(cellsSet, 0, 4, 6, 2);
    return cellsSet;
  }

  function buildZeroCells() {
    const cellsSet = new Set();
    paintRect(cellsSet, 0, 0, 6, 2);
    paintRect(cellsSet, 0, 8, 6, 2);
    paintRect(cellsSet, 0, 0, 2, 10);
    paintRect(cellsSet, 4, 0, 2, 10);
    return cellsSet;
  }

  function rebuildMarkCells() {
    const digitWidth = 6;
    const digitHeight = 10;
    const digitGap = 2;
    const digitSets = [buildFourCells(), buildZeroCells(), buildFourCells()];
    const totalWidth = digitWidth * 3 + digitGap * 2;
    const startX = -Math.floor(totalWidth * 0.5);
    const startY = -Math.floor(digitHeight * 0.5) - 1;
    const nextMarkCells = [];

    digitSets.forEach((digitSet, digitIndex) => {
      const xOffset = digitIndex * (digitWidth + digitGap);

      digitSet.forEach((coordinate) => {
        const [localX, localY] = coordinate.split(":").map(Number);
        const x = startX + xOffset + localX;
        const y = startY + localY;
        const key = `${x}:${y}`;
        const baseCell = cellLookup.get(key);

        if (!baseCell) {
          return;
        }

        nextMarkCells.push({
          x,
          y,
          key,
          digitIndex,
          localX,
          localY,
          variance: baseCell.variance,
          screenX: 0,
          screenY: 0
        });
      });
    });

    nextMarkCells.sort(
      (a, b) =>
        a.digitIndex - b.digitIndex ||
        a.localY - b.localY ||
        a.localX - b.localX
    );

    markCells = nextMarkCells.map((cell, index, source) => ({
      ...cell,
      order: index,
      reverseOrder: source.length - index - 1
    }));

    if (markCells.length) {
      const finalOrder = markCells.reduce((maxOrder, cell) => Math.max(maxOrder, cell.order), 0);
      introDurationMs =
        (sceneConfig.logoIntroDelay + finalOrder * sceneConfig.logoStagger + sceneConfig.logoRiseDuration) * 1000;
    }
  }

  function rebuildGrid() {
    const rect = section.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    sceneWidth = Math.max(1, Math.round(rect.width));
    sceneHeight = Math.max(1, Math.round(rect.height));
    sceneConfig.cellSize = clamp(Math.round(Math.min(sceneWidth, sceneHeight) * 0.0315), 18, 32);
    hoverRadiusSq = Math.pow(sceneConfig.cellSize * sceneConfig.hoverRadiusCells, 2);
    gridRange = Math.ceil((sceneWidth + sceneHeight) / sceneConfig.cellSize) + 12;

    canvas.width = Math.round(sceneWidth * dpr);
    canvas.height = Math.round(sceneHeight * dpr);
    canvas.style.width = `${sceneWidth}px`;
    canvas.style.height = `${sceneHeight}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    cells = [];
    cellLookup = new Map();
    for (let y = -gridRange; y <= gridRange; y += 1) {
      for (let x = -gridRange; x <= gridRange; x += 1) {
        const cell = {
          x,
          y,
          key: `${x}:${y}`,
          variance: (((x * 13 + y * 29) % 9) - 4) * 0.2,
          screenX: 0,
          screenY: 0
        };
        cells.push(cell);
        cellLookup.set(cell.key, cell);
      }
    }

    rebuildMarkCells();
  }

  function getViewTarget(now) {
    if (reduceMotion) {
      return 1;
    }

    if (introDurationMs <= 0) {
      return 1;
    }

    const elapsedMs = Math.max(0, now - sceneAnimationStart);
    const startMs = introDurationMs * sceneConfig.cameraTransitionStart;
    const progress = clamp((elapsedMs - startMs) / Math.max(1, introDurationMs - startMs), 0, 1);
    return 1 - smoothstep(0, 1, progress);
  }

  function updateProjectedPositions() {
    currentBasis = getProjectionBasis(currentView);
    cells.forEach((cell) => {
      const point = projectPoint(cell.x, cell.y, 0, currentBasis);
      cell.screenX = point.x;
      cell.screenY = point.y;
    });
    markCells.forEach((cell) => {
      const point = projectPoint(cell.x, cell.y, 0, currentBasis);
      cell.screenX = point.x;
      cell.screenY = point.y;
    });
  }

  function updateCopyPosition() {
    if (!errorCopy || !markCells.length) {
      return;
    }

    let markBottom = -Infinity;
    markCells.forEach((cell) => {
      const p1 = projectPoint(cell.x, cell.y + 1, 0, currentBasis);
      const p2 = projectPoint(cell.x + 1, cell.y + 1, 0, currentBasis);
      markBottom = Math.max(markBottom, p1.y, p2.y);
    });

    const copyHeight = errorCopy.getBoundingClientRect().height || 180;
    const desiredTop = markBottom + sceneConfig.cellSize * sceneConfig.copyGapCells;
    const minTop = sceneHeight * 0.18;
    const maxTop = sceneHeight - copyHeight - sceneConfig.cellSize * 1.25;
    const top = clamp(desiredTop, minTop, Math.max(minTop, maxTop));
    errorCopy.style.top = `${top}px`;
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
      const key = `${x}:${y}`;

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
      travelDuration: Math.max(0.72, signalCells.length / sceneConfig.pathSpeed),
      fadeDuration: sceneConfig.pathFade
    };
  }

  function nearestCellFromPoint(x, y) {
    let winner = null;
    let winnerDistance = Infinity;

    for (const cell of cells) {
      const dx = cell.screenX - x;
      const dy = cell.screenY - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < winnerDistance) {
        winnerDistance = distSq;
        winner = cell;
      }
    }

    return winner;
  }

  function getShimmerStrength(cell, now) {
    if (reduceMotion) {
      return 0;
    }

    const cycleMs = sceneConfig.shimmerTravelMs + sceneConfig.shimmerPauseMs;
    const elapsed = now % cycleMs;
    if (elapsed >= sceneConfig.shimmerTravelMs) {
      return 0;
    }

    const progress = elapsed / sceneConfig.shimmerTravelMs;
    const band = -4 + progress * 20;
    const diagonal = cell.localX + cell.localY * 0.82;
    return clamp(1 - Math.abs(diagonal - band) / 1.45, 0, 1);
  }

  function getMarkElapsed(now) {
    return Math.max(0, (now - sceneAnimationStart) / 1000);
  }

  function getMarkCellLift(cell, elapsed) {
    const local = clamp(
      (elapsed - sceneConfig.logoIntroDelay - cell.order * sceneConfig.logoStagger) / sceneConfig.logoRiseDuration,
      0,
      1
    );
    return easeOutCubic(local);
  }

  function getMarkCellPreview(cell, elapsed) {
    const preview = getMarkCellLift(cell, Math.max(0, elapsed + 0.14));
    return clamp(preview * 0.74, 0, 1);
  }

  function drawGrid(now, dtSeconds) {
    pathSignals = pathSignals.filter((pathSignal) => {
      const elapsed = (now - pathSignal.startedAt) / 1000;
      return elapsed < pathSignal.travelDuration + pathSignal.fadeDuration;
    });

    const cycleElapsed = getMarkElapsed(now);
    const markState = new Map();
    markCells.forEach((cell) => {
      markState.set(cell.key, {
        lift: getMarkCellLift(cell, cycleElapsed),
        preview: getMarkCellPreview(cell, cycleElapsed)
      });
    });

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
        const trail = clamp(1 - Math.abs(index - head) / sceneConfig.pathTrail, 0, 1);

        intensity += trail * 0.22 * fade;
        lineBoost += trail * 0.3 * fade;
      }

      const previewState = markState.get(cell.key);
      if (previewState && previewState.preview > 0.001) {
        intensity += previewState.preview * 0.2;
        lineBoost += previewState.preview * 0.18;
      }

      drawGroundCell(cell, intensity, lineBoost, currentBasis);
    }

    const orderedMarkCells = markCells
      .map((cell) => ({
        ...cell,
        shimmer: getShimmerStrength(cell, now),
        lift: markState.get(cell.key).lift
      }))
      .filter((cell) => cell.lift > 0.001)
      .sort((a, b) => a.screenY - b.screenY || a.screenX - b.screenX);

    orderedMarkCells.forEach((cell) => {
      const dx = cell.screenX - pointer.x;
      const dy = cell.screenY - pointer.y;
      const distSq = dx * dx + dy * dy;
      const pointerInfluence = clamp(1 - distSq / hoverRadiusSq, 0, 1);
      let baseFill = getSurfaceFill(clamp(getCellBase(cell, pointerInfluence * 0.4) + 0.1, 0, 1));

      if (cell.shimmer > 0.001) {
        baseFill = mixRgb(baseFill, [184, 222, 188], cell.shimmer * 0.5);
      }

      drawCubeColumn(cell, cell.lift, baseFill, currentBasis, MARK_CUBE_PALETTE);
    });
  }

  function frame(now) {
    const dtSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    const viewTarget = getViewTarget(now);
    currentView += (viewTarget - currentView) * (reduceMotion ? 1 : 0.12);
    const followAmount = 1 - Math.exp(-dtSeconds * 7.2);
    pointer.x += (target.x - pointer.x) * followAmount;
    pointer.y += (target.y - pointer.y) * followAmount;

    updateProjectedPositions();
    updateCopyPosition();
    context.clearRect(0, 0, sceneWidth, sceneHeight);
    drawGrid(now, dtSeconds);
    requestAnimationFrame(frame);
  }

  function getSectionRect() {
    if (!cachedRect) {
      cachedRect = section.getBoundingClientRect();
    }
    return cachedRect;
  }

  function activateFromPointer(clientX, clientY) {
    const rect = getSectionRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const nextCell = nearestCellFromPoint(localX, localY);
    const now = performance.now();

    if (!nextCell || lastHoveredCellKey === nextCell.key || now - lastHoverActivationAt < 120) {
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
    const rect = getSectionRect();
    target.x = event.clientX - rect.left;
    target.y = event.clientY - rect.top;
    activateFromPointer(event.clientX, event.clientY);
  }

  function handlePointerLeave() {
    target.x = -1000;
    target.y = -1000;
    lastHoveredCellKey = null;
  }

  function handleResize() {
    cachedRect = null;
    rebuildGrid();
    updateProjectedPositions();
  }

  let resizeQueued = false;
  window.addEventListener("resize", () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      handleResize();
    });
  });
  window.addEventListener("scroll", () => {
    cachedRect = null;
  }, { passive: true });
  section.addEventListener("pointermove", handlePointerMove);
  section.addEventListener("pointerleave", handlePointerLeave);

  handleResize();
  requestAnimationFrame(frame);
})();
