/* ═══════════════════════════════════════════════════════════════
   JSON / .hub Exporter (pluggable) — Raw scene serialization
   ═══════════════════════════════════════════════════════════════
   Conforms to the ExportManager plugin interface.
   Serializes the complete HubScene — objects, CAD timeline,
   snap settings, metadata — to a .hub JSON file.

   This exporter does NOT call SceneSerializer.save() directly so
   it remains isolated from the save/load UI flow. It mirrors the
   same format so .hub files are cross-compatible.

   Domain: all
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { downloadBlob, ensureExtension } from './_exportUtils.js';

export class JSONPluggableExporter {
  get name()      { return 'JSON'; }
  get extension() { return 'hub'; }
  get label()     { return 'JSON / .hub — Debug, Backup, Portability'; }

  /** @param {string} _domain */
  supports(_domain) { return true; }

  /**
   * @param {import('../ExportManager.js').HubScene} hubScene
   * @param {{ filename?: string, download?: boolean, pretty?: boolean }} options
   * @returns {{ success: boolean, message: string, blob?: Blob, text?: string, filename?: string }}
   */
  export(hubScene, { filename = 'scene', download = true, pretty = true } = {}) {
    const { objects, cad, snapSettings, metadata } = hubScene;

    // Serialize every mesh via Three.js built-in toJSON() — same technique
    // used by SceneSerializer so the format stays compatible.
    const loader = new THREE.ObjectLoader();  // not used here, just guards the import
    void loader;

    const serializedObjects = objects.map(record => ({
      id:     record.id,
      name:   record.name,
      type:   record.type,
      object: record.mesh.toJSON(),
    }));

    const hubData = {
      version:    2,
      name:       filename,
      createdAt:  metadata?.createdAt  ?? new Date().toISOString(),
      exportedAt: metadata?.exportedAt ?? new Date().toISOString(),
      objects:    serializedObjects,
      cad,
      snapSettings,
      metadata,
    };

    const indent     = pretty ? 2 : 0;
    const text       = JSON.stringify(hubData, null, indent);
    const blob       = new Blob([text], { type: 'application/json' });
    const safeFilename = ensureExtension(filename, 'hub');

    if (download) downloadBlob(blob, safeFilename);

    const kb = (blob.size / 1024).toFixed(1);
    return {
      success:  true,
      message:  `✓ Exported "${safeFilename}" — ${objects.length} object${objects.length !== 1 ? 's' : ''}, ${kb} KB`,
      blob,
      text,
      filename: safeFilename,
    };
  }
}
