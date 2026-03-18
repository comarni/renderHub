import { EventBus } from '../../core/EventBus.js';

const TOOL_ORDER = ['move', 'rotate', 'scale', 'extrude'];

export class CadToolbar {
  constructor({ mountParent, toolRegistry }) {
    this.parent = mountParent;
    this.registry = toolRegistry;
    this._el = null;

    this._build();
    EventBus.on('cad:state:changed', (state) => this._syncActive(state.activeToolId));
  }

  _build() {
    this._el = document.createElement('div');
    this._el.id = 'cad-toolbar';
    this._el.innerHTML = `
      <div class="cad-toolbar-title">Tools</div>
      <div class="cad-toolbar-group" id="cad-toolbar-group"></div>
    `;

    const group = this._el.querySelector('#cad-toolbar-group');
    const tools = this.registry.list();

    TOOL_ORDER.forEach((id) => {
      const tool = tools.find((t) => t.id === id);
      if (!tool) return;
      const btn = document.createElement('button');
      btn.className = 'cad-tool-btn';
      btn.dataset.toolId = tool.id;
      btn.type = 'button';
      btn.textContent = tool.label;
      btn.title = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label;
      btn.addEventListener('click', () => this.registry.activate(tool.id));
      group.appendChild(btn);
    });

    this.parent.appendChild(this._el);
    this._syncActive(this.registry.getActive()?.id || 'move');
  }

  _syncActive(activeToolId) {
    if (!this._el) return;
    this._el.querySelectorAll('.cad-tool-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.toolId === activeToolId);
    });
  }
}
