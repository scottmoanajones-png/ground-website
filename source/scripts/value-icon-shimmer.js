/**
 * value-icon-shimmer.js — value-icon renderer for the homepage.
 *
 * Renders each .value-icon canvas top-down with a gentle diagonal "shimmer" sweep,
 * sourcing every grid from the official grid library (resolves data-ground-scene ->
 * shape). Neutralizes the default scene renderer so there's no double-draw.
 * Reduced-motion safe.
 *
 * Brand icon geometry lives in the grid library (assets/grid/src -> generated),
 * not here — update the source shapes + rebuild to change them.
 */
(function valueIconShimmer() {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BASE = [206, 226, 214];
  var SIGNAL = [46, 168, 102];
  var TAU = Math.PI * 2;

  function gridForScene(scene) {
    if (!scene || !window.GroundGridAssets) return null;
    try {
      var shapeId = scene;
      try {
        var sc = window.GroundGridAssets.getScene(scene);
        if (sc && sc.shapeId) shapeId = sc.shapeId;
      } catch (e) { /* not a scene id — try as a shape id directly */ }
      return window.GroundGridAssets.getShape(shapeId).grid;
    } catch (e) { return null; }
  }

  function maxOf(grid) { var m = 0; for (var r = 0; r < grid.length; r++) for (var c = 0; c < grid[r].length; c++) if (grid[r][c] > m) m = grid[r][c]; return m || 1; }
  function mix(a, b, t) { return [Math.round(a[0]+(b[0]-a[0])*t), Math.round(a[1]+(b[1]-a[1])*t), Math.round(a[2]+(b[2]-a[2])*t)]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  function makeIcon(iconEl) {
    var scene = iconEl.dataset.groundScene;
    var canvas = iconEl.querySelector("canvas");
    var grid = gridForScene(scene);
    if (!canvas || !grid) return null;
    return { canvas: canvas, ctx: canvas.getContext("2d"), grid: grid, rows: grid.length, cols: grid[0].length, max: maxOf(grid) };
  }

  function resize(icon) {
    var rect = icon.canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    icon.w = Math.max(1, Math.round(rect.width));
    icon.h = Math.max(1, Math.round(rect.height));
    icon.canvas.width = Math.round(icon.w * dpr);
    icon.canvas.height = Math.round(icon.h * dpr);
    icon.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(icon, t) {
    var ctx = icon.ctx, W = icon.w, H = icon.h, rows = icon.rows, cols = icon.cols;
    var pad = Math.min(W, H) * 0.06;
    var cell = Math.min((W - pad * 2) / cols, (H - pad * 2) / rows);
    var gap = Math.max(0.5, cell * 0.12);
    var size = Math.max(1, cell - gap);
    var ox = (W - cell * cols) / 2, oy = (H - cell * rows) / 2;
    ctx.clearRect(0, 0, W, H);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var hv = icon.grid[r][c];
        if (hv <= 0) continue;
        var hNorm = hv / icon.max;
        var wave = reduceMotion ? 0.6 : 0.5 + 0.5 * Math.sin((r + c) * 0.45 - t * TAU / 1.6);
        var intensity = Math.min(1, hNorm * 0.55 + wave * 0.45);
        ctx.fillStyle = rgb(mix(BASE, SIGNAL, intensity));
        ctx.fillRect(ox + c * cell + gap * 0.5, oy + r * cell + gap * 0.5, size, size);
      }
    }
  }

  function start() {
    var icons = Array.prototype.map.call(document.querySelectorAll(".value-icon"), makeIcon).filter(Boolean);
    if (!icons.length) return;
    // Neutralize the default scene-based value renderer so it doesn't double-draw.
    if (window.GroundHomepage) window.GroundHomepage.getAboutSceneRenderers = function () { return []; };
    icons.forEach(resize);
    var resizing = false;
    window.addEventListener("resize", function () {
      if (resizing) return; resizing = true;
      requestAnimationFrame(function () { resizing = false; icons.forEach(resize); });
    });
    var t0 = performance.now();
    function loop(now) {
      var t = (now - t0) / 1000;
      for (var i = 0; i < icons.length; i++) draw(icons[i], t);
      if (!reduceMotion) requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function ready() {
    if (window.GroundGridAssets) start();
    else document.addEventListener("ground-grid-ready", start, { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
