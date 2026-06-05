/**
 * Carrusel de imágenes leídas desde una carpeta pública de Google Drive.
 * La configuración se carga desde config.json (no hay nada hardcodeado aquí).
 */

(function () {
  "use strict";

  const els = {
    carousel: document.getElementById("carousel"),
    track: document.getElementById("track"),
    prev: document.getElementById("prevBtn"),
    next: document.getElementById("nextBtn"),
    dots: document.getElementById("dots"),
    status: document.getElementById("status"),
    ambient: document.getElementById("ambient"),
  };

  const state = {
    config: null,
    images: [], // [{ id, name }]
    index: 0,
    timer: null,
    slides: [],
    dots: [],
  };

  // ---------- Utilidades ----------

  function showStatus(message, isError) {
    els.status.textContent = message;
    els.status.hidden = false;
    els.status.classList.toggle("is-error", Boolean(isError));
  }

  function hideStatus() {
    els.status.hidden = true;
  }

  /** Extrae el ID de la carpeta a partir de una URL de Google Drive. */
  function extractFolderId(url) {
    if (!url) return null;
    const byPath = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (byPath) return byPath[1];
    const byQuery = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (byQuery) return byQuery[1];
    // Por si en config ponen directamente el ID
    if (/^[a-zA-Z0-9_-]{10,}$/.test(url)) return url;
    return null;
  }

  /** Construye la URL de visualización de una imagen a partir de su ID de Drive. */
  function driveImageUrl(id, width) {
    return `https://lh3.googleusercontent.com/d/${id}=w${width || 1920}`;
  }

  /** URL alternativa por si la principal falla. */
  function driveImageUrlFallback(id, width) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w${width || 1920}`;
  }

  /** Si una entrada de fallbackImages es una URL completa la usa tal cual; si es un ID, la convierte. */
  function normalizeManualImage(entry) {
    if (typeof entry !== "string") return null;
    const value = entry.trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) {
      return { url: value, name: value };
    }
    return { id: value, name: value };
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Carga de datos ----------

  async function loadConfig() {
    const res = await fetch("config.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("No se pudo leer config.json");
    return res.json();
  }

  /** Parsea el contenido de un archivo .env (líneas CLAVE=valor) en un objeto. */
  function parseEnv(text) {
    const env = {};
    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;
      const eq = line.indexOf("=");
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // Quita comillas envolventes si las hay.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) env[key] = value;
    });
    return env;
  }

  /** Lee credenciales desde .env (opcional). Devuelve {} si no existe. */
  async function loadEnv() {
    try {
      const res = await fetch(".env", { cache: "no-cache" });
      if (!res.ok) return {};
      return parseEnv(await res.text());
    } catch (_err) {
      return {};
    }
  }

  /** Fusiona las credenciales del .env sobre la config (el .env tiene prioridad). */
  function applyEnv(config, env) {
    const apiKey = env.API_KEY || env.GOOGLE_API_KEY;
    if (apiKey) config.apiKey = apiKey;
    if (env.DRIVE_FOLDER_URL) config.driveFolderUrl = env.DRIVE_FOLDER_URL;
    return config;
  }

  /** Lista imágenes de la carpeta usando la API de Google Drive (requiere apiKey). */
  async function fetchImagesFromDrive(folderId, apiKey) {
    const images = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
        key: apiKey,
        fields: "nextPageToken, files(id, name)",
        orderBy: "name",
        pageSize: "100",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
      const data = await res.json();
      if (!res.ok) {
        const reason = data && data.error ? data.error.message : res.statusText;
        throw new Error(`Drive API: ${reason}`);
      }
      (data.files || []).forEach((f) => images.push({ id: f.id, name: f.name }));
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    return images;
  }

  /** Resuelve la lista de imágenes según la config disponible. */
  async function resolveImages(config) {
    const folderId = extractFolderId(config.driveFolderUrl);

    if (config.apiKey && folderId) {
      const imgs = await fetchImagesFromDrive(folderId, config.apiKey);
      if (imgs.length) return imgs;
    }

    // Fallback: lista manual de IDs o URLs en config.fallbackImages
    if (Array.isArray(config.fallbackImages) && config.fallbackImages.length) {
      return config.fallbackImages.map(normalizeManualImage).filter(Boolean);
    }

    return [];
  }

  // ---------- Construcción del carrusel ----------

  function buildSlides() {
    els.track.innerHTML = "";
    state.slides = state.images.map((img, i) => {
      const slide = document.createElement("div");
      slide.className = "slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "diapositiva");
      slide.setAttribute("aria-label", `${i + 1} de ${state.images.length}`);

      const primary = img.url || driveImageUrl(img.id);
      img._displayUrl = primary;
      slide.style.backgroundImage = `url("${primary}")`;

      // Si falla la URL principal de Drive, intenta la alternativa.
      if (img.id) {
        const probe = new Image();
        probe.onerror = () => {
          const alt = driveImageUrlFallback(img.id);
          img._displayUrl = alt;
          slide.style.backgroundImage = `url("${alt}")`;
          if (i === state.index) setAmbient(alt);
        };
        probe.src = primary;
      }

      els.track.appendChild(slide);
      return slide;
    });
  }

  function setAmbient(url) {
    if (!els.ambient || !url) return;
    els.ambient.style.backgroundImage = `url("${url}")`;
    els.ambient.classList.add("is-ready");
  }

  function buildDots() {
    els.dots.innerHTML = "";
    state.dots = [];
    if (!state.config.showDots || state.images.length <= 1) {
      els.dots.hidden = true;
      return;
    }
    state.images.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.className = "dot";
      dot.setAttribute("aria-label", `Ir a la imagen ${i + 1}`);
      dot.addEventListener("click", () => goTo(i, true));
      els.dots.appendChild(dot);
      state.dots.push(dot);
    });
    els.dots.hidden = false;
  }

  function render() {
    state.slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === state.index);
      slide.classList.toggle("is-prev", i === prevIndex());
    });
    state.dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === state.index);
    });
    const active = state.images[state.index];
    if (active) setAmbient(active._displayUrl);
  }

  function prevIndex() {
    return (state.index - 1 + state.images.length) % state.images.length;
  }

  function goTo(i, fromUser) {
    state.index = (i + state.images.length) % state.images.length;
    render();
    if (fromUser) restartTimer();
  }

  function nextSlide(fromUser) {
    goTo(state.index + 1, fromUser);
  }

  function prevSlide(fromUser) {
    goTo(state.index - 1, fromUser);
  }

  // ---------- Reproducción automática ----------

  function startTimer() {
    if (state.images.length <= 1) return;
    const interval = Math.max(1000, state.config.intervalMs || 5000);
    state.timer = setInterval(() => nextSlide(false), interval);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function restartTimer() {
    stopTimer();
    startTimer();
  }

  // ---------- Controles ----------

  function setupControls() {
    const cfg = state.config;
    const multiple = state.images.length > 1;

    if (cfg.showArrows && multiple) {
      els.prev.hidden = false;
      els.next.hidden = false;
      els.prev.addEventListener("click", () => prevSlide(true));
      els.next.addEventListener("click", () => nextSlide(true));
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") nextSlide(true);
      else if (e.key === "ArrowLeft") prevSlide(true);
    });

    if (cfg.pauseOnHover) {
      els.carousel.addEventListener("mouseenter", stopTimer);
      els.carousel.addEventListener("mouseleave", startTimer);
    }

    // Soporte táctil (swipe)
    let touchX = null;
    els.carousel.addEventListener(
      "touchstart",
      (e) => (touchX = e.touches[0].clientX),
      { passive: true }
    );
    els.carousel.addEventListener(
      "touchend",
      (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) (dx < 0 ? nextSlide : prevSlide)(true);
        touchX = null;
      },
      { passive: true }
    );
  }

  // ---------- Arranque ----------

  async function init() {
    try {
      const [config, env] = await Promise.all([loadConfig(), loadEnv()]);
      state.config = applyEnv(config, env);
    } catch (err) {
      showStatus("No se pudo cargar config.json. Ábrelo desde un servidor web (no como archivo).", true);
      return;
    }

    const cfg = state.config;
    document.documentElement.style.setProperty(
      "--transition-ms",
      `${cfg.transitionMs || 1000}ms`
    );
    els.carousel.dataset.transition = cfg.transition || "fade";

    showStatus("Cargando imágenes…");

    let images;
    try {
      images = await resolveImages(cfg);
    } catch (err) {
      showStatus(`Error al obtener imágenes: ${err.message}`, true);
      return;
    }

    if (!images.length) {
      showStatus(
        "No se encontraron imágenes. Revisa la carpeta de Drive, la apiKey o fallbackImages en config.json.",
        true
      );
      return;
    }

    if (cfg.shuffle) shuffleArray(images);
    state.images = images;

    buildSlides();
    buildDots();
    setupControls();
    hideStatus();
    render();
    startTimer();
  }

  init();
})();
