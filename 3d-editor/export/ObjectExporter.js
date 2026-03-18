/* ═══════════════════════════════════════════════════════════════
   ObjectExporter — Export a single scene object as STL or GLB
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { STLExporter as ThreeSTLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export class ObjectExporter {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this._stlExp  = new ThreeSTLExporter();
    this._gltfExp = new GLTFExporter();
  }

  /* ── STL ────────────────────────────────────────────────────── */

  /**
   * Export a single ObjectRecord as a binary STL with baked world transforms.
   * @param {import('../objects/ObjectManager.js').ObjectRecord} record
   * @returns {{ success: boolean, message: string }}
   */
  exportSTL(record) {
    if (!record?.mesh) return { success: false, message: 'Ningún objeto seleccionado.' };

    this.scene.updateMatrixWorld(true);

    const tempGroup = new THREE.Group();
    const clonedGeos = [];

    record.mesh.traverse(child => {
      if (!child.isMesh || !child.geometry) return;
      const geo = child.geometry.clone();
      geo.applyMatrix4(child.matrixWorld);
      geo.computeVertexNormals();
      tempGroup.add(new THREE.Mesh(geo, child.material));
      clonedGeos.push(geo);
    });

    if (clonedGeos.length === 0) {
      return { success: false, message: `"${record.name}" no tiene geometría exportable.` };
    }

    const data = this._stlExp.parse(tempGroup, { binary: true });
    clonedGeos.forEach(g => g.dispose());

    const filename = `${_safeName(record.name)}.stl`;
    _download(new Blob([data], { type: 'application/octet-stream' }), filename);

    const kb = (data.byteLength / 1024).toFixed(1);
    return { success: true, message: `✓ Exportado STL "${filename}" (${kb} KB)` };
  }

  /* ── GLB (Three.js-compatible) ──────────────────────────────── */

  /**
   * Export a single ObjectRecord as a .glb file (Three.js / GLTF 2.0).
   * The object is placed at origin in the exported file.
   * @param {import('../objects/ObjectManager.js').ObjectRecord} record
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  exportGLB(record) {
    if (!record?.mesh) {
      return Promise.resolve({ success: false, message: 'Ningún objeto seleccionado.' });
    }

    this.scene.updateMatrixWorld(true);

    // Deep-clone and reset transforms so the GLB is at origin
    const clone = record.mesh.clone(true);
    clone.name = record.name;

    // Clear world-space offsets; geometry stays in local space
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);

    const filename = `${_safeName(record.name)}.glb`;

    return new Promise((resolve) => {
      this._gltfExp.parse(
        clone,
        (glb) => {
          const blob = new Blob([glb], { type: 'model/gltf-binary' });
          _download(blob, filename);
          const kb = (blob.size / 1024).toFixed(1);
          resolve({ success: true, message: `✓ Exportado GLB "${filename}" (${kb} KB)` });
        },
        (err) => {
          resolve({ success: false, message: `Error al exportar GLB: ${err?.message || err}` });
        },
        { binary: true }
      );
    });
  }
}

/* ── Private helpers ─────────────────────────────────────────── */

function _safeName(name) {
  return (name || 'object').replace(/[^\w\-. ]/g, '_').replace(/\s+/g, '_').slice(0, 60);
}

function _download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
