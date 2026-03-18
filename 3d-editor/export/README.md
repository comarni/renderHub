# RenderHub Export Modules

This directory contains the **pluggable export system** for RenderHub 3D scenes.

---

## 🏗️ Architecture

```
export/
  ExportManager.js          ← Central coordinator (registration + dispatch)
  ExportPanel.js            ← Modal UI (format selector, filename, result)
  exporters/
    stlExporter.js          ← STL   (3D printing / CAD / CNC)
    gltfExporter.js         ← GLTF/GLB (web / games / DCC)
    jsonExporter.js         ← JSON / .hub (backup / debug)
    htmlExporter.js         ← HTML (standalone interactive viewer)
    _exportUtils.js         ← Shared helpers (downloadBlob, ensureExtension)
  STLExporter.js            ← Legacy (full-scene STL, used by CommandParser)
  HTMLEmbeddedExporter.js   ← Legacy (used by legacy toolbar + HTML wrapper)
  ObjectExporter.js         ← Single-object STL/GLB (used by PropertiesPanel)
  AtmosphericStoryExporter.js ← Atmospheric story HTML
```

---

## 🔌 Exporter Interface

Every pluggable exporter must implement:

```js
{
  get name():      string          // 'STL' | 'GLTF' | 'JSON' | 'HTML' | …
  get extension(): string          // 'stl' | 'glb'  | 'hub'  | 'html' | …
  get label():     string          // Human-readable description shown in UI
  supports(domain: string): boolean
  export(hubScene: HubScene, options: ExportOptions): ExportResult | Promise<ExportResult>
}
```

### HubScene (passed to every exporter)

```js
{
  name:            string,
  version:         number,
  objects:         ObjectRecord[],    // objectManager.list()
  scene:           THREE.Scene,
  objectManager:   ObjectManager,
  materialManager: MaterialManager,
  cad: {
    operations:             OpEntry[],
    suppressedOperationIds: string[],
    undoneOperationIds:     string[],
  },
  snapSettings:    SnapSettings,
  metadata: {
    domain:      string,              // 'industrial' | 'cinematic' | 'default'
    createdAt:   string,
    exportedAt:  string,
  },
}
```

### ExportResult

```js
{
  success:   boolean,
  message:   string,
  blob?:     Blob,
  text?:     string,
  filename?: string,
}
```

---

## 🚀 Using ExportManager

```js
import { ExportManager }         from './export/ExportManager.js';
import { STLPluggableExporter }  from './export/exporters/stlExporter.js';
import { GLTFPluggableExporter } from './export/exporters/gltfExporter.js';

const manager = new ExportManager({ scene, objectManager, materialManager, cadState });

manager
  .register(new STLPluggableExporter())
  .register(new GLTFPluggableExporter());

// Export
const result = await manager.export('stl', { filename: 'my-part' });
// → { success: true, message: '✓ Exported "my-part.stl" — 3 objects, 14.2 KB', blob }
```

---

## ➕ Adding a New Exporter

```js
// export/exporters/myFormatExporter.js
export class MyFormatExporter {
  get name()      { return 'MYFORMAT'; }
  get extension() { return 'xyz'; }
  get label()     { return 'MyFormat — Description'; }
  supports(_domain) { return true; }
  export(hubScene, { filename, download }) {
    // ... build blob ...
    return { success: true, message: '✓ Done', blob, filename };
  }
}

// In app.js — register without touching ExportManager core:
exportManager.register(new MyFormatExporter());
```

---

## 📦 Available Exporters

| Format | File              | Output      | Notes                          |
|--------|-------------------|-------------|--------------------------------|
| STL    | stlExporter.js    | `.stl`      | Binary, baked world transforms |
| GLTF   | gltfExporter.js   | `.glb`      | Full scene, PBR materials      |
| JSON   | jsonExporter.js   | `.hub`      | Raw .hub, reloadable           |
| HTML   | htmlExporter.js   | `.html`     | Standalone Three.js viewer     |


## 📦 Available Exporters

### 1. **STLExporter.js** (Existing)
Export 3D geometry as binary STL files for 3D printing and CAD software.

**Features:**
- Binary STL format (compact, universally supported)
- Automatic world transform baking
- Direct browser download

**Usage:**
```javascript
const stlExporter = new STLExporter(scene, objectManager);
const result = stlExporter.export('my-model.stl');
```

---

### 2. **HTMLEmbeddedExporter.js** (NEW) ✨
Export interactive 3D scenes as standalone HTML files with full Three.js rendering.

**Features:**
- Self-contained HTML files (no server needed)
- Full scene data serialization
- All primitives: box, sphere, cylinder, plane
- Material support: color, roughness, metalness, transparency
- Lighting: ambient, directional (key/fill/rim), shadows
- Interactions: mouse rotate, pan, zoom
- Responsive design and FPS counter
- Three.js loaded from CDN

**Usage:**
```javascript
const htmlExporter = new HTMLEmbeddedExporter(scene, objectManager, materialManager);
const result = htmlExporter.export('my-scene-export');
// Downloads: my-scene-export.html
```

**Output Size:**
- Typical scene: 50-150 KB
- Includes all JS, CSS, and scene data

---

## 📋 Object Serialization Format

Both exporters work with the same scene structure. HTMLEmbeddedExporter serializes:

