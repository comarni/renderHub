/* ═══════════════════════════════════════════════════════════════
   RadialContextMenu — Circular 2D context menu on right-click
   ═══════════════════════════════════════════════════════════════
   Triggered via EventBus 'contextmenu:show' with { record, x, y }.
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

const RADIUS    = 86;  // px – distance from center to item center
const ITEM_SIZE = 58;  // px – diameter of each item circle

export class RadialContextMenu {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager}      objectManager
   * @param {import('../export/ObjectExporter.js').ObjectExporter}      objectExporter
   * @param {import('../core/SelectionManager.js').SelectionManager}    selectionManager
   * @param {import('../core/Camera.js').CameraManager}                 cameraManager
   */
  constructor(objectManager, objectExporter, selectionManager, cameraManager) {
    this.objs      = objectManager;
    this.exporter  = objectExporter;
    this.selection = selectionManager;
    this.camera    = cameraManager;

    this._visible = false;
    this._record  = null;

    this._buildDOM();
    this._bindEvents();
  }

  /* ── DOM construction ────────────────────────────────────── */

  _buildDOM() {
    // Click-outside overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'rcm-overlay';
    document.body.appendChild(this._overlay);

    // Menu container
    this._el = document.createElement('div');
    this._el.id = 'radial-menu';
    this._el.setAttribute('role', 'menu');
    document.body.appendChild(this._el);
  }

  _bindEvents() {
    EventBus.on('contextmenu:show', ({ record, x, y }) => this.show(record, x, y));

    this._overlay.addEventListener('click',        () => this.hide());
    this._overlay.addEventListener('contextmenu',  (e) => { e.preventDefault(); this.hide(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._visible) this.hide();
    });
  }

  /* ── Public API ──────────────────────────────────────────── */

  show(record, cx, cy) {
    this._record  = record;
    this._visible = true;

    this._el.innerHTML = '';

    const items = this._items(record);
    const n = items.length;

    // Center label
    const center = document.createElement('div');
    center.className = 'rcm-center';
    center.textContent = (record.name || '').slice(0, 9);
    center.title = record.name;
    this._el.appendChild(center);

    // Stagger animation per item
    items.forEach((item, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2; // start from top
      const ix = Math.round(Math.cos(angle) * RADIUS);
      const iy = Math.round(Math.sin(angle) * RADIUS);

      const btn = document.createElement('button');
      btn.className = `rcm-item${item.danger ? ' danger' : ''}`;
      btn.setAttribute('role', 'menuitem');
      btn.title = item.label;
      btn.style.cssText = [
        `left:${ix}px`,
        `top:${iy}px`,
        `width:${ITEM_SIZE}px`,
        `height:${ITEM_SIZE}px`,
        `animation-delay:${i * 28}ms`,
      ].join(';');
      btn.innerHTML = `<span class="rcm-icon">${item.icon}</span><span class="rcm-label">${item.label}</span>`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        item.action(record);
      });

      this._el.appendChild(btn);
    });

    // Clamp to viewport
    const PAD = RADIUS + ITEM_SIZE;
    const mx  = Math.max(PAD, Math.min(window.innerWidth  - PAD, cx));
    const my  = Math.max(PAD, Math.min(window.innerHeight - PAD, cy));

    this._el.style.left = `${mx}px`;
    this._el.style.top  = `${my}px`;
    this._el.classList.add('visible');
    this._overlay.classList.add('visible');
  }

  hide() {
    this._visible = false;
    this._record  = null;
    this._el.classList.remove('visible');
    this._overlay.classList.remove('visible');
  }

  /* ── Menu items ──────────────────────────────────────────── */

  _items(record) {
    return [
      /* ── Export STL ──────────────────────────── */
      {
        icon:  '⬇',
        label: 'STL',
        action: (rec) => {
          const res = this.exporter.exportSTL(rec);
          EventBus.emit('terminal:log', { type: res.success ? 'info' : 'error', message: res.message });
        },
      },

      /* ── Export GLB / Three.js ───────────────── */
      {
        icon:  '📦',
        label: 'GLB',
        action: async (rec) => {
          EventBus.emit('terminal:log', { type: 'info', message: `Exportando GLB "${rec.name}"…` });
          const res = await this.exporter.exportGLB(rec);
          EventBus.emit('terminal:log', { type: res.success ? 'info' : 'error', message: res.message });
        },
      },

      /* ── Duplicate ───────────────────────────── */
      {
        icon:  '⧉',
        label: 'Duplicar',
        action: (rec) => {
          try {
            const newRec = this.objs.duplicate(rec.id);
            if (this.selection) this.selection.selectByIds([newRec.id], false);
            EventBus.emit('terminal:log', { type: 'info', message: `Duplicado "${rec.name}" → "${newRec.name}"` });
          } catch (err) {
            EventBus.emit('terminal:log', { type: 'error', message: `Error al duplicar: ${err.message}` });
          }
        },
      },

      /* ── Rename ──────────────────────────────── */
      {
        icon:  '✎',
        label: 'Renombrar',
        action: (rec) => {
          const name = prompt('Nuevo nombre:', rec.name);
          if (name && name !== rec.name) {
            this.objs.rename(rec.id, name.trim());
            EventBus.emit('terminal:log', { type: 'info', message: `Renombrado a "${name.trim()}"` });
          }
        },
      },

      /* ── Focus camera ────────────────────────── */
      {
        icon:  '🎯',
        label: 'Enfocar',
        action: (rec) => {
          if (this.camera) this.camera.focusOn(rec.mesh);
        },
      },

      /* ── Delete ──────────────────────────────── */
      {
        icon:   '✕',
        label:  'Eliminar',
        danger: true,
        action: (rec) => {
          if (this.selection) this.selection.deselectAll();
          this.objs.delete(rec.id);
          EventBus.emit('terminal:log', { type: 'info', message: `Eliminado "${rec.name}"` });
        },
      },
    ];
  }
}
