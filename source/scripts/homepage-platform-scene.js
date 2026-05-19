(() => {
  const homepage = window.GroundHomepage;
  if (!homepage) return;

  const { createScene, createSceneRenderer, resizeSceneRenderer } = homepage;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let platformRenderer = null;
  let platformGroups = [];
  let atlasShell = null;

  const PLATFORM_KEYS = ["consumer", "infrastructure", "institutions"];
  function key(col, row) {
    return `${col}:${row}`;
  }

  function addHorizontal(set, row, from, to) {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let col = start; col <= end; col += 1) {
      set.add(key(col, row));
    }
  }

  function addVertical(set, col, from, to) {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    for (let row = start; row <= end; row += 1) {
      set.add(key(col, row));
    }
  }

  function addRect(set, colStart, rowStart, colEnd, rowEnd) {
    for (let col = colStart; col <= colEnd; col += 1) {
      for (let row = rowStart; row <= rowEnd; row += 1) {
        set.add(key(col, row));
      }
    }
  }

  function addOutline(set, colStart, rowStart, colEnd, rowEnd) {
    addHorizontal(set, rowStart, colStart, colEnd);
    addHorizontal(set, rowEnd, colStart, colEnd);
    addVertical(set, colStart, rowStart, rowEnd);
    addVertical(set, colEnd, rowStart, rowEnd);
  }

  function addPath(set, points) {
    points.forEach(([col, row]) => set.add(key(col, row)));
  }

  function noise(col, row) {
    const hash = Math.sin(col * 127.1 + row * 311.7 + 0.1) * 43758.5453;
    return hash - Math.floor(hash);
  }

  const GROUND_MARK_GRID = [
    [0, 0, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 2, 2, 2, 2, 0],
    [0, 0, 0, 0, 0, 0],
    [3, 3, 3, 3, 3, 3]
  ];

  function createAtlasDefinition() {
    const core = new Set();
    const coreHeights = new Map();
    const institutions = new Set();
    const infrastructure = new Set();
    const consumer = new Set();
    const institutionLinks = new Set();
    const infrastructureLinks = new Set();
    const consumerLinks = new Set();
    const ambientHeights = new Map();

    const coreStartCol = 9;
    const coreStartRow = 9;
    GROUND_MARK_GRID.forEach((row, rowIndex) => {
      row.forEach((height, colIndex) => {
        if (!height) return;
        const cellKey = key(coreStartCol + colIndex, coreStartRow + rowIndex);
        core.add(cellKey);
        coreHeights.set(cellKey, 0.66 + (4 - height) * 0.07);
      });
    });

    addRect(institutions, 3, 10, 5, 14);
    addRect(institutions, 18, 10, 20, 14);
    addRect(institutions, 8, 4, 15, 7);
    addRect(institutions, 8, 16, 15, 19);
    addHorizontal(institutionLinks, 12, 5, 18);
    addHorizontal(institutionLinks, 13, 5, 18);
    addVertical(institutionLinks, 12, 7, 16);
    addVertical(institutionLinks, 13, 7, 16);

    addRect(infrastructure, 1, 9, 2, 11);
    addRect(infrastructure, 1, 13, 2, 15);
    addRect(infrastructure, 21, 9, 22, 11);
    addRect(infrastructure, 21, 13, 22, 15);
    addRect(infrastructure, 6, 2, 8, 3);
    addRect(infrastructure, 15, 2, 17, 3);
    addRect(infrastructure, 6, 20, 8, 21);
    addRect(infrastructure, 15, 20, 17, 21);
    addRect(infrastructure, 4, 6, 5, 7);
    addRect(infrastructure, 18, 6, 19, 7);
    addRect(infrastructure, 4, 17, 5, 18);
    addRect(infrastructure, 18, 17, 19, 18);
    addHorizontal(infrastructureLinks, 11, 2, 21);
    addHorizontal(infrastructureLinks, 12, 2, 21);
    addVertical(infrastructureLinks, 11, 2, 21);
    addVertical(infrastructureLinks, 12, 2, 21);
    addPath(infrastructureLinks, [[5, 7], [6, 8], [7, 9], [8, 10]]);
    addPath(infrastructureLinks, [[18, 7], [17, 8], [16, 9], [15, 10]]);
    addPath(infrastructureLinks, [[5, 17], [6, 16], [7, 15], [8, 14]]);
    addPath(infrastructureLinks, [[18, 17], [17, 16], [16, 15], [15, 14]]);

    addRect(consumer, 0, 2, 0, 3);
    addRect(consumer, 0, 20, 0, 21);
    addRect(consumer, 23, 2, 23, 3);
    addRect(consumer, 23, 20, 23, 21);
    addRect(consumer, 10, 0, 13, 0);
    addRect(consumer, 10, 23, 13, 23);
    addRect(consumer, 0, 11, 0, 12);
    addRect(consumer, 23, 11, 23, 12);
    addPath(consumerLinks, [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]);
    addPath(consumerLinks, [[0, 21], [1, 20], [2, 19], [3, 18], [4, 17]]);
    addPath(consumerLinks, [[23, 2], [22, 3], [21, 4], [20, 5], [19, 6]]);
    addPath(consumerLinks, [[23, 21], [22, 20], [21, 19], [20, 18], [19, 17]]);
    addPath(consumerLinks, [[11, 0], [11, 1], [11, 2], [11, 3]]);
    addPath(consumerLinks, [[12, 23], [12, 22], [12, 21], [12, 20]]);
    addPath(consumerLinks, [[0, 11], [1, 11], [2, 11], [3, 11]]);
    addPath(consumerLinks, [[23, 12], [22, 12], [21, 12], [20, 12]]);

    for (let col = 0; col < 24; col += 1) {
      for (let row = 0; row < 24; row += 1) {
        const cellKey = key(col, row);
        if (
          core.has(cellKey) ||
          institutions.has(cellKey) ||
          infrastructure.has(cellKey) ||
          consumer.has(cellKey)
        ) {
          continue;
        }

        const cellNoise = noise(col, row);
        const edgeDistance = Math.min(col, row, 23 - col, 23 - row);
        const edgeReach = Math.max(0, 1 - edgeDistance / 5);

        if (edgeDistance <= 5) {
          const edgeThreshold = 0.04 + edgeDistance * 0.11;
          if (cellNoise > edgeThreshold) {
            ambientHeights.set(cellKey, 0.12 + cellNoise * 0.12 + edgeReach * 0.08);
          }
          continue;
        }

        const dx = Math.abs(col - 11.5) / 11.5;
        const dy = Math.abs(row - 11.5) / 11.5;
        const edgeBias = Math.max(dx, dy);
        const centrality = 1 - edgeBias;
        const fieldNoise = noise(col + 17, row + 31);
        if (fieldNoise < 0.74 + edgeBias * 0.05 - centrality * 0.02) continue;

        ambientHeights.set(cellKey, 0.08 + fieldNoise * 0.1 + centrality * 0.04);
      }
    }

    const scene = createScene("platform-atlas", 24, 24, (col, row) => {
      const cellKey = key(col, row);
      let height = 0;

      if (ambientHeights.has(cellKey)) height = Math.max(height, ambientHeights.get(cellKey));
      if (consumerLinks.has(cellKey)) height = Math.max(height, 0.08);
      if (consumer.has(cellKey)) height = Math.max(height, 0.16);
      if (infrastructureLinks.has(cellKey)) height = Math.max(height, 0.16);
      if (infrastructure.has(cellKey)) height = Math.max(height, 0.42);
      if (institutionLinks.has(cellKey)) height = Math.max(height, 0.24);
      if (institutions.has(cellKey)) height = Math.max(height, 0.92);
      if (coreHeights.has(cellKey)) height = Math.max(height, coreHeights.get(cellKey));

      return { h: height, tone: "base" };
    });

    return {
      scene,
      core,
      institutions,
      infrastructure,
      consumer,
      institutionLinks,
      infrastructureLinks,
      consumerLinks,
      ambientHeights,
      coreHeights
    };
  }

  const atlas = createAtlasDefinition();
  const terrainSets = {
    core: atlas.core,
    institutions: atlas.institutions,
    infrastructure: atlas.infrastructure,
    consumer: atlas.consumer,
    institutionLinks: atlas.institutionLinks,
    infrastructureLinks: atlas.infrastructureLinks,
    consumerLinks: atlas.consumerLinks,
    ambientHeights: atlas.ambientHeights,
    coreHeights: atlas.coreHeights
  };

  function getProfileHeight(cellKey, profileKey) {
    let height = 0;

    if (terrainSets.ambientHeights.has(cellKey)) {
      height = Math.max(height, terrainSets.ambientHeights.get(cellKey));
    }

    if (terrainSets.consumerLinks.has(cellKey)) {
      height = Math.max(height, profileKey === "consumer" ? 0.26 : 0.08);
    }

    if (terrainSets.consumer.has(cellKey)) {
      height = Math.max(height, profileKey === "consumer" ? 0.52 : 0.16);
    }

    if (terrainSets.infrastructureLinks.has(cellKey)) {
      height = Math.max(height, profileKey === "infrastructure" ? 0.34 : 0.16);
    }

    if (terrainSets.infrastructure.has(cellKey)) {
      height = Math.max(height, profileKey === "infrastructure" ? 0.94 : 0.42);
    }

    if (terrainSets.institutionLinks.has(cellKey)) {
      height = Math.max(height, profileKey === "institutions" ? 0.42 : 0.24);
    }

    if (terrainSets.institutions.has(cellKey)) {
      height = Math.max(height, profileKey === "institutions" ? 1.46 : 0.92);
    }

    if (terrainSets.coreHeights.has(cellKey)) {
      height = Math.max(height, terrainSets.coreHeights.get(cellKey));
    }

    return height;
  }

  const profileHeightMaps = PLATFORM_KEYS.reduce((maps, profileKey) => {
    maps[profileKey] = Float32Array.from(
      atlas.scene.cells.map((cell) => getProfileHeight(cell.key, profileKey))
    );
    return maps;
  }, {});

  function addPulseTrail(set, route, now, msPerCell, trailLength, offset = 0) {
    if (!route.length) return;

    const head = Math.floor(((now + offset) / msPerCell) % route.length);
    for (let index = 0; index < trailLength; index += 1) {
      const routeIndex = (head - index + route.length) % route.length;
      set.add(route[routeIndex]);
    }
  }

  const CONSUMER_ROUTES = [
    [key(2, 4), key(3, 5), key(4, 6), key(5, 6), key(6, 6), key(7, 7), key(8, 8), key(9, 9), key(10, 10), key(11, 11)],
    [key(2, 18), key(3, 17), key(4, 16), key(5, 16), key(6, 16), key(7, 15), key(8, 14), key(9, 13), key(10, 12), key(11, 12)],
    [key(11, 1), key(11, 2), key(11, 3), key(11, 4), key(11, 5), key(11, 6), key(11, 7), key(11, 8), key(11, 9), key(11, 10), key(11, 11)],
    [key(21, 5), key(20, 6), key(19, 7), key(18, 7), key(17, 7), key(16, 7), key(15, 8), key(14, 9), key(13, 10), key(12, 11)],
    [key(21, 17), key(20, 16), key(19, 15), key(18, 15), key(17, 15), key(16, 15), key(15, 14), key(14, 13), key(13, 12), key(12, 12)],
    [key(22, 11), key(21, 11), key(20, 11), key(19, 11), key(18, 11), key(17, 11), key(16, 11), key(15, 11), key(14, 11), key(13, 11), key(12, 11)]
  ];

  const INFRA_ROUTES = [
    [key(6, 11), key(7, 11), key(8, 11), key(9, 11), key(10, 11), key(11, 11), key(12, 11), key(13, 11), key(14, 11), key(15, 11), key(16, 11), key(17, 11), key(18, 11)],
    [key(11, 4), key(11, 5), key(11, 6), key(11, 7), key(11, 8), key(11, 9), key(11, 10), key(11, 11), key(11, 12), key(11, 13), key(11, 14), key(11, 15), key(11, 16), key(11, 17), key(11, 18), key(11, 19)],
    [key(7, 7), key(8, 8), key(9, 9), key(10, 10), key(11, 11), key(12, 12), key(13, 13), key(14, 14), key(15, 15), key(16, 15)],
    [key(16, 7), key(15, 8), key(14, 9), key(13, 10), key(12, 11), key(11, 12), key(10, 13), key(9, 14), key(8, 15), key(7, 15)]
  ];

  const INSTITUTION_RING = [
    key(10, 8), key(11, 8), key(12, 8), key(13, 8),
    key(13, 9), key(14, 9), key(15, 9), key(15, 10), key(15, 11), key(15, 12), key(15, 13),
    key(14, 13), key(13, 14), key(13, 15), key(13, 16), key(12, 16), key(11, 16), key(10, 16),
    key(10, 15), key(10, 14), key(9, 13), key(8, 13), key(8, 12), key(8, 11), key(8, 10), key(8, 9), key(9, 8)
  ];

  const INSTITUTION_LANE = [
    key(11, 8), key(11, 9), key(11, 10), key(11, 11), key(11, 12), key(11, 13), key(11, 14), key(11, 15)
  ];

  function consumerSignals(now) {
    const signals = new Set(terrainSets.core);
    CONSUMER_ROUTES.forEach((route, index) => addPulseTrail(signals, route, now, 170, 4, index * 460));
    terrainSets.consumer.forEach((cellKey) => signals.add(cellKey));
    terrainSets.core.forEach((cellKey) => signals.add(cellKey));
    return signals;
  }

  function infrastructureSignals(now) {
    const signals = new Set(terrainSets.core);
    INFRA_ROUTES.forEach((route, index) => addPulseTrail(signals, route, now, 150, 5, index * 380));
    terrainSets.infrastructure.forEach((cellKey) => signals.add(cellKey));
    terrainSets.core.forEach((cellKey) => signals.add(cellKey));
    return signals;
  }

  function institutionsSignals(now) {
    const signals = new Set(terrainSets.core);
    addPulseTrail(signals, INSTITUTION_RING, now, 205, 7, 0);
    addPulseTrail(signals, INSTITUTION_LANE, now, 225, 5, 640);
    terrainSets.institutions.forEach((cellKey) => signals.add(cellKey));
    terrainSets.core.forEach((cellKey) => signals.add(cellKey));
    return signals;
  }

  // ── Animation tick ───────────────────────────────────────────────────────────
  function animationTick(now) {
    if (!platformRenderer) return;
    if (!reduceMotion) {
      const platformKey = PLATFORM_KEYS[platformRenderer.activeSceneIndex || 0];
      if (platformKey === "consumer") platformRenderer.activeSignals = consumerSignals(now);
      else if (platformKey === "infrastructure") platformRenderer.activeSignals = infrastructureSignals(now);
      else platformRenderer.activeSignals = institutionsSignals(now);
    }
    requestAnimationFrame(animationTick);
  }

  // ── Scene switching ───────────────────────────────────────────────────────────
  function setPlatformScene(index, byUser, now = performance.now()) {
    if (!platformRenderer) return;

    const platformKey = PLATFORM_KEYS[index] || PLATFORM_KEYS[0];
    platformRenderer.activeSceneIndex = index;
    platformRenderer.activeSignals = reduceMotion
      ? new Set(terrainSets[platformKey])
      : platformKey === "consumer"
        ? consumerSignals(now)
        : platformKey === "infrastructure"
          ? infrastructureSignals(now)
          : institutionsSignals(now);

    profileHeightMaps[platformKey].forEach((height, sceneIndex) => {
      platformRenderer.targetHeights[sceneIndex] = height;
    });

    platformGroups.forEach(group => {
      const isActive = Number(group.dataset.platformScene) === index;
      group.classList.toggle("is-active", isActive);
      group.setAttribute("aria-pressed", isActive);
    });
    if (atlasShell) atlasShell.dataset.platformActive = platformKey;

    if (byUser) {
      platformRenderer.userPausedUntil = now + 5000;
      platformRenderer.nextSceneAt = platformRenderer.userPausedUntil + 3200;
    } else {
      platformRenderer.nextSceneAt = now + 3200;
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  function initPlatformScene() {
    if (platformRenderer) return;

    platformRenderer = createSceneRenderer(document.getElementById("platformScene"), {
      palette: "platform",
      scene: atlas.scene,
      scenes: [atlas.scene, atlas.scene, atlas.scene],
      scrollElement: document.querySelector(".platform-callout"),
      layoutOptions: {
        scale: {
          flat: 1.08,
          tilt: 1.14,
          start: 0.02,
          end: 0.34
        },
        padding: {
          flat: -42,
          tilt: -72,
          start: 0.02,
          end: 0.34
        }
      },
      dynamic: true,
      onAdvance: setPlatformScene
    });
    platformGroups = Array.from(document.querySelectorAll(".platform-group"));
    atlasShell = document.querySelector("[data-platform-atlas]");

    platformGroups.forEach(group => {
      const activate = () => setPlatformScene(Number(group.dataset.platformScene), true);
      group.addEventListener("mouseenter", activate);
      group.addEventListener("focus", activate);
      group.addEventListener("click", activate);
    });

    setPlatformScene(0, false);
    if (platformRenderer) resizeSceneRenderer(platformRenderer);

    requestAnimationFrame(animationTick);
  }

  if (window.GroundGridAssets) {
    initPlatformScene();
  } else {
    document.addEventListener("ground-grid-ready", initPlatformScene, { once: true });
  }

  homepage.getPlatformRenderer = () => platformRenderer;
  homepage.initPlatformScene = initPlatformScene;
  homepage.setPlatformScene = setPlatformScene;
})();
