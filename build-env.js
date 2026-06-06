/**
 * Genera env.js con la lista de imágenes de la carpeta img/.
 *
 * Escanea img/ (relativa al proyecto) y genera URLs file:// para cada imagen.
 *
 * Uso: node build-env.js
 * Luego abre index.html directamente en el navegador (protocolo file://).
 */
const fs = require("fs");
const path = require("path");

// ---------- Escanear carpeta img/ ----------

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;
const IMG_FOLDER = path.join(__dirname, "img");

let localImages = [];
try {
  const files = fs.readdirSync(IMG_FOLDER);
  localImages = files
    .filter((f) => IMAGE_EXTENSIONS.test(f))
    .sort()
    .map((f) => "file://" + path.join(IMG_FOLDER, f));
  console.log(`[build-env] img/ -> ${localImages.length} imagen(es) encontrada(s).`);
} catch (_err) {
  console.warn(`[build-env] No se pudo leer la carpeta img/: ${IMG_FOLDER}`);
}

const env = {
  LOCAL_IMAGES: localImages,
};

fs.writeFileSync(
  "env.js",
  "window.CAROUSEL_ENV = " + JSON.stringify(env, null, 2) + ";\n"
);

console.log("env.js generado -> LOCAL_IMAGES: " + env.LOCAL_IMAGES.length + " imagen(es).");