```javascript
{
  "background": "#2b2b2b",
  "objects": [
    {
      "id": "obj_unique_id",
      "name": "Cube.001",
      "type": "box",                    // "box"|"sphere"|"cylinder"|"plane"
      "position": [x, y, z],            // [0, 0.5, 0]
      "rotation": [x, y, z],            // radians [0, 0.5, 0.3]
      "scale": [x, y, z],               // [1, 1, 1]
      "material": {
        "color": "#ffc060",             // hexadecimal
        "roughness": 0.2,               // 0.0-1.0
        "metalness": 1.0,               // 0.0-1.0
        "transparent": false,
        "opacity": 1.0                  // 0.0-1.0
      },
      "geometryParams": {
        "type": "box",
        "width": 1,
        "height": 1,
        "depth": 1
      }
    }
  ]
}
```

---

## 🎯 Material Presets

Available material presets (from MaterialManager):

| Preset | Roughness | Metalness | Use Case |
|--------|-----------|-----------|----------|
| plastic | 0.50 | 0.00 | Default smooth plastic |
| metal | 0.15 | 1.00 | Shiny metallic surfaces |
| matte | 0.95 | 0.00 | Non-reflective surfaces |
| glass | 0.05 | 0.00 | Transparent, glossy |
| rubber | 0.90 | 0.00 | Rough, non-reflective |
| chrome | 0.05 | 1.00 | Mirror-like metal |
| gold | 0.20 | 1.00 | Warm metallic |
| wood | 0.80 | 0.00 | Natural wood look |
| concrete | 0.95 | 0.05 | Rough construction |
| ceramic | 0.30 | 0.05 | Glazed surfaces |
| carbon | 0.40 | 0.60 | Industrial carbon fiber |
| velvet | 1.00 | 0.00 | Fabric/velvet |

---

## 🎨 Lighting in Exported Scenes

All exported scenes include a professional PBR lighting setup:

1. **Ambient Light** (0xffffff, intensity: 0.5)
   - Soft fill light from all directions

2. **Key Light** (DirectionalLight)
   - Position: (6, 10, 6)
   - Intensity: 1.5
   - Casts shadows with 2048x2048 resolution
   - Bias: -0.0003 for shadow acne prevention

3. **Fill Light** (DirectionalLight)
   - Position: (-5, 4, -6)
   - Color: 0x8899ff (cool blue)
   - Intensity: 0.4

4. **Rim Light** (DirectionalLight)
   - Position: (0, -5, 0)
   - Intensity: 0.15
   - Creates subtle rim highlights

---

## 💻 Browser Compatibility

**HTMLEmbeddedExporter** works in:
- ✅ Chrome 90+
- ✅ Firefox 87+
- ✅ Safari 14+
- ✅ Edge 90+

Requires WebGL 2.0 support.

---

## 📊 Performance Considerations

- **Three.js Version**: r128 (from CDN)
- **Rendering**: WebGL with anti-aliasing
- **Shadows**: PCF Shadow Maps (high quality)
- **Tone Mapping**: ACESFilmic
- **Target FPS**: 60 (vsync)

---

## 🔧 Extending the Exporters

To add new formats:

1. Create a new exporter class in this directory
2. Follow the same constructor pattern:
   ```javascript
   constructor(scene, objectManager, materialManager)
   ```
3. Implement an `export(filename)` method that returns:
   ```javascript
   { success: boolean, message: string }
   ```
4. Add the exporter to `app.js`
5. Create a button and event listener in `index.html` and `app.js`

Example outline:
```javascript
export class MyFormatExporter {
  constructor(scene, objectManager, materialManager) {
    this.scene = scene;
    this.objs = objectManager;
    this.mat = materialManager;
  }

  export(filename) {
    // Serialize scene
    const data = this._serialize();
    
    // Convert to format
    const formatted = this._convertToFormat(data);
    
    // Download
    this._downloadFile(formatted, filename);
    
    return { success: true, message: 'Export complete' };
  }
}
```

---

## 📚 Related Files

- **HTMLEmbeddedExporter.js** - Main exporter implementation
- **STLExporter.js** - 3D print format exporter
- **DemoSceneLoader.js** - Demo scene for testing
- **../example-html-export.html** - Complete working example
- **../HTML-EXPORT-GUIDE.md** - User documentation

---

## 🧪 Testing

1. Open RenderHub 3D Editor
2. Add objects: `box`, `sphere`, `cylinder`, `plane`
3. Customize materials and transforms
4. Click **🌐 Export HTML** button
5. Enter filename: `test-export`
6. Download `test-export.html`
7. Open in browser - verify interactivity

Alternative quick test:
```bash
# Open example scene directly
open ../example-html-export.html
```

---

## 🐛 Known Limitations

- **No texture bitmaps yet** - Colors and properties only
- **No animations** - Static geometry
- **No physics** - Rendering only
- **Limited to primitives** - box, sphere, cylinder, plane
- **Scene size** - typical ~50-150 KB per scene

---

## 🚀 Future Enhancements

- [ ] Image texture baking and inlining
- [ ] Geometry simplification for smaller files
- [ ] WebP/AVIF image compression
- [ ] Animation keyframe export
- [ ] GLTF/GLB export (for AR/VR)
- [ ] Cloudinary integration for texture hosting
- [ ] Scene metadata and annotations

---

**Created as part of RenderHub Sprint 2022 - Interactive 3D Web Export**
