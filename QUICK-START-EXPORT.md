# Quick Start: HTML Export Testing Guide

## 🚀 Opción 1: Ver Ejemplo Completo

1. Abre [example-html-export.html](./example-html-export.html) directamente en tu navegador
   - ✅ Escena completamente funcional con 6 objetos
   - ✅ Todos los materiales y ajustes listos
   - ✅ Interacción total (mouse, zoom, pan)
   - ✅ Sin requiere servidor

**Resultado esperado:**
- Escena oscura con iluminación profesional
- Cubos, esferas, cilindro y plano
- Controles responsivos

---

## 🎮 Opción 2: Cargar Demo en Editor + Exportar

### Paso 1: Abrir RenderHub Editor

```bash
# En la terminal, desde la carpeta del proyecto:
cd 3d-editor
# Abre index.html en tu navegador
open index.html
# o en Windows:
start index.html
```

### Paso 2: Cargar Escena Demo (Consola del Navegador)

Presiona **F12** para abrir Developer Tools → Console

Copia y ejecuta:

```javascript
// Importar loader
import { loadDemoScene } from './commands/DemoSceneLoader.js';

// Cargar escena (necesitarás las referencias globales)
// Alternativamente, crea objetos manualmente...
```

**O crear objetos manualmente:**

```javascript
// En la consola (F12):

// 1. Agregar un cubo
document.querySelector('[data-type="box"]').click();

// 2. Agregar una esfera
document.querySelector('[data-type="sphere"]').click();

// 3. Agregar un plano
document.querySelector('[data-type="plane"]').click();

// 4. Cambiar colores usando Terminal
// Presiona Enter en la terminal (abajo) y ejecuta:
// color [objeto-id] #ff0000
```

### Paso 3: Exportar a HTML

1. Haz clic en el botón **🌐 Export HTML** (barra superior derecha)
2. Se pedirá un nombre: ingresa `mi-escena-prueba`
3. Se descargará `mi-escena-prueba.html`
4. Abre el archivo descargado en tu navegador

### Paso 4: Interactuar

- **Arrastra con botón izquierdo**: Rota la cámara
- **Rueda del ratón**: Zoom
- **Clic derecho + arrastra**: Paneo
- **Ver información**: Panel superior izquierdo muestra conteo de objetos y FPS

---

## 📋 Opciones de Prueba Rápida

### Prueba 1: Escena Mínima
```
1. Abre RenderHub
2. Agrega 1 cubo
3. Exporta como HTML
4. Abre y verifica interacción básica
```
**Tamaño esperado:** ~45 KB

### Prueba 2: Escena Compleja
```
1. Agrega 10 objetos variados
2. Cambia materiales a diferentes presets
3. Personaliza posiciones y rotaciones
4. Exporta
5. Abre y verifica que todo se renderice correctamente
```
**Tamaño esperado:** ~50-80 KB

### Prueba 3: Materiales
```
1. Crea un cubo
2. Aplica material "gold" (dorado)
3. Crea una esfera
4. Aplica material "glass" (vidrio)
5. Crea un plano
6. Aplica material "matte" (mate)
7. Exporta
8. Verifica que los materiales se vean correctamente
```

### Prueba 4: Transformaciones
```
1. Crea varios cubos
2. Rota, escala y posiciona cada uno diferente
3. Exporta y verifica que las transformaciones se mantengan
```

---

## ✅ Checklist de Validación

Después de exportar, verifica en el archivo HTML generado:

- [ ] La página carga sin errores (consola vacía)
- [ ] La escena aparece renderizada
- [ ] Los objetos tienen el color correcto
- [ ] Las posiciones son las esperadas
- [ ] Las rotaciones se mantienen
- [ ] Las escalas son correctas
- [ ] La interacción del mouse funciona
- [ ] El zoom funciona con la rueda
- [ ] El paneo funciona con clic derecho
- [ ] El FPS se actualiza (panel superior)
- [ ] Las sombras se ven correctas

---

## 🐛 Troubleshooting

### Problema: "Three.js no está definido"
**Solución:** Verifica conexión a internet (Three.js se carga desde CDN)

### Problema: La escena está negra/vacía
**Solución:** 
- Verifica que agregaste objetos al editor
- Comprueba que los objetos tienen posiciones visibles
- Intenta hacer zoom out con la rueda

### Problema: Los materiales no se ven como esperado
**Solución:**
- Los presets use roughness/metalness estándar
- Verifica colores en formato hexadecimal (#rrggbb)
- La transparencia requiere navegadores modernos

### Problema: El archivo es muy grande (>500 KB)
**Solución:**
- Reduce el número de objetos
- Simplifica la geometría (usa menos segmentos)
- Nota: Actualmente se embebe todo - próximas versiones incluirán compresión

---

## 📊 Ejemplos de Tamaño

| Tipo | Objetos | Tamaño | Tiempo Carga |
|------|---------|--------|-------------|
| Mínimo | 1 | ~45 KB | <100ms |
| Pequeño | 5 | ~50 KB | <150ms |
| Medio | 10 | ~60 KB | <200ms |
| Grande | 20 | ~100 KB | <300ms |

*Tamaños aproximados sin compresión gzip (con gzip: -60%)*

---

## 🔧 Técnicas Avanzadas

### Embeber en una página web

```html
<div style="width: 100%; height: 600px;">
  <iframe 
    src="mi-escena-prueba.html"
    style="width: 100%; height: 100%; border: none;">
  </iframe>
</div>
```

### Personalizar tamaño

Abre el HTML exportado y modifica:
```javascript
renderer.setSize(800, 600);  // Ancho x Alto en píxeles
```

### Cambiar color de fondo

En el HTML exportado, busca:
```javascript
scene.background = new THREE.Color(0x2b2b2b);
// Cambia 0x2b2b2b por tu color en hexadecimal
```

### Ajustar velocidad de interacción

En el HTML exportado, busca:
```javascript
rotationSpeed: 0.005,  // Aumenta para rotar más rápido
panSpeed: 0.01,        // Aumenta para paneo más rápido
zoomSpeed: 5           // Aumenta para zoom más sensible
```

---

## 📚 Archivos de Referencia

- [HTMLEmbeddedExporter.js](./3d-editor/export/HTMLEmbeddedExporter.js) - Código fuente del exportador
- [example-html-export.html](./example-html-export.html) - Ejemplo completo
- [HTML-EXPORT-GUIDE.md](./HTML-EXPORT-GUIDE.md) - Guía completa del usuario
- [DemoSceneLoader.js](./3d-editor/commands/DemoSceneLoader.js) - Script para cargar demo

---

## 🎯 Próximos Pasos

1. ✅ Prueba la escena de ejemplo
2. ✅ Exporta tu primera escena desde el editor
3. ✅ Personaliza materiales y transformaciones
4. ✅ Comparte el archivo HTML con otros
5. 📋 Actualmente en desarrollo: Soporte para texturas de imagen

---

**¡Listo para exportar! 🚀**
