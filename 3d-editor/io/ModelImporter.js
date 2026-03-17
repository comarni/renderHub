/* ═══════════════════════════════════════════════════════════════
   ModelImporter — Import GLTF/GLB and OBJ files into the scene
   ═══════════════════════════════════════════════════════════════
   Works via:
     - Drag & drop onto the viewport
     - File picker (btn-import button)
     - import <filename> command (delegates to file picker)
   ═══════════════════════════════════════════════════════════════ */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader }  from 'three/addons/loaders/OBJLoader.js';
import * as THREE     from 'three';
import { EventBus }   from '../core/EventBus.js';

export class ModelImporter {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager} objectManager
   */
  constructor(objectManager) {
    this.objs  = objectManager;
    this._gltf = new GLTFLoader();
    this._obj  = new OBJLoader();

    this._setupDragDrop();
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /** Open system file picker and import the selected file. */
  openPicker() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.gltf,.glb,.obj';

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) this._importFile(file);
    });

    input.click();
  }

  /* ── Drag & Drop ────────────────────────────────────────────── */

  _setupDragDrop() {
    const viewport = document.getElementById('viewport-canvas')
                  || document.getElementById('viewport-wrapper');
    if (!viewport) return;

    viewport.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      viewport.classList.add('drag-over');
    }, { passive: false });

    viewport.addEventListener('dragleave', () => {
      viewport.classList.remove('drag-over');
    });

    viewport.addEventListener('drop', e => {
      e.preventDefault();
      viewport.classList.remove('drag-over');
      const files = [...e.dataTransfer.files];
      const supported = files.filter(f => /\.(gltf|glb|obj)$/i.test(f.name));
      if (!supported.length) {
        EventBus.emit('terminal:log', {
          type: 'error',
          message: 'Drop a .gltf, .glb, or .obj file to import it.',
        });
        return;
      }
      supported.forEach(f => this._importFile(f));
    });
  }

  /* ── File loading ───────────────────────────────────────────── */

  _importFile(file) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const url  = URL.createObjectURL(file);
    const base = file.name.replace(/\.[^.]+$/, '');

    EventBus.emit('terminal:log', {
      type: 'info',
      message: `Importing "${file.name}"…`,
    });

    if (ext === 'glb' || ext === 'gltf') {
      this._loadGLTF(url, base, file.name);
    } else if (ext === 'obj') {
      this._loadOBJ(url, base, file.name);
    }
  }

  _loadGLTF(url, baseName, originalName) {
    this._gltf.load(
      url,
      gltf => {
        URL.revokeObjectURL(url);
        const root = gltf.scene;

        this._centerAndFloor(root);
        const name = this._uniqueName(baseName);
        const rec  = this.objs.addGroup(root, name, 'gltf');

        EventBus.emit('terminal:log', {
          type: 'info',
          message: `✓ Imported "${originalName}" as "${name}"`,
        });
        EventBus.emit('state:changed', { type: 'scene' });
      },
      undefined,
      err => {
        URL.revokeObjectURL(url);
        EventBus.emit('terminal:log', {
          type: 'error',
          message: `Failed to import "${originalName}": ${err.message || err}`,
        });
      }
    );
  }

  _loadOBJ(url, baseName, originalName) {
    this._obj.load(
      url,
      group => {
        URL.revokeObjectURL(url);

        // Assign a default grey StandardMaterial if the OBJ has MeshPhongMaterial
        group.traverse(child => {
          if (child.isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
            if (!child.material || child.material.isMeshPhongMaterial) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x909090,
                roughness: 0.7,
                metalness: 0.0,
              });
            }
          }
        });

        this._centerAndFloor(group);
        const name = this._uniqueName(baseName);
        const rec  = this.objs.addGroup(group, name, 'obj');

        EventBus.emit('terminal:log', {
          type: 'info',
          message: `✓ Imported "${originalName}" as "${name}"`,
        });
        EventBus.emit('state:changed', { type: 'scene' });
      },
      undefined,
      err => {
        URL.revokeObjectURL(url);
        EventBus.emit('terminal:log', {
          type: 'error',
          message: `Failed to import "${originalName}": ${err.message || err}`,
        });
      }
    );
  }

  /* ── Helpers ────────────────────────────────────────────────── */

  /**
   * Centre the model horizontally and place its bottom at y = 0.
   */
  _centerAndFloor(group) {
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());

    // Normalise size: scale down if too big (> 4 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 4) {
      const s = 3 / maxDim;
      group.scale.setScalar(s);
      // Re-compute after scale
      box.setFromObject(group);
      box.getCenter(center);
      box.getSize(size);
    }

    group.position.x -= center.x;
    group.position.z -= center.z;
    group.position.y -= box.min.y;  // floor it
  }

  _uniqueName(base) {
    const trunc = base.slice(0, 20);
    this.objs._counter[trunc] = (this.objs._counter[trunc] || 0) + 1;
    const n = this.objs._counter[trunc];
    return n === 1 ? trunc : `${trunc}.${String(n).padStart(3, '0')}`;
  }
}
