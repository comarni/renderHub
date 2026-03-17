/* ═══════════════════════════════════════════════════════════════
   SceneHierarchy — Left panel object list
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

const TYPE_ICONS = {
  box:      '&#9633;',  // □
  sphere:   '&#9679;',  // ●
  cylinder: '&#11044;', // ⬬ (using a circle as fallback)
  plane:    '&#9644;',  // ▬
  image:    '&#128247;', // 📷
  image3d:  '&#129504;', // 🧠
  web:      '&#127760;', // 🌐
};

export class SceneHierarchy {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager}     objectManager
   * @param {import('../core/SelectionManager.js').SelectionManager}  selectionManager
   * @param {import('../commands/CommandParser.js').CommandParser}     commandParser
   */
  constructor(objectManager, selectionManager, commandParser) {
    this.objs   = objectManager;
    this.sel    = selectionManager;
    this.parser = commandParser;

    this._listEl  = document.getElementById('hierarchy-list');
    this._countEl = document.getElementById('obj-count');

    // Quick-add buttons
    document.querySelectorAll('.btn-add-obj').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type) this.parser.execute(`add ${type}`);
      });
    });

    EventBus.on('state:changed', () => this._refresh());
    this._refresh();
  }

  _refresh() {
    if (!this._listEl) return;

    const objects = this.objs.list();

    // Update count badge
    if (this._countEl) this._countEl.textContent = objects.length;

    this._listEl.innerHTML = '';

    if (objects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'hierarchy-empty';
      empty.style.cssText = 'padding:12px 10px; color:#555; font-size:11px; text-align:center;';
      empty.textContent = 'No objects in scene';
      this._listEl.appendChild(empty);
      return;
    }

    objects.forEach(record => {
      const isSelected = this.sel.selected.has(record.id);

      const item = document.createElement('div');
      item.className = 'hierarchy-item' + (isSelected ? ' selected' : '');
      item.dataset.id = record.id;

      const icon = document.createElement('span');
      icon.className = 'type-icon';
      icon.innerHTML = TYPE_ICONS[record.type] || '&#9670;';

      const name = document.createElement('span');
      name.className = 'obj-name';
      name.textContent = record.name;
      name.title = record.name; // tooltip for long names

      item.appendChild(icon);
      item.appendChild(name);

      // Click: select (Shift to add to selection)
      item.addEventListener('click', (e) => {
        if (e.shiftKey) {
          // Add to selection
          const currentIds = [...this.sel.selected, record.id];
          this.sel.selectByIds(currentIds, false);
        } else {
          this.parser.execute(`select ${record.name}`);
        }
      });

      // Double-click: rename inline
      item.addEventListener('dblclick', () => {
        this._startInlineRename(item, name, record);
      });

      this._listEl.appendChild(item);
    });
  }

  _startInlineRename(item, nameSpan, record) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = record.name;
    input.className = 'hierarchy-rename-input';
    input.style.cssText = `
      background: #1a1a1a;
      border: 1px solid #e87d0d;
      color: #e0e0e0;
      font-size: 11px;
      padding: 1px 4px;
      border-radius: 2px;
      width: calc(100% - 30px);
      outline: none;
    `;

    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const newName = input.value.trim();
      if (newName && newName !== record.name) {
        // Select the object first, then rename
        this.sel.selectByIds([record.id], false);
        this.parser.execute(`rename ${newName}`);
      }
      input.replaceWith(nameSpan);
    };

    input.addEventListener('blur',  commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.replaceWith(nameSpan); }
    });
  }
}
