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
import { ProceduralGenerator } from '../ai/ProceduralGenerator.js';

const FORMAT_VERSION = 1;
const PRIMITIVE_TYPES = new Set(['box', 'sphere', 'cylinder', 'plane']);

/* ── Colour helper ──────────────────────────────────────────── */
function colorHex(color) {
  // color is a THREE.Color
  return '#' + color.getHexString();
}

export class SceneSerializer {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager}     objectManager
   * @param {import('../objects/MaterialManager.js').MaterialManager} materialManager
   */
  constructor(objectManager, materialManager) {
    this.objs = objectManager;
    this.mat  = materialManager;
    this._gen = new ProceduralGenerator();
  }

  /* ── Save ───────────────────────────────────────────────────── */

  /**
   * Serialize the entire scene to a .hub JSON blob and trigger download.
   * @param {string} filename — without extension
   */
  save(filename = 'scene') {
    const objects = [];

    for (const record of this.objs.list()) {
      const mesh = record.mesh;
      const entry = {
        id:   record.id,
        name: record.name,
        type: record.type,
        position: mesh.position.toArray(),
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale:    mesh.scale.toArray(),
      };

      if (PRIMITIVE_TYPES.has(record.type)) {
        // Primitive: serialise material
        const m = mesh.material;
        entry.material = {
          color:     colorHex(m.color),
          roughness: m.roughness,
          metalness: m.metalness,
          opacity:   m.opacity,
          transparent: m.transparent,
        };
        entry.kind = 'primitive';
      } else {
        // Procedural group: store color of first mesh child if available
        let groupColor = null;
        mesh.traverse(child => {
          if (!groupColor && child.isMesh && child.material) {
            groupColor = colorHex(child.material.color);
          }
        });
        entry.color = groupColor;
        entry.kind  = 'procedural';
      }

      objects.push(entry);
    }

    const hub = {
      version:   FORMAT_VERSION,
      name:      filename,
      createdAt: new Date().toISOString(),
      objects,
    };

    this._download(JSON.stringify(hub, null, 2), `${filename}.hub`, 'application/json');
    return `Scene saved as "${filename}.hub" (${objects.length} object${objects.length !== 1 ? 's' : ''})`;
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
        const msg  = this._restore(hub);
        onComplete({ success: true, message: msg });
      } catch (e) {
        onComplete({ success: false, message: `Load failed: ${e.message}` });
      }
    });

    // Trigger the picker
    input.click();
  }

  /* ── Private: restore ───────────────────────────────────────── */

  _restore(hub) {
    if (!hub.objects || !Array.isArray(hub.objects)) {
      throw new Error('Invalid .hub file: missing objects array');
    }

    // Clear current scene
    const allIds = this.objs.list().map(r => r.id);
    for (const id of allIds) this.objs.delete(id);

    let loaded = 0;

    for (const entry of hub.objects) {
      try {
        const pos = entry.position || [0, 0, 0];
        const rot = entry.rotation || [0, 0, 0];
        const scl = entry.scale    || [1, 1, 1];

        if (entry.kind === 'primitive' || PRIMITIVE_TYPES.has(entry.type)) {
          // Recreate primitive
          const record = this.objs.add(entry.type, entry.name);
          const mesh   = record.mesh;

          mesh.position.fromArray(pos);
          mesh.rotation.set(rot[0], rot[1], rot[2]);
          mesh.scale.fromArray(scl);

          if (entry.material) {
            const m = entry.material;
            mesh.material.color.set(m.color);
            mesh.material.roughness    = m.roughness ?? 0.5;
            mesh.material.metalness    = m.metalness ?? 0.0;
            mesh.material.opacity      = m.opacity   ?? 1.0;
            mesh.material.transparent  = m.transparent ?? false;
          }
        } else {
          // Recreate procedural group
          const group = this._gen.generate(entry.type, {
            color: entry.color || undefined,
          });

          group.position.fromArray(pos);
          group.rotation.set(rot[0], rot[1], rot[2]);
          group.scale.fromArray(scl);

          this.objs.addGroup(group, entry.name, entry.type);
        }

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
