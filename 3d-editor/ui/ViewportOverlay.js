/* ═══════════════════════════════════════════════════════════════
   ViewportOverlay — View buttons, transform mode, wireframe, stats
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

export class ViewportOverlay {
  /**
   * @param {import('../commands/CommandParser.js').CommandParser}   commandParser
   * @param {import('../objects/ObjectManager.js').ObjectManager}    objectManager
   * @param {import('../core/SelectionManager.js').SelectionManager} selectionManager
   */
  constructor(commandParser, objectManager, selectionManager) {
    this.parser = commandParser;
    this.objs   = objectManager;
    this.sel    = selectionManager;

    this._wireframeActive = false;

    this._setupViewButtons();
    this._setupTransformButtons();
    this._setupWireframeToggle();
    this._setupExportButton();
    this._setupStats();
    this._setupKeyboardShortcuts();
    this._setupSpaceButton();
    this._setupMobileDock();

    // Update active tool label
    EventBus.on('state:changed', () => this._updateStats());

    // Register wireframe + view callbacks on parser
    commandParser.onWireframe   = () => this._toggleWireframe();
    commandParser.onViewChange  = (mode) => this._setActiveViewBtn(mode);
    commandParser.onTransformMode = (mode) => this._setActiveTransformBtn(mode);
  }

  /* ── View buttons ─────────────────────────────────────────── */

  _setupViewButtons() {
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) this.parser.execute(`view ${view}`);
      });
    });
  }

  _setActiveViewBtn(mode) {
    document.querySelectorAll('.btn-view').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === mode);
    });
    // Update header label
    const label = document.getElementById('active-tool-label');
    if (label) label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
  }

  /* ── Transform mode buttons ───────────────────────────────── */

  _setupTransformButtons() {
    document.querySelectorAll('.btn-transform').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode) {
          this.sel.setMode(mode);
          this._setActiveTransformBtn(mode);
          // Update header label
          const label = document.getElementById('active-tool-label');
          if (label) {
            const labels = { translate: 'Move', rotate: 'Rotate', scale: 'Scale' };
            label.textContent = labels[mode] || mode;
          }
        }
      });
    });
  }

  _setActiveTransformBtn(mode) {
    document.querySelectorAll('.btn-transform').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  _setActiveSpaceBtn(space) {
    const btn = document.getElementById('btn-space');
    if (!btn) return;
    btn.textContent = space === 'world' ? 'World' : 'Local';
    btn.classList.toggle('local', space === 'local');
  }

  /* ── Wireframe toggle ─────────────────────────────────────── */

  _setupWireframeToggle() {
    const btn = document.getElementById('btn-wireframe');
    if (btn) {
      btn.addEventListener('click', () => this._toggleWireframe());
    }
  }

  _toggleWireframe() {
    this._wireframeActive = !this._wireframeActive;

    const btn = document.getElementById('btn-wireframe');
    if (btn) btn.classList.toggle('active', this._wireframeActive);

    // Apply wireframe to all objects
    this.objs.list().forEach(record => {
      record.mesh.material.wireframe = this._wireframeActive;
    });

    EventBus.emit('terminal:log', {
      message: `Wireframe: ${this._wireframeActive ? 'ON' : 'OFF'}`,
      type: 'info'
    });
  }

  /* ── Export STL button ────────────────────────────────────── */

  _setupExportButton() {
    const btn = document.getElementById('btn-export-stl');
    if (btn) {
      btn.addEventListener('click', () => {
        this.parser.execute('export scene.stl');
      });
    }
  }

  /* ── Stats overlay ────────────────────────────────────────── */

  _setupStats() {
    this._statObjects = document.getElementById('stat-objects');
    this._statTris    = document.getElementById('stat-tris');
    this._updateStats();
    setInterval(() => this._updateStats(), 800);
  }

  _updateStats() {
    const count = this.objs.list().length;
    const tris  = this.objs.getTriangleCount();
    if (this._statObjects) this._statObjects.textContent = `Objects: ${count}`;
    if (this._statTris)    this._statTris.textContent    = `Tris: ${tris.toLocaleString()}`;
  }

  /* ── Keyboard shortcuts ───────────────────────────────────── */

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      this._showPressedKeys(e);

      // Extended editor shortcuts for quick validation of mesh-edit features
      if (e.shiftKey && e.code === 'Slash') {
        e.preventDefault();
        this._toggleShortcutsPanel();
        return;
      }

      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        this._runOnPrimary((id) => `select face ${id} 0`);
        return;
      }
      if (e.shiftKey && e.code === 'Digit2') {
        e.preventDefault();
        this._runOnPrimary((id) => `select edge ${id} 0`);
        return;
      }
      if (e.shiftKey && e.code === 'Digit3') {
        e.preventDefault();
        this._runOnPrimary((id) => `select vertex ${id} 0`);
        return;
      }
      if (e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        this._execShortcutCommand('extrude selection 0.1');
        return;
      }
      if (e.shiftKey && e.code === 'KeyB') {
        e.preventDefault();
        this._execShortcutCommand('subdivide selection 1');
        return;
      }
      if (e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        this._runOnPrimary((id) => `merge vertices ${id} distance=0.0001`);
        return;
      }
      if (e.shiftKey && e.code === 'KeyN') {
        e.preventDefault();
        this._runOnPrimary((id) => `recalc normals ${id}`);
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'g': this.sel.setMode('translate'); this._setActiveTransformBtn('translate'); break;
        case 'r': this.sel.setMode('rotate');    this._setActiveTransformBtn('rotate');    break;
        case 's': this.sel.setMode('scale');     this._setActiveTransformBtn('scale');     break;
        case 'escape':
          this.sel.deselectAll();
          break;
        case 'w':
          if (e.ctrlKey || e.metaKey) break;
          e.preventDefault();
          this._setActiveSpaceBtn(this.sel.toggleSpace());
          break;
        case 'x':
        case 'delete':
          this.parser.execute('delete');
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.shiftKey ? this.parser.execute('redo') : this.parser.execute('undo');
          }
          break;
        case 'd':
          if (e.shiftKey) { e.preventDefault(); this.parser.execute('duplicate'); }
          break;
        case 'f':
          this.parser.execute('focus');
          break;
        case 'numpad1': case '1':
          if (e.ctrlKey) { e.preventDefault(); this.parser.execute('view front'); }
          break;
        case 'numpad3': case '3':
          if (e.ctrlKey) { e.preventDefault(); this.parser.execute('view right'); }
          break;
        case 'numpad7': case '7':
          if (e.ctrlKey) { e.preventDefault(); this.parser.execute('view top'); }
          break;
        case 'numpad5': case '5':
          if (e.ctrlKey) { e.preventDefault(); this.parser.execute('view perspective'); }
          break;
      }
    });
  }


  // Wire btn-space (Space toggle button in viewport overlay)
  _setupSpaceButton() {
    const btn = document.getElementById('btn-space');
    if (btn) btn.addEventListener('click', () => this._setActiveSpaceBtn(this.sel.toggleSpace()));
  }

  _execShortcutCommand(command) {
    const result = this.parser.execute(command);
    EventBus.emit('terminal:log', {
      type: result.success ? 'info' : 'error',
      message: `[shortcut] ${command} → ${result.message}`,
    });
  }

  _runOnPrimary(commandBuilder) {
    const rec = this.sel.getPrimary();
    if (!rec) {
      EventBus.emit('terminal:log', {
        type: 'warn',
        message: '[shortcut] Select an object first.',
      });
      return;
    }
    const command = commandBuilder(rec.id);
    this._execShortcutCommand(command);
  }

  _toggleShortcutsPanel() {
    const panel = document.getElementById('shortcuts-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
  }

  _showPressedKeys(e) {
    const hud = document.getElementById('key-pressed-hud');
    if (!hud) return;

    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.metaKey) keys.push('Meta');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    keys.push(key);

    hud.textContent = keys.join(' + ');
    hud.classList.remove('hidden');
    hud.classList.add('visible');

    clearTimeout(this._pressedKeyTimer);
    this._pressedKeyTimer = setTimeout(() => {
      hud.classList.remove('visible');
      hud.classList.add('hidden');
    }, 550);
  }

  _setupMobileDock() {
    const dockButtons = document.querySelectorAll('#mobile-dock .mobile-dock-btn');
    if (!dockButtons.length) return;

    const haptic = () => {
      if (navigator.vibrate) navigator.vibrate(8);
    };

    dockButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        const mode = btn.dataset.mode;

        if (cmd) {
          this.parser.execute(cmd);
          haptic();
          return;
        }

        if (mode) {
          this.sel.setMode(mode);
          this._setActiveTransformBtn(mode);
          this._setActiveMobileModeBtn(mode);
          haptic();
        }
      });
    });
  }

  _setActiveMobileModeBtn(mode) {
    document.querySelectorAll('#mobile-dock .mobile-dock-btn.mode').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }
}
