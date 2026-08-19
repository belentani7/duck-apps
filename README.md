# DUCK APPS

Colección de tres experiencias web estáticas para el ecosistema Duck: un índice de proyectos, una estación musical táctil y una DAW experimental para navegador.

## Aplicaciones

| Ruta | Producto | Uso principal |
| --- | --- | --- |
| `/` | iDuck | Índice visual de proyectos y enlaces del ecosistema. |
| `/station/` | DUCK STATION | Sintetizador, pads de batería, secuenciador, efectos y grabación WAV. |
| `/fl/` | DUCK FL STUDIO | Entorno de producción musical experimental con piano roll, playlist, mixer y exportación. |

## Desarrollo local

No hay servidor ni dependencias de runtime: las aplicaciones son archivos HTML autocontenidos y pueden abrirse directamente en un navegador. Para servirlas localmente con un servidor HTTP, ejecuta desde la raíz:

```bash
python3 -m http.server 8000
```

Después abre `http://localhost:8000/`. El servidor HTTP local es recomendable para probar rutas relativas, descarga de archivos y APIs del navegador.

## Validación

La validación automatizada comprueba que todos los bloques JavaScript embebidos son sintácticamente válidos:

```bash
node scripts/validate-inline-js.mjs
```

La misma comprobación se ejecuta en GitHub Actions para cada push a `main` y cada pull request dirigido a `main`.

## Compatibilidad y permisos del navegador

DUCK STATION y DUCK FL STUDIO dependen de APIs de audio del navegador. El audio suele requerir una interacción inicial del usuario, y la grabación WAV requiere permiso para usar el micrófono cuando esa funcionalidad se activa. El comportamiento puede variar entre navegadores de escritorio y móviles.

## Principios de mantenimiento

Las aplicaciones permanecen deliberadamente autocontenidas para facilitar su publicación como sitio estático. Los cambios de funcionalidad deben acompañarse de una prueba manual en las rutas afectadas y de la validación de sintaxis. Los enlaces externos que abren una nueva pestaña deben conservar `rel="noopener noreferrer"`.
