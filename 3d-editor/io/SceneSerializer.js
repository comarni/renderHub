/* ═══════════════════════════════════════════════════════════════
   SceneSerializer — Save / Load scene to .hub JSON format
   ═══════════════════════════════════════════════════════════════
   Format version 1.
   Compatible with future cloud API (same JSON transferred over HTTP).

   Supported primitive types: box, sphere, cylinder, plane
   Supported procedural types: dog, cat, car, house, tree,
                                chair, table, robot, human
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

const FORMAT_VERSION = 2;

export class SceneSerializer {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager}     objectManager
   * @param {import('../objects/MaterialManager.js').MaterialManager} materialManager
   */
  constructor(objectManager, materialManager) {
    this.objs = objectManager;
    this.mat  = materialManager;
  }

  /* ── Save ───────────────────────────────────────────────────── */

  /**
   * Serialize the entire scene to a .hub JSON blob and trigger download.
   * @param {string} filename — without extension
   */
  save(filename = 'scene') {
    const hub = this.serialize(filename);
    this._download(JSON.stringify(hub, null, 2), `${filename}.hub`, 'application/json');
    return `Scene saved as "${filename}.hub" (${hub.objects.length} object${hub.objects.length !== 1 ? 's' : ''})`;
  }

  /**
   * Build a serializable hub object for the current scene.
   * @param {string} filename
   */
  serialize(filename = 'scene') {
    const objects = [];

    for (const record of this.objs.list()) {
      const mesh = record.mesh;
      objects.push({
        id:   record.id,
        name: record.name,
        type: record.type,
        object: mesh.toJSON(),
      });
    }

    return {
      version:   FORMAT_VERSION,
      name:      filename,
      createdAt: new Date().toISOString(),
      objects,
    };
  }

  /* ── Load ───────────────────────────────────────────────────── */

  /**
   * Load a .hub file via the browser file picker and restore the scene.
   * Clears the current scene first.
   * @param {Function} onComplete — called with a result message string
   */
  load(onComplete) {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.hub,application/json';

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const hub  = JSON.parse(text);
        const msg  = this.restore(hub);
        onComplete({ success: true, message: msg });
      } catch (e) {
        onComplete({ success: false, message: `Load failed: ${e.message}` });
      }
    });

    // Trigger the picker
    input.click();
  }

  /* ── Private: restore ───────────────────────────────────────── */

  restore(hub) {
    if (!hub.objects || !Array.isArray(hub.objects)) {
      throw new Error('Invalid .hub file: missing objects array');
    }

    // Clear current scene
    const allIds = this.objs.list().map(r => r.id);
    for (const id of allIds) this.objs.delete(id);

    let loaded = 0;
    const loader = new THREE.ObjectLoader();

    for (const entry of hub.objects) {
      try {
        if (!entry.object) throw new Error('Missing object payload');
        const object3D = loader.parse(entry.object);
        this.objs.addGroup(
          object3D,
          entry.name || object3D.name || 'Object',
          entry.type || object3D.userData.editorType || 'object'
        );

        loaded++;
      } catch (err) {
        console.warn(`[SceneSerializer] Skipped "${entry.name}": ${err.message}`);
      }
    }

    return `Loaded "${hub.name ?? 'scene'}.hub" — ${loaded} object${loaded !== 1 ? 's' : ''} restored`;
  }

  /* ── Private: file download ─────────────────────────────────── */

  _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
