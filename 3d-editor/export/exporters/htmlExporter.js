/* ═══════════════════════════════════════════════════════════════
   HTML Exporter (pluggable) — Standalone interactive viewer
   ═══════════════════════════════════════════════════════════════
   Conforms to the ExportManager plugin interface.
   Thin wrapper over the existing HTMLEmbeddedExporter so it can be
   driven through the ExportManager system without changing the
   original implementation.

   Domain: agency / ecommerce / realestate presets available.
   ═══════════════════════════════════════════════════════════════ */

import { HTMLEmbeddedExporter } from '../HTMLEmbeddedExporter.js';

export class HTMLPluggableExporter {
  get name()      { return 'HTML'; }
  get extension() { return 'html'; }
  get label()     { return 'HTML — Standalone Interactive 3D Viewer'; }

  /** @param {string} _domain */
  supports(_domain) { return true; }

  /**
   * @param {import('../ExportManager.js').HubScene} hubScene
   * @param {{ filename?: string, download?: boolean, preset?: string }} options
   * @returns {{ success: boolean, message: string }}
   */
  export(hubScene, { filename = 'scene', download = true, preset = 'agency' } = {}) {
    const { scene, objectManager, materialManager } = hubScene;

    // HTMLEmbeddedExporter works with the live objectManager + materialManager
    const impl = new HTMLEmbeddedExporter(scene, objectManager, materialManager);

    // _generateHTML is a private API but the public export() already wraps everything.
    // We use it directly here to control download externally; if download = false we
    // skip the internal download by capturing the blob manually.
    if (!download) {
      try {
        const html  = impl._generateHTML(filename, preset);
        const text  = html;
        const blob  = new Blob([html], { type: 'text/html' });
        const kb    = (blob.size / 1024).toFixed(1);
        return {
          success:  true,
          message:  `✓ Generated "${filename}.html" — ${kb} KB`,
          blob,
          text,
          filename: `${filename}.html`,
        };
      } catch (err) {
        return { success: false, message: `HTML export error: ${err?.message ?? err}` };
      }
    }

    // Default: let HTMLEmbeddedExporter handle its own download
    return impl.export(filename, { preset });
  }
}
