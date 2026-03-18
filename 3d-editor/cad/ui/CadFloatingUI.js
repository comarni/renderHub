import { EventBus } from '../../core/EventBus.js';

export class CadFloatingUI {
  constructor({ mountParent, toolRegistry }) {
    this.parent = mountParent;
    this.registry = toolRegistry;

    this._cursor = { x: 80, y: 80 };
    this._state = { activeToolId: 'move' };

    this._build();
    this._bind();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.id = 'cad-floating-ui';
    this.el.classList.add('hidden');
    this.el.innerHTML = `
      <div class="cad-floating-title">Extrude</div>
      <div class="cad-floating-row">
        <label for="cad-extrude-distance">Distance</label>
        <input id="cad-extrude-distance" type="number" step="0.05" value="0.2" />
      </div>
      <div class="cad-floating-actions">
        <button id="cad-extrude-apply" type="button">Apply</button>
        <button id="cad-extrude-cancel" type="button" class="ghost">Cancel</button>
      </div>
    `;

    this.parent.appendChild(this.el);
    this.distanceInput = this.el.querySelector('#cad-extrude-distance');
    this.btnApply = this.el.querySelector('#cad-extrude-apply');
    this.btnCancel = this.el.querySelector('#cad-extrude-cancel');
  }

  _bind() {
    this.parent.addEventListener('pointermove', (e) => {
      const rect = this.parent.getBoundingClientRect();
      this._cursor.x = e.clientX - rect.left;
      this._cursor.y = e.clientY - rect.top;
      this._positionNearCursor();
    });

    EventBus.on('cad:state:changed', (state) => {
      this._state = state;
      this._syncVisibility();
    });

    this.btnApply.addEventListener('click', () => this._applyExtrude());
    this.btnCancel.addEventListener('click', () => {
      this.registry.activate('move');
    });

    this.distanceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._applyExtrude();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.registry.activate('move');
      }
    });
  }

  _applyExtrude() {
    const active = this.registry.getActive();
    if (!active || active.id !== 'extrude') return;

    const result = active.executeQuickAction(this.registry.ctx, {
      distance: this.distanceInput.value,
    });

    if (result?.message) {
      EventBus.emit('terminal:log', {
        type: result.success ? 'info' : 'error',
        message: `[cad] ${result.message}`,
      });
    }
  }

  _syncVisibility() {
    const show = this._state.activeToolId === 'extrude';
    this.el.classList.toggle('hidden', !show);
    if (show) this._positionNearCursor();
  }

  _positionNearCursor() {
    if (!this.el || this.el.classList.contains('hidden')) return;

    const margin = 14;
    const parentRect = this.parent.getBoundingClientRect();
    const panelWidth = this.el.offsetWidth || 220;
    const panelHeight = this.el.offsetHeight || 120;

    let x = this._cursor.x + 18;
    let y = this._cursor.y + 18;

    if (x + panelWidth > parentRect.width - margin) x = parentRect.width - panelWidth - margin;
    if (y + panelHeight > parentRect.height - margin) y = parentRect.height - panelHeight - margin;
    if (x < margin) x = margin;
    if (y < margin) y = margin;

    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }
}
