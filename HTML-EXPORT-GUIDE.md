# RenderHub HTML Embedded Exporter

## Descripción

El **HTML Embedded Exporter** permite exportar tus escenas 3D de RenderHub como archivos HTML autónomos e interactivos. Cada archivo exportado contiene:

- ✅ **Todos los objetos de la escena** (cubos, esferas, cilindros, planos)
- ✅ **Materiales y texturas** (colores, roughness, metalness, opacidad)
- ✅ **Transformaciones** (posición, rotación, escala)
- ✅ **Iluminación PBR** (luces ambientales, directas, relleno y borde)
- ✅ **Interacción responsiva** (ratón, zoom, paneo)
- ✅ **Renderizado en tiempo real** con Three.js
- ✅ **Standalone** - Sin dependencias externas (excepto Three.js desde CDN)

---

## Cómo Usar

### 1. Exportar desde RenderHub

1. Crea tu escena en **RenderHub 3D Editor** (`./3d-editor/`)
   - Agrega cubos, esferas, cilindros y planos
   - Personaliza colores y materiales
   - Posiciona y escala los objetos

2. Haz clic en el botón **🌐 Export HTML** en la barra de herramientas

3. Se te pedirá un nombre de archivo (ej: `mi-escena-3d`)

4. Se descargará un archivo `mi-escena-3d.html` listo para usar

### 2. Ver la Escena Exportada

- Abre el archivo HTML generado en cualquier navegador web
- Interactúa con los objetos:
  - **Arrastra con el botón izquierdo**: Rota la cámara
  - **Rueda del ratón**: Zoom in/out
  - **Clic derecho + arrastra**: Paneo

---

## Archivo de Ejemplo

Se incluye **`example-html-export.html`** como demostración con:

- 🟨 Un cubo dorado metálico con rotación
- 🔵 Una esfera de vidrio transparente
- 🟫 Una esfera de goma mate
- 🟩 Un cilindro cromado
- 🏞️ Un plano de piso de madera
- 🔲 Un plano de suelo gris

**Abre este archivo directamente en tu navegador para ver una escena funcional completamente.**

---

## Estructura Técnica

### Datos Serializados

Cada escena exportada contiene un objeto JSON embebido con:

```javascript
{
  "background": "#2b2b2b",        // Color de fondo
  "objects": [
    {
      "name": "Cube.001",
      "type": "box",              // "box", "sphere", "cylinder", "plane"
      "position": [0, 0.5, 0],    // [x, y, z]
      "rotation": [0, 0.5, 0.3],  // [x, y, z] en radianes
      "scale": [1, 1, 1],         // [x, y, z]
      "material": {
        "color": "#ffc060",        // Color hexadecimal
        "roughness": 0.2,          // 0.0 - 1.0
        "metalness": 1.0,          // 0.0 - 1.0
        "transparent": false,      // true/false
        "opacity": 1.0             // 0.0 - 1.0
      },
      "geometryParams": { ... }
    }
  ]
}
```

### Renderización

- **Motor**: Three.js r128 (desde CDN)
- **Iluminación**: 4 luces directionales configuradas profesionalmente
- **Sombras**: PCF Shadow Map 2048x2048
- **Tone Mapping**: ACESFilmic

### Interacción

Implementada con:
- Quaternione-based camera rotation
- Smooth zoom y paneo
- Event listeners de mouse nativo (sin librerías externas)

---

## Casos de Uso

✨ **Portafolio Web**: Integra demostraciones 3D en tu sitio web
🎓 **Educación**: Comparte modelos 3D interactivos
🛍️ **E-commerce**: Visualización de productos 3D
📊 **Presentaciones**: Embebe escenas 3D en presentaciones web
🎮 **Visualización**: Previsualizaciones rápidas de diseños

---

## Integración en Sitios Web

Puedes embeber los archivos exportados directamente en tu sitio:

```html
<iframe 
  src="mi-escena-3d.html" 
  width="100%" 
  height="600"
  style="border: none; border-radius: 8px;">
</iframe>
```

---

## Limitaciones Actuales

- Los archivos generados son **HTML puros** (sin servidor requerido)
- Materiales limitados a **MeshStandardMaterial** (PBR básico)
- Sin soporte para texturas de mapa de bits personalizadas (próximas versiones)
- Máximo rendimiento en navegadores modernos (Chrome, Firefox, Edge, Safari)

---

## Próximas Mejoras

- 🔲 Soporte para texturas de imagen incrustadas
- 🔲 Más tipos de primitivas geométricas
- 🔲 Animaciones precargadas
- 🔲 Modo VR / WebXR
- 🔲 Compresión de peso de archivos
- 🔲 Exportación de metadatos y anotaciones

---

## Ubicación en el Código

```
3d-editor/
├── export/
│   ├── STLExporter.js          ← Exportación STL
│   ├── HTMLEmbeddedExporter.js ← ✨ NUEVO: Exportación HTML
│   └── ...
├── app.js                      ← Integración del exportador
└── index.html                  ← Botón "🌐 Export HTML"
```

---

**¡Crea, diseña y exporta tus escenas 3D con RenderHub! 🚀**
