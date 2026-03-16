/* ═══════════════════════════════════════════════════════════════
   STLExporter — Binary STL export with baked world transforms
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { STLExporter as ThreeSTLExporter } from 'three/addons/exporters/STLExporter.js';

export class STLExporter {
  /**
   * @param {THREE.Scene}                                             scene
   * @param {import('../objects/ObjectManager.js').ObjectManager}     objectManager
   */
  constructor(scene, objectManager) {
    this.scene = scene;
    this.objs  = objectManager;
    this._exporter = new ThreeSTLExporter();
  }

  /**
   * Export all scene objects as a binary STL file and trigger download.
   *
   * IMPORTANT: We must bake world transforms (position/rotation/scale) into the
   * geometry vertices before exporting. Without this, STL slicers receive geometry
   * at the local origin ignoring all transforms.
   *
   * @param {string} filename — output filename (with or without .stl extension)
   * @returns {{ success: boolean, message: string }}
   */
  export(filename = 'scene.stl') {
    const objects = this.objs.list();

    if (objects.length === 0) {
      return { success: false, message: 'Scene is empty. Add objects before exporting.' };
    }

    // Ensure all world matrices are current
    this.scene.updateMatrixWorld(true);

    // Build a temporary group with baked-transform clones
    const exportGroup = new THREE.Group();
    const clonedGeos  = [];

    objects.forEach(record => {
      const mesh = record.mesh;

      // Clone geometry and bake world transform into vertex positions
      const clonedGeo = mesh.geometry.clone();
      clonedGeo.applyMatrix4(mesh.matrixWorld);
      clonedGeo.computeVertexNormals();

      const clonedMesh = new THREE.Mesh(clonedGeo, mesh.material);
      exportGroup.add(clonedMesh);
      clonedGeos.push(clonedGeo);
    });

    // Export as binary STL (more compact, universally supported)
    const stlData = this._exporter.parse(exportGroup, { binary: true });

    // Cleanup clones to free memory
    clonedGeos.forEach(geo => geo.dispose());

    // Ensure .stl extension
    const safeFilename = filename.toLowerCase().endsWith('.stl')
      ? filename
      : filename + '.stl';

    // Trigger browser download
    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const kb = (stlData.byteLength / 1024).toFixed(1);
    return {
      success: true,
      message: `Exported "${safeFilename}" (${objects.length} object${objects.length !== 1 ? 's' : ''}, ${kb} KB)`
    };
  }
}
