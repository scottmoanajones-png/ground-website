(function () {
  var LIBRARY_SRC = "../../assets/grid/generated/library.generated.js";
  var WRAPPER_SRC = "../../assets/grid/grid-library.js";
  var loaded = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function load() {
    if (loaded) return;
    loaded = true;
    loadScript(LIBRARY_SRC)
      .then(function () { return loadScript(WRAPPER_SRC); })
      .then(function () {
        document.dispatchEvent(new CustomEvent("ground-grid-ready"));
      })
      .catch(function (err) {
        console.error("[lazy-grid] failed to load grid libraries", err);
      });
  }

  var target = document.querySelector(".value-section");
  if (!target || !("IntersectionObserver" in window)) {
    load();
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        io.disconnect();
        load();
        return;
      }
    }
  }, { rootMargin: "800px 0px 800px 0px" });

  io.observe(target);
})();
