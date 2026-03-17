# 🎬 Generador de Páginas Atmosféricas Inmersivas (ATMOS)

Crea experiencias web 3D narrativas similares a **[atmos.leeroy.ca](https://atmos.leeroy.ca/)** usando solo **PowerShell**.

---

## 🚀 Uso Rápido

### Opción 1: Generador Automático (Recomendado)

```powershell
# Abre PowerShell en la carpeta del proyecto y ejecuta:
.\create-story-viewer.ps1 -projectName "mi-historia" -scenes 5 -openBrowser
```

**Parámetros:**
- `-projectName` — Nombre de tu proyecto (default: `atmospheric-story`)
- `-scenes` — Número de escenas/planos (default: `5`, máx: `10`)
- `-openBrowser` — Abre automáticamente en navegador

---

### Opción 2: Generador Interactivo (Personalizado)

```powershell
# Ejecuta el script interactivo:
.\create-story-viewer-interactive.ps1
```

**Proceso:**
1. Ingresa nombre del proyecto
2. Especifica número de escenas
3. Para cada escena, escribe:
   - **Título** (ej: "El Comienzo")
   - **Descripción** (la historia/contenido)
4. Se crea automáticamente y se abre en navegador

---

## 📋 Ejemplos de Comandos

### Ejemplo 1: Historia Corta (3 escenas)
```powershell
.\create-story-viewer.ps1 -projectName "viaje-espacial" -scenes 3 -openBrowser
```

### Ejemplo 2: Narrativa Completa (8 escenas)
```powershell
.\create-story-viewer.ps1 -projectName "historia-épica" -scenes 8
```

### Ejemplo 3: Interactivo (Pasos guiados)
```powershell
.\create-story-viewer-interactive.ps1
```

---

## 🎨 Lo que se Genera

Cada proyecto incluye:

```
mi-proyecto/
├── index.html          ← Abierto directamente en navegador
├── README.md           ← Documentación del proyecto
└── data.json          ← Datos de escenas (si es interactivo)
```

**Características del HTML generado:**

✨ **Escena 3D Inmersiva**
- Planos flotantes con contenido
- Iluminación cinemática (cyan, magenta, azul)
- Rotaciones y movimientos sutiles

🎮 **Navegación Responsiva**
- **Rueda del ratón** — Navegar entre escenas
- **Flechas arriba/abajo** — Navegación por teclado
- **Transiciones suaves** con easing cúbico

📊 **Panel de Control**
- Indicador de escena actual
- Barra de progreso animada
- Contador FPS

---

## 🎯 Estructura de una Escena

Cada plano generado contiene:

```html
<div class="scene-content">
    <div class="content-wrapper">
        <h2>Título de la Escena</h2>
        <p>Contenido narrativo aquí</p>
        <p class="scroll-hint">↓ Desplázate para continuar ↓</p>
    </div>
</div>
```

---

## ✏️ Personalización

Después de generar el proyecto, puedes editar `index.html`:

### Cambiar Colores
Busca y reemplaza:
- `#00d4ff` → Color cyan (cambiar a `#ff00ff`, `#00ff00`, etc.)
- `#0a0e27` → Color de fondo (oscuro por defecto)
- `#1a1f3a` → Color gradient

### Cambiar Contenido
Dentro del script, busca la sección `SCENE_CONTENT`:
```javascript
const scenesText = {
    'scene-1': { title: 'Nuevo Título', content: 'Tu contenido aquí' },
    // ...
}
```

### Ajustar Animaciones
- `duration: 2000` — Tiempo de transición entre escenas
- `rotationSpeed: 0.0005` — Velocidad de rotación de planos
- `emissiveIntensity: 0.1` — Luminosidad propia de los planos

---

## 🔧 Troubleshooting

### "El script no se ejecuta"
```powershell
# Permitir ejecución de scripts (una sola vez):
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
```

### "No abre en navegador"
```powershell
# Abre manualmente el archivo:
cd mi-historia
start index.html
```

### "Quiero más/menos escenas"
```powershell
# Ejecuta de nuevo con diferente número:
.\create-story-viewer.ps1 -projectName "mi-historia-v2" -scenes 10
```

---

## 📐 Especificaciones Técnicas

| Aspecto | Detalle |
|---------|--------|
| **Motor 3D** | Three.js r128 (CDN) |
| **Formato de salida** | HTML5 standalone |
| **Tamaño típico** | 150-200 KB |
| **Navegadores soportados** | Chrome 90+, Firefox 87+, Safari 14+, Edge 90+ |
| **Dependencias externas** | Solo Three.js (CDN) |
| **Responsivo** | Sí (adapta a móvil) |

---

## 🎬 Ejemplo de Contenido

Si ejecutas:
```powershell
.\create-story-viewer-interactive.ps1
```

Y ingresas:

```
Nombre: "El Viaje del Astronauta"
Escenas: 3

Escena 1:
  Título: "El Despegue"
  Descripción: "Hace mil años, mirando las estrellas..."

Escena 2:
  Título: "En el Espacio"
  Descripción: "La vastedad infinita se extiende antes de nosotros..."

Escena 3:
  Título: "Llegada"
  Descripción: "Finalmente encontramos nuestro nuevo hogar..."
```

Se genera una **experiencia completamente funcional** con navegación fluida.

---

## 🚀 Próximas Mejoras Planeadas

- [ ] Soporte para imágenes/videos en planos
- [ ] Sonido ambiental y música
- [ ] Animaciones de aparición de texto
- [ ] Marcapáginas y progreso persistente
- [ ] Exportación a múltiples formatos
- [ ] Integración con Google Analytics

---

## 📚 Comparación: Manual vs Automatizado

| Característica | Manual HTML | Script Automático |
|----------------|------------|------------------|
| Tiempo generación | 30+ minutos | 1 minuto |
| Requiere conocimiento | Three.js, WebGL | Solo ejecutar comando |
| Personalizable | Sí, total | Sí, moderado |
| Mantenimiento | Complejo | Sencillo |
| Reproducibilidad | Baja | Alta |

---

## 💡 Consejos Pro

1. **Usa nombres descriptivos:**
   ```powershell
   .\create-story-viewer.ps1 -projectName "historia-del-viaje-interdimensional" -scenes 7
   ```

2. **Genera versiones:**
   ```powershell
   # v1
   .\create-story-viewer.ps1 -projectName "historia-v1" -scenes 5
   
   # v2 con ajustes
   .\create-story-viewer.ps1 -projectName "historia-v2" -scenes 8
   ```

3. **Combina con RenderHub:**
   Usa el HTMLEmbeddedExporter de RenderHub para exportar escenas 3D personalizadas,
   luego combina con este generador.

---

## 📞 Soporte

Para problemas o sugerencias, revisa:
- [README.md] incluido en cada proyecto generado
- Las funciones en los scripts `.ps1`
- La consola del navegador (F12) para errores Three.js

---

**Creado con ❤️ para historiadores, diseñadores y creativos 3D**

*Inspired by [atmos.leeroy.ca](https://atmos.leeroy.ca/) - A creative exploration of atmospheric narratives*
