import { EventBus } from '../../core/EventBus.js';

export class SnapPanel {
  constructor({ mountParent }) {
    this.parent = mountParent;
    this.el = null;
    this._state = null;
    this._build();
    this._bind();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.id = 'cad-snap-panel';
    this.el.innerHTML = `
      <div class="cad-snap-title">Snap</div>
      <label class="cad-snap-line"><input type="checkbox" data-snap="enabled" checked /> Enabled</label>
      <label class="cad-snap-line"><input type="checkbox" data-snap="vertex" checked /> Vertex</label>
      <label class="cad-snap-line"><input type="checkbox" data-snap="edge" checked /> Edge</label>
      <label class="cad-snap-line"><input type="checkbox" data-snap="grid" checked /> Grid</label>
      <label class="cad-snap-line">Tolerance <input type="number" step="0.01" min="0.01" data-snap-num="tolerance" value="0.35" /></label>
      <label class="cad-snap-line">Grid <input type="number" step="0.01" min="0.01" data-snap-num="gridSize" value="0.25" /></label>
      <div class="cad-snap-shortcuts">Ctrl+1 Vtx · Ctrl+2 Edge · Ctrl+3 Grid · Ctrl+0 Snap</div>
    `;
    this.parent.appendChild(this.el);
  }

  _bind() {
    EventBus.on('cad:state:changed', (state) => {
      this._state = state;
      this._sync(state.snapSettings || {});
    });

    this.el.querySelectorAll('[data-snap]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.snap;
        EventBus.emit('cad:snap:update', { [key]: Boolean(input.checked) });
      });
    });

    this.el.querySelectorAll('[data-snap-num]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.snapNum;
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;
        EventBus.emit('cad:snap:update', { [key]: value });
      });
    });
  }

  _sync(settings) {
    this.el.querySelectorAll('[data-snap]').forEach((input) => {
      const key = input.dataset.snap;
      input.checked = Boolean(settings[key]);
    });

    this.el.querySelectorAll('[data-snap-num]').forEach((input) => {
      const key = input.dataset.snapNum;
      const value = settings[key];
      if (Number.isFinite(value)) input.value = String(value);
    });
  }
}
