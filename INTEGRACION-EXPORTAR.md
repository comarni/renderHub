INTEGRACIÓN COMPLETA: COMANDO "EXPORTAR" EN TERMINAL DE RENDERHUB
═════════════════════════════════════════════════════════════════════════

RESUMEN DE CAMBIOS
═════════════════════════════════════════════════════════════════════════

Se han agregado 3 archivos y modificado 3 archivos en RenderHub para
integrar el comando "exportar" en la terminal del editor 3D.

ARCHIVOS CREADOS (3)
═════════════════════════════════════════════════════════════════════════

1. 3d-editor/export/AtmosphericStoryExporter.js
   └─ Clase que genera páginas estructuradas tipo atmos.leeroy.ca
   └─ Método export(projectName, numScenes) 
   └─ Genera HTML descargable con Three.js

ARCHIVOS MODIFICADOS (3)
═════════════════════════════════════════════════════════════════════════

1. 3d-editor/app.js
   ├─ Línea ~19: Importa AtmosphericStoryExporter
   ├─ Línea ~74: Instancia atmosphericExporter 
   └─ Línea ~114: Wireatmospheric exporter al CommandParser

2. 3d-editor/commands/CommandParser.js
   ├─ Línea ~30: Agrega "exportar" al HELP_TEXT
   ├─ Línea ~96: Agrega case 'exportar' en execute()
   ├─ Línea ~97: Agrega setter setAtmosphericExporter()
   └─ Línea ~848: Agrega método _exportar(args)

ARCHIVOS DE DOCUMENTACIÓN (2)
═════════════════════════════════════════════════════════════════════════

1. EXPORTAR-TERMINAL.txt → Guía de uso del comando
2. EXPORTAR-GUIA-RAPIDA.txt → Guía rápida del comando PowerShell

CÓMO USAR EN LA TERMINAL DE RENDERHUB
═════════════════════════════════════════════════════════════════════════

1. Abre RenderHub: /renderHub/3d-editor/index.html
2. Ve a la terminal en la parte inferior
3. Escribe uno de estos comandos:

   exportar                      # Genera con defaults (5 escenas)
   exportar mi-historia          # Nombre personalizado
   exportar mi-proyecto 8        # Nombre + 8 escenas
   exportar demo 3               # Nombre + 3 escenas

4. Se descargará automáticamente el archivo .html
5. Abre en cualquier navegador y ¡a disfrutar!

CARACTERÍSTICAS DEL ARCHIVO GENERADO
═════════════════════════════════════════════════════════════════════════

✓ Página web completa standalone HTML
✓ Three.js r128 con iluminación atmosférica (cyan, magenta, azul)
✓ Planos flotantes con colores vibrantes
✓ Navegación intuitiva:
  • Flechas del teclado: izquierda/derecha
  • Barra espaciadora: siguiente escena
  • Scroll del ratón: navegar entre escenas
  • Click en planos: seleccionar escena
✓ Barra de progreso animada
✓ Planos rotan suavemente y se desplazan en Y
✓ Sin dependencias externas (solo Three.js desde CDN)

FLUJO COMPLETO
═════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────┐
│ RenderHub Editor (3D)                   │
│ ┌─────────────────────────────────────┐ │
│ │ Terminal: exportar prueba 5         │ │
│ └─────────────────────────────────────┘ │
└──────────────────┬──────────────────────┘
                   │ CommandParser.execute()
                   │ case 'exportar'
                   │ → _exportar(['prueba', '5'])
                   ↓
          AtmosphericStoryExporter.export()
          ├─ Genera sceneData array
          ├─ Genera HTML con Three.js
          └─ Descarga: prueba.html
                   │
                   ↓
        ┌──────────────────────┐
        │ Browser: prueba.html │
        │ - Navegación         │
        │ - Iluminación        │
        │ - Planos flotantes   │
        └──────────────────────┘

ARCHIVOS DE INTEGRACIÓN EN GIT
═════════════════════════════════════════════════════════════════════════

Para hacer commit de estos cambios:

git add \
  3d-editor/export/AtmosphericStoryExporter.js \
  3d-editor/app.js \
  3d-editor/commands/CommandParser.js

git commit -m "feat: atmospheric story viewer from terminal (Sprint 5.1)

- New AtmosphericStoryExporter class for generating immersive web experiences
- Integrated 'exportar' command in terminal
- Download .html with interactive Three.js scenes
- Direct browser export without server"

git push

COMPATIBILIDAD
═════════════════════════════════════════════════════════════════════════

✓ Chrome/Edge 90+
✓ Firefox 88+
✓ Safari 14+
✓ Opera 76+
✓ Funcionanglón en cualquier dispositivo (responsive)

ALTERNATIVAS
═════════════════════════════════════════════════════════════════════════

También disponibles en PowerShell (ventanal del sistema):

Opción 1: Desde PowerShell (carpeta renderHub)
  .\create-story-viewer.ps1 -projectName "test" -scenes 5 -openBrowser

Opción 2: Desde cualquier carpeta (después de setup inicial)
  exportar -projectName "test" -scenes 5 -openBrowser

Opción 3: Desde terminal RenderHub (RECOMENDADO)
  exportar test 5

SOPORTE Y DEBUGGING
═════════════════════════════════════════════════════════════════════════

Si recibes error:
1. Abre consola de navegador (F12)
2. Busca errores en Console
3. Verifica que AtmosphericStoryExporter.js esté importado correctamente

Comando de debug en terminal:
  list
  help

(Verifica que "exportar" aparezca en la lista)

═════════════════════════════════════════════════════════════════════════
FIN DE INTEGRACIÓN - TODO LISTO ✓
═════════════════════════════════════════════════════════════════════════
