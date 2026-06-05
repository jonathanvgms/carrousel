# Carrusel de imágenes desde Google Drive

Página web que muestra, en bucle y con transiciones, las imágenes de una carpeta
de Google Drive. Toda la configuración está en `config.json`.

## Archivos

- `index.html` — estructura de la página
- `styles.css` — estilos y transiciones
- `carousel.js` — lógica (lee `config.json`, obtiene las imágenes y las anima)
- `config.json` — **lo único que tienes que editar**

## Configuración (`config.json`)

```json
{
  "driveFolderUrl": "https://drive.google.com/drive/folders/ID_DE_LA_CARPETA",
  "apiKey": "TU_API_KEY_DE_GOOGLE",
  "intervalMs": 5000,
  "transitionMs": 1000,
  "transition": "fade",
  "shuffle": false,
  "showArrows": true,
  "showDots": true,
  "pauseOnHover": true,
  "fallbackImages": []
}
```

| Clave            | Descripción                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `driveFolderUrl` | URL (o ID) de la carpeta de Drive **compartida públicamente**.     |
| `apiKey`         | API key de Google con la *Drive API* habilitada (ver abajo).       |
| `intervalMs`     | Milisegundos entre imágenes.                                       |
| `transitionMs`   | Duración de la transición.                                         |
| `transition`     | `fade`, `slide` o `zoom`.                                          |
| `shuffle`        | `true` para orden aleatorio.                                       |
| `showArrows`     | Muestra/oculta las flechas.                                        |
| `showDots`       | Muestra/oculta los puntos indicadores.                            |
| `pauseOnHover`   | Pausa el avance automático al pasar el ratón.                     |
| `fallbackImages` | Lista manual (IDs o URLs) usada si no hay `apiKey`. Ver abajo.     |

## Cómo listar la carpeta automáticamente (recomendado)

Para que la web lea la carpeta sola necesitas una **API key**:

1. Entra en https://console.cloud.google.com/ y crea (o usa) un proyecto.
2. Habilita **Google Drive API** (APIs y servicios → Biblioteca).
3. Crea una credencial → **Clave de API** y pégala en `apiKey`.
4. En Drive, comparte la carpeta como **"Cualquier persona con el enlace"**.
5. Copia la URL de la carpeta en `driveFolderUrl`.

La página listará todas las imágenes de la carpeta y se actualizará al recargar
si añades o quitas fotos en Drive.

## Sin API key (modo manual)

Si prefieres no usar API key, deja `apiKey` vacío y rellena `fallbackImages`
con los IDs de cada archivo (o URLs completas):

```json
"fallbackImages": ["1AbC...xyz", "1DeF...uvw"]
```

El ID es la parte de la URL del archivo:
`https://drive.google.com/file/d/`**`1AbC...xyz`**`/view`

> Nota: este modo no detecta cambios en la carpeta automáticamente; hay que
> editar la lista a mano.

## Cómo abrirla

Por las restricciones de seguridad del navegador, `config.json` no se puede
leer abriendo el HTML con doble clic (`file://`). Sirve la carpeta con un
servidor local, por ejemplo:

```bash
python3 -m http.server 8000
```

Y abre http://localhost:8000 en el navegador.
