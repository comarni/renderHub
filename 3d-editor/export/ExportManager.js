/* ═══════════════════════════════════════════════════════════════
   ExportManager — Central pluggable export coordinator
   ═══════════════════════════════════════════════════════════════

   Architecture:
   ─────────────
   ExportManager owns a registry of "Exporter" plugins.
   Each exporter implements the minimal interface:

     {
       name:      string                              // e.g. 'STL'
       extension: string                              // e.g. 'stl'
       label:     string                              // human description
       supports(domain: string): boolean              // optional domain filter
       export(hubScene, options): ExportResult|Promise<ExportResult>
     }

   The manager assembles a HubScene snapshot from live application
   state and hands it to the selected exporter.

   HubScene passed to every exporter:
   ───────────────────────────────────
   {
     name:            string,
     version:         number,
     objects:         ObjectRecord[],          // objectManager.list()
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
       domain:      string,                    // 'industrial' | 'cinematic' | …
       createdAt:   string,                    // ISO timestamp
       exportedAt:  string,
     },
   }

   ExportResult:
   ─────────────
   {
     success:   boolean,
     message:   string,
     blob?:     Blob,
     text?:     string,
     filename?: string,
   }
   ═══════════════════════════════════════════════════════════════ */

export class ExportManager {
  /**
   * @param {object} deps
   * @param {import('three').Scene}                                              deps.scene
   * @param {import('../objects/ObjectManager.js').ObjectManager}                deps.objectManager
   * @param {import('../objects/MaterialManager.js').MaterialManager}            deps.materialManager
   * @param {import('../cad/core/CadState.js').CadState|null}                   deps.cadState
   */
  constructor({ scene, objectManager, materialManager, cadState = null }) {
    this._scene = scene;
    this._objs  = objectManager;
    this._mat   = materialManager;
    this._cad   = cadState;

    /** @type {Map<string, object>} format → exporter */
    this._exporters = new Map();
  }

  /* ── Registration ─────────────────────────────────────────── */

  /**
   * Register an exporter plugin.
   * Call returns `this` for fluent chaining:
   *   manager.register(stl).register(gltf).register(json)
   *
   * @param {object} exporter
   * @returns {this}
   */
  register(exporter) {
    if (!exporter?.name || typeof exporter.export !== 'function') {
      console.warn('[ExportManager] Skipping invalid exporter — needs .name and .export()', exporter);
      return this;
    }
    this._exporters.set(exporter.name.toLowerCase(), exporter);
    return this;
  }

  /**
   * Retrieve a registered exporter by format name (case-insensitive).
   * @param {string} format
   * @returns {object|null}
   */
  get(format) {
    return this._exporters.get(format.toLowerCase()) ?? null;
  }

  /**
   * List all registered formats with display metadata.
   * @returns {{ name: string, extension: string, label: string }[]}
   */
  getAvailableFormats() {
    return [...this._exporters.values()].map(e => ({
      name:      e.name,
      extension: e.extension ?? '',
      label:     e.label    ?? e.name,
    }));
  }

  /* ── HubScene Assembly ────────────────────────────────────── */

  /**
   * Build a HubScene snapshot from the current live application state.
   * This is a pure data snapshot — no side effects on the scene.
   *
   * @param {string} projectName
   * @returns {object} HubScene
   */
  buildHubScene(projectName = 'scene') {
    const cadData = this._cad?.exportOperations?.() ?? {
      operations:             [],
      suppressedOperationIds: [],
      undoneOperationIds:     [],
    };

    const snapSettings = this._cad?.getSnapshot?.()?.snapSettings ?? {};

    return {
      name:            projectName,
      version:         2,
      objects:         this._objs.list(),
      scene:           this._scene,
      objectManager:   this._objs,
      materialManager: this._mat,
      cad:             cadData,
      snapSettings,
      metadata: {
        domain:      window.renderHubDomain ?? 'default',
        createdAt:   new Date().toISOString(),
        exportedAt:  new Date().toISOString(),
      },
    };
  }

  /* ── Export ───────────────────────────────────────────────── */

  /**
   * Export the current scene in the given format.
   *
   * @param {string}  format              — registered exporter name, e.g. 'stl'
   * @param {object}  [options]
   * @param {string}  [options.filename]  — base filename without extension (default: 'scene')
   * @param {boolean} [options.download]  — trigger browser download (default: true)
   * @param {*}       [options.*]         — any extra options forwarded to the exporter
   * @returns {Promise<{ success: boolean, message: string, blob?: Blob, text?: string, filename?: string }>}
   */
  async export(format, options = {}) {
    const { filename = 'scene', download = true, ...rest } = options;

    const exporter = this.get(format);
    if (!exporter) {
      const available = [...this._exporters.keys()].join(', ');
      return {
        success: false,
        message: `Unknown format "${format}". Available: ${available || 'none registered'}`,
      };
    }

    if (this._objs.list().length === 0) {
      return { success: false, message: 'Scene is empty — add objects before exporting.' };
    }

    // Ensure world matrices are up to date before any exporter reads mesh data
    this._scene.updateMatrixWorld(true);

    const hubScene = this.buildHubScene(filename);

    try {
      const result = await Promise.resolve(
        exporter.export(hubScene, { filename, download, ...rest })
      );
      return result ?? { success: false, message: 'Exporter returned no result.' };
    } catch (err) {
      console.error('[ExportManager] Export error:', err);
      return { success: false, message: `Export error: ${err?.message ?? String(err)}` };
    }
  }
}
