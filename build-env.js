/**
 * Genera env.js con las credenciales para el navegador.
 *
 * Las toma, por orden de prioridad:
 *   1. Variables de entorno del proceso (las que pones en Vercel).
 *   2. El archivo .env local (para generar env.js a mano en desarrollo).
 *
 * Vercel ejecuta este script en cada build (ver vercel.json), de modo que
 * tus variables del panel acaban dentro de env.js que sí puede leer el
 * navegador. El archivo env.js NO se sube a git (está en .gitignore).
 */
const fs = require("fs");

function fromDotenv() {
  try {
    const text = fs.readFileSync(".env", "utf8");
    const env = {};
    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;
      const eq = line.indexOf("=");
      if (eq === -1) return;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[line.slice(0, eq).trim()] = value;
    });
    return env;
  } catch (_err) {
    return {};
  }
}

const dotenv = fromDotenv();

const env = {
  API_KEY:
    process.env.API_KEY ||
    process.env.GOOGLE_API_KEY ||
    dotenv.API_KEY ||
    dotenv.GOOGLE_API_KEY ||
    "",
  DRIVE_FOLDER_URL:
    process.env.DRIVE_FOLDER_URL || dotenv.DRIVE_FOLDER_URL || "",
};

fs.writeFileSync(
  "env.js",
  "window.CAROUSEL_ENV = " + JSON.stringify(env, null, 2) + ";\n"
);

console.log(
  "env.js generado -> API_KEY: " +
    (env.API_KEY ? "OK" : "VACÍA") +
    " | DRIVE_FOLDER_URL: " +
    (env.DRIVE_FOLDER_URL ? "OK" : "VACÍA")
);
