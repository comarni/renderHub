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

    this._operations = [];
    this._suppressed = new Set();
    this._undone = new Set();
    this._expanded = new Set();

    this._listEl  = document.getElementById('hierarchy-list');
    this._countEl = document.getElementById('obj-count');

    // Quick-add buttons
    document.querySelectorAll('.btn-add-obj').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        if (type) this.parser.execute(`add ${type}`);
      });
    });

    EventBus.on('cad:state:changed', (snapshot = {}) => {
      this._operations = Array.isArray(snapshot.operations) ? snapshot.operations : [];
      this._suppressed = new Set(snapshot.suppressedOperationIds || []);
      this._undone = new Set(snapshot.undoneOperationIds || []);
      const lastOp = this._operations[this._operations.length - 1];
      if (lastOp?.objectId) this._expanded.add(lastOp.objectId);
      this._refresh();
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

    const alive = new Set(objects.map(o => o.id));
    this._operations = this._operations.filter((op) => alive.has(op.objectId));
    [...this._expanded].forEach((id) => {
      if (!alive.has(id)) this._expanded.delete(id);
    });

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
      const ops = this._operations.filter((op) => op.objectId === record.id);
      const isExpanded = this._expanded.has(record.id);

      const node = document.createElement('div');
      node.className = 'hierarchy-node';

      const item = document.createElement('div');
      item.className = 'hierarchy-item' + (isSelected ? ' selected' : '');
      item.dataset.id = record.id;

      const expander = document.createElement('button');
      expander.type = 'button';
      expander.className = 'hierarchy-expander' + (ops.length ? '' : ' disabled');
      expander.textContent = ops.length ? (isExpanded ? '▾' : '▸') : '·';
      expander.title = ops.length ? 'Show operations' : 'No operations yet';
      expander.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!ops.length) return;
        if (this._expanded.has(record.id)) this._expanded.delete(record.id);
        else this._expanded.add(record.id);
        this._refresh();
      });

      const icon = document.createElement('span');
      icon.className = 'type-icon';
      icon.innerHTML = TYPE_ICONS[record.type] || '&#9670;';

      const name = document.createElement('span');
      name.className = 'obj-name';
      name.textContent = record.name;
      name.title = record.name; // tooltip for long names

      item.appendChild(expander);
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

      node.appendChild(item);

      if (ops.length && isExpanded) {
        const opList = document.createElement('div');
        opList.className = 'hierarchy-op-list';
        ops.slice(-18).forEach((op) => {
          const opRow = document.createElement('div');
          opRow.className = 'hierarchy-op-item'
            + (this._suppressed.has(op.id) ? ' suppressed' : '')
            + (this._undone.has(op.id) ? ' undone' : '');

          const opIcon = document.createElement('span');
          opIcon.className = 'hierarchy-op-icon';
          opIcon.textContent = this._opIcon(op.type);

          const opLabel = document.createElement('span');
          opLabel.className = 'hierarchy-op-label';
          opLabel.textContent = op.label;

          const opToggle = document.createElement('button');
          opToggle.type = 'button';
          opToggle.className = 'hierarchy-op-toggle';
          opToggle.textContent = this._suppressed.has(op.id) ? '✕' : '✓';
          opToggle.title = this._suppressed.has(op.id) ? 'Re-enable operation' : 'Suppress operation';
          opToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            EventBus.emit('cad:operation:toggle-suppress', { operationId: op.id });
          });

          const opUp = document.createElement('button');
          opUp.type = 'button';
          opUp.className = 'hierarchy-op-order';
          opUp.textContent = '↑';
          opUp.title = 'Move operation up';
          opUp.addEventListener('click', (e) => {
            e.stopPropagation();
            EventBus.emit('cad:operation:move', { operationId: op.id, direction: 'up' });
          });

          const opDown = document.createElement('button');
          opDown.type = 'button';
          opDown.className = 'hierarchy-op-order';
          opDown.textContent = '↓';
          opDown.title = 'Move operation down';
          opDown.addEventListener('click', (e) => {
            e.stopPropagation();
            EventBus.emit('cad:operation:move', { operationId: op.id, direction: 'down' });
          });

          let paramInput = null;
          if (op.type === 'extrude') {
            paramInput = document.createElement('input');
            paramInput.type = 'number';
            paramInput.step = '0.01';
            paramInput.className = 'hierarchy-op-param';
            const distance = Number(op?.payload?.distance);
            if (Number.isFinite(distance)) {
              paramInput.value = distance.toFixed(3);
            }
            paramInput.title = 'Extrude distance';
            paramInput.addEventListener('click', (e) => e.stopPropagation());
            paramInput.addEventListener('change', () => {
              const value = Number(paramInput.value);
              if (!Number.isFinite(value)) return;
              EventBus.emit('cad:operation:update-param', {
                operationId: op.id,
                patch: { distance: value },
              });
            });
          }

          opRow.appendChild(opIcon);
          opRow.appendChild(opLabel);
          if (paramInput) opRow.appendChild(paramInput);
          opRow.appendChild(opUp);
          opRow.appendChild(opDown);
          opRow.appendChild(opToggle);
          opList.appendChild(opRow);
        });
        node.appendChild(opList);
      }

      this._listEl.appendChild(node);
    });
  }

  _opIcon(type) {
    if (type === 'create') return '■';
    if (type === 'transform') return '⤡';
    if (type === 'extrude') return '△';
    if (type === 'material') return '◍';
    return '•';
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
