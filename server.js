/**
 * Servidor local para el carrusel de imágenes desde carpeta del disco.
 *
 * Uso:
 *   node server.js
 *
 * Lee del .env:
 *   IMAGES_FOLDER  — ruta absoluta (o relativa al proyecto) de la carpeta de imágenes.
 *   PORT           — puerto HTTP (por defecto 3000).
 *
 * Endpoints:
 *   GET /api/images          → JSON con la lista de nombres de archivo de imágenes.
 *   GET /local-images/:name  → Sirve el archivo de imagen desde IMAGES_FOLDER.
 *   GET /*                   → Archivos estáticos del proyecto (HTML, CSS, JS, etc.).
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------- Leer .env ----------

function parseDotenv(filePath) {
  const env = {};
  try {
    const text = fs.readFileSync(filePath, "utf8");
    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;
      const eq = line.indexOf("=");
      if (eq === -1) return;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key) env[key] = value;
    });
  } catch (_err) {
    // .env no existe o no se puede leer; continúa sin él.
  }
  return env;
}

const dotenv = parseDotenv(path.join(__dirname, ".env"));

const PORT = parseInt(process.env.PORT || dotenv.PORT || "3000", 10);
const IMAGES_FOLDER = path.resolve(
  __dirname,
  process.env.IMAGES_FOLDER || dotenv.IMAGES_FOLDER || "img"
);

// ---------- Tipos MIME para imágenes ----------

const IMAGE_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
};

const STATIC_MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---------- Helpers ----------

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

/** Devuelve true si la ruta resuelta sigue estando dentro del directorio base. */
function isSafe(base, resolved) {
  return resolved.startsWith(base + path.sep) || resolved === base;
}

// ---------- Manejadores de ruta ----------

/** GET /api/images → lista de nombres de archivo de imágenes en IMAGES_FOLDER. */
function handleApiImages(res) {
  if (!IMAGES_FOLDER) {
    return sendError(res, 500, "IMAGES_FOLDER no configurada.");
  }

  fs.readdir(IMAGES_FOLDER, (err, files) => {
    if (err) {
      const msg =
        err.code === "ENOENT"
          ? `La carpeta no existe: ${IMAGES_FOLDER}`
          : `No se pudo leer la carpeta: ${err.message}`;
      return sendError(res, 500, msg);
    }

    const images = files
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return IMAGE_MIME[ext] !== undefined;
      })
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

    sendJson(res, 200, images);
  });
}

/** GET /local-images/:name → sirve el archivo de imagen desde IMAGES_FOLDER. */
function handleLocalImage(req, res, filename) {
  if (!IMAGES_FOLDER) {
    return sendError(res, 500, "IMAGES_FOLDER no configurada.");
  }

  // Prevenir directory traversal: solo se permite el nombre de archivo sin rutas.
  const safeName = path.basename(filename);
  const filePath = path.join(IMAGES_FOLDER, safeName);

  if (!isSafe(IMAGES_FOLDER, filePath)) {
    return sendError(res, 403, "Acceso denegado.");
  }

  const ext = path.extname(safeName).toLowerCase();
  const mime = IMAGE_MIME[ext];
  if (!mime) {
    return sendError(res, 415, "Tipo de archivo no soportado.");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendError(res, 404, `Imagen no encontrada: ${safeName}`);
    }

    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=3600",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/** GET /* → archivos estáticos del directorio del proyecto. */
function handleStatic(req, res, urlPath) {
  // index.html por defecto
  const relPath = urlPath === "/" ? "index.html" : urlPath.slice(1);

  // Solo se permiten rutas simples (sin doble punto), sin acceso a subdirectorios arbitrarios.
  const safePath = path.normalize(relPath);
  if (safePath.startsWith("..")) {
    res.writeHead(403);
    res.end("Acceso denegado.");
    return;
  }

  const filePath = path.join(__dirname, safePath);

  if (!isSafe(__dirname, filePath)) {
    res.writeHead(403);
    res.end("Acceso denegado.");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("No encontrado.");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = STATIC_MIME[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------- Servidor ----------

const server = http.createServer((req, res) => {
  // Solo se aceptan peticiones GET y HEAD.
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }

  // Parsear URL sin parámetros de query.
  let urlPath;
  try {
    urlPath = new URL(req.url, `http://localhost`).pathname;
  } catch (_) {
    res.writeHead(400);
    res.end();
    return;
  }

  // Cabecera CORS para desarrollo local (solo localhost).
  res.setHeader("Access-Control-Allow-Origin", `http://localhost:${PORT}`);

  if (urlPath === "/api/images") {
    return handleApiImages(res);
  }

  if (urlPath.startsWith("/local-images/")) {
    const filename = decodeURIComponent(urlPath.slice("/local-images/".length));
    return handleLocalImage(req, res, filename);
  }

  handleStatic(req, res, urlPath);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Carrusel local corriendo en  http://localhost:${PORT}\n`);
  if (IMAGES_FOLDER && (dotenv.IMAGES_FOLDER || process.env.IMAGES_FOLDER)) {
    console.log(`  Carpeta de imágenes: ${IMAGES_FOLDER}`);
  }
  console.log("  Presiona Ctrl+C para detener.\n");
});
