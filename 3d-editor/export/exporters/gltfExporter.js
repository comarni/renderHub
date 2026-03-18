/* ═══════════════════════════════════════════════════════════════
   GLTF/GLB Exporter (pluggable) — Full scene with materials
   ═══════════════════════════════════════════════════════════════
   Conforms to the ExportManager plugin interface.
   Exports all scene objects as a binary GLB file using Three.js
   GLTFExporter. Preserves transforms, PBR materials, mesh names.

   Domain: all (cinematic domain preserves scene object order)
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { downloadBlob, ensureExtension } from './_exportUtils.js';

export class GLTFPluggableExporter {
  get name()      { return 'GLTF'; }
  get extension() { return 'glb'; }
  get label()     { return 'GLTF/GLB — Web / Games / DCC import'; }

  /** @param {string} _domain */
  supports(_domain) { return true; }

  /**
   * @param {import('../ExportManager.js').HubScene} hubScene
   * @param {{ filename?: string, download?: boolean }} options
   * @returns {Promise<{ success: boolean, message: string, blob?: Blob, filename?: string }>}
   */
  export(hubScene, { filename = 'scene', download = true } = {}) {
    const { objects } = hubScene;

    // Build a temporary export group — cloned meshes with world transforms applied.
    // We do NOT reset transforms to origin so the relative placement is preserved.
    const exportGroup = new THREE.Group();
    exportGroup.name  = filename;

    for (const record of objects) {
      const clone = record.mesh.clone(true);
      clone.name  = record.name || record.id;
      exportGroup.add(clone);
    }

    const safeFilename = ensureExtension(filename, 'glb');

    return new Promise((resolve) => {
      new GLTFExporter().parse(
        exportGroup,
        (glb) => {
          const blob = new Blob([glb], { type: 'model/gltf-binary' });
          if (download) downloadBlob(blob, safeFilename);
          const kb = (blob.size / 1024).toFixed(1);
          resolve({
            success:  true,
            message:  `✓ Exported "${safeFilename}" — ${objects.length} object${objects.length !== 1 ? 's' : ''}, ${kb} KB`,
            blob,
            filename: safeFilename,
          });
        },
        (err) => {
          resolve({
            success: false,
            message: `GLTF export error: ${err?.message ?? String(err)}`,
          });
        },
        { binary: true }
      );
    });
  }
}
