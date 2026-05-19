(function attachGroundGridAssets(global) {
  const LIBRARY_KEY = "GroundGridLibrary";

  function getLibrary() {
    const library = global[LIBRARY_KEY];
    if (!library || typeof library !== "object") {
      throw new Error(`Missing ${LIBRARY_KEY}. Load assets/grid/generated/library.generated.js before grid-library.js.`);
    }
    return library;
  }

  function getBucket(bucketName) {
    const library = getLibrary();
    const bucket = library[bucketName];
    if (!bucket || typeof bucket !== "object") {
      throw new Error(`Unknown Ground grid library bucket: ${bucketName}`);
    }
    return bucket;
  }

  function getAsset(bucketName, id) {
    if (typeof id !== "string" || !id.trim()) {
      throw new Error(`Ground grid asset id must be a non-empty string for ${bucketName}.`);
    }

    const bucket = getBucket(bucketName);
    const asset = bucket[id];
    if (!asset) {
      throw new Error(`Missing Ground grid ${bucketName.slice(0, -1)}: ${id}`);
    }
    return asset;
  }

  function cloneGrid(grid) {
    return Array.isArray(grid) ? grid.map((row) => [...row]) : [];
  }

  function resolveScene(sceneOrId) {
    const scene = typeof sceneOrId === "string" ? getAsset("scenes", sceneOrId) : sceneOrId;
    if (!scene || typeof scene !== "object") {
      throw new Error("resolveScene expects a scene id or scene object.");
    }

    const shape = scene.shapeId ? getAsset("shapes", scene.shapeId) : null;
    const animation = scene.animationId ? getAsset("animations", scene.animationId) : null;

    return {
      scene,
      shape,
      animation
    };
  }

  function listScenesByPlacement(placementName) {
    const library = getLibrary();
    const byPlacement = library.indices && library.indices.byPlacement ? library.indices.byPlacement : {};
    const ids = byPlacement[placementName] || [];
    return ids.map((id) => getAsset("scenes", id));
  }

  global.GroundGridAssets = {
    cloneGrid,
    getAnimation(id) {
      return getAsset("animations", id);
    },
    getLibrary,
    getScene(id) {
      return getAsset("scenes", id);
    },
    getShape(id) {
      return getAsset("shapes", id);
    },
    listScenesByPlacement,
    resolveScene
  };
})(window);
