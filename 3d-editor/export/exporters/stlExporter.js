/* ═══════════════════════════════════════════════════════════════
   STL Exporter (pluggable) — Binary STL with baked world transforms
   ═══════════════════════════════════════════════════════════════
   Conforms to the ExportManager plugin interface.
   Traverses every mesh in every ObjectRecord, bakes its world
   transform into the geometry, and writes binary STL.

   Domain: all (industrial gets best precision by default)
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { STLExporter as ThreeSTLExporter } from 'three/addons/exporters/STLExporter.js';
import { downloadBlob, ensureExtension } from './_exportUtils.js';

export class STLPluggableExporter {
  get name()      { return 'STL'; }
  get extension() { return 'stl'; }
  get label()     { return 'STL — 3D Printing / CNC / CAD'; }

  /** @param {string} _domain */
  supports(_domain) { return true; }

  /**
   * @param {import('../ExportManager.js').HubScene} hubScene
   * @param {{ filename?: string, download?: boolean }} options
   * @returns {{ success: boolean, message: string, blob?: Blob, filename?: string }}
   */
  export(hubScene, { filename = 'scene', download = true } = {}) {
    const { objects, scene } = hubScene;

    // Build temporary group: clone + bake world-space transforms
    const exportGroup = new THREE.Group();
    const clonedGeos  = [];

    for (const record of objects) {
      record.mesh.traverse(child => {
        if (!child.isMesh || !child.geometry) return;
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        geo.computeVertexNormals();
        exportGroup.add(new THREE.Mesh(geo, child.material));
        clonedGeos.push(geo);
      });
    }

    if (clonedGeos.length === 0) {
      return { success: false, message: 'No exportable geometry found in scene.' };
    }

    const stlData      = new ThreeSTLExporter().parse(exportGroup, { binary: true });
    clonedGeos.forEach(g => g.dispose());

    const safeFilename = ensureExtension(filename, 'stl');
    const blob         = new Blob([stlData], { type: 'application/octet-stream' });

    if (download) downloadBlob(blob, safeFilename);

    const kb = (stlData.byteLength / 1024).toFixed(1);
    return {
      success:  true,
      message:  `✓ Exported "${safeFilename}" — ${objects.length} object${objects.length !== 1 ? 's' : ''}, ${kb} KB`,
      blob,
      filename: safeFilename,
    };
  }
}
