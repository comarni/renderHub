import { EventBus } from '../../core/EventBus.js';

/**
 * CadState
 * Central CAD UI state for active tool, current selection and scene counters.
 * Keeps state lightweight and synchronized through EventBus.
 */
export class CadState {
  constructor(selectionManager, objectManager) {
    this.sel = selectionManager;
    this.objs = objectManager;

    this._state = {
      activeToolId: 'move',
      mode: '3d',
      selectionIds: [],
      sceneObjectCount: objectManager.list().length,
      snapSettings: {
        enabled: true,
        vertex: true,
        edge: true,
        grid: true,
        tolerance: 0.35,
        gridSize: 0.25,
      },
      operations: [],
      suppressedOperationIds: [],
      undoneOperationIds: [],
    };

    this._opCounter = 0;

    EventBus.on('selection:changed', ({ ids }) => {
      this._setPartial({ selectionIds: [...(ids || [])] });
    });

    EventBus.on('state:changed', ({ type } = {}) => {
      if (type === 'scene') {
        this._setPartial({ sceneObjectCount: this.objs.list().length });
        this.pruneByExistingObjects();
      }
    });

    EventBus.on('cad:operation:recorded', (op) => {
      if (!op?.objectId) return;
      this.addOperation(op);
    });

    EventBus.on('cad:operation:undone', ({ operationId } = {}) => {
      this.markOperationUndone(operationId);
    });

    EventBus.on('cad:operation:redone', ({ operationId } = {}) => {
      this.unmarkOperationUndone(operationId);
    });
  }

  setActiveTool(toolId) {
    if (!toolId || this._state.activeToolId === toolId) return;
    this._setPartial({ activeToolId: toolId });
  }

  setMode(mode) {
    if (!mode || this._state.mode === mode) return;
    this._setPartial({ mode });
  }

  updateSnapSettings(partial = {}) {
    if (!partial || typeof partial !== 'object') return;
    const current = this._state.snapSettings || {};
    const next = {
      ...current,
      ...partial,
    };
    if (Number.isFinite(next.tolerance)) next.tolerance = Math.max(0.01, next.tolerance);
    if (Number.isFinite(next.gridSize)) next.gridSize = Math.max(0.01, next.gridSize);
    this._setPartial({ snapSettings: next });
    EventBus.emit('cad:snap:changed', next);
  }

  getSnapshot() {
    return { ...this._state };
  }

  addOperation(operation) {
    const id = operation.id || `cadop_${Date.now()}_${++this._opCounter}`;
    const entry = {
      id,
      objectId: operation.objectId,
      type: operation.type || 'operation',
      label: operation.label || operation.type || 'operation',
      payload: operation.payload || null,
      timestamp: operation.timestamp || Date.now(),
    };
    this._setPartial({ operations: [...this._state.operations, entry] });
  }

  toggleSuppressOperation(operationId) {
    if (!operationId) return;
    const next = this._state.suppressedOperationIds.includes(operationId)
      ? this._state.suppressedOperationIds.filter((id) => id !== operationId)
      : [...this._state.suppressedOperationIds, operationId];
    this._setPartial({ suppressedOperationIds: next });
    EventBus.emit('cad:operations:suppression-changed', this.getSnapshot());
  }

  markOperationUndone(operationId) {
    if (!operationId || this._state.undoneOperationIds.includes(operationId)) return;
    const undoneOperationIds = [...this._state.undoneOperationIds, operationId];
    this._setPartial({ undoneOperationIds });
    EventBus.emit('cad:operations:undone-changed', this.getSnapshot());
  }

  unmarkOperationUndone(operationId) {
    if (!operationId) return;
    const undoneOperationIds = this._state.undoneOperationIds.filter((id) => id !== operationId);
    if (undoneOperationIds.length === this._state.undoneOperationIds.length) return;
    this._setPartial({ undoneOperationIds });
    EventBus.emit('cad:operations:undone-changed', this.getSnapshot());
  }

  updateOperationParam(operationId, patch = {}) {
    if (!operationId || !patch || typeof patch !== 'object') return;
    const operations = this._state.operations.map((op) => {
      if (op.id !== operationId) return op;
      const payload = { ...(op.payload || {}), ...patch };
      let label = op.label;
      if (op.type === 'extrude' && Number.isFinite(payload.distance)) {
        const sign = payload.distance >= 0 ? '+' : '';
        label = `extrude ${sign}${payload.distance.toFixed(3)}`;
      }
      return { ...op, payload, label };
    });

    this._setPartial({ operations });
    EventBus.emit('cad:operations:updated', this.getSnapshot());
  }

  moveOperation(operationId, direction) {
    if (!operationId || (direction !== 'up' && direction !== 'down')) return;
    const ops = [...this._state.operations];
    const currentIndex = ops.findIndex((op) => op.id === operationId);
    if (currentIndex < 0) return;

    const current = ops[currentIndex];
    const step = direction === 'up' ? -1 : 1;
    let targetIndex = currentIndex + step;

    while (targetIndex >= 0 && targetIndex < ops.length) {
      if (ops[targetIndex].objectId === current.objectId) {
        const tmp = ops[targetIndex];
        ops[targetIndex] = ops[currentIndex];
        ops[currentIndex] = tmp;
        this._setPartial({ operations: ops });
        EventBus.emit('cad:operations:order-changed', this.getSnapshot());
        return;
      }
      targetIndex += step;
    }
  }

  pruneByExistingObjects() {
    const alive = new Set(this.objs.list().map((r) => r.id));
    const operations = this._state.operations.filter((op) => alive.has(op.objectId));
    const aliveOps = new Set(operations.map((op) => op.id));
    const suppressedOperationIds = this._state.suppressedOperationIds.filter((id) => aliveOps.has(id));
    const undoneOperationIds = this._state.undoneOperationIds.filter((id) => aliveOps.has(id));

    if (
      operations.length !== this._state.operations.length ||
      suppressedOperationIds.length !== this._state.suppressedOperationIds.length ||
      undoneOperationIds.length !== this._state.undoneOperationIds.length
    ) {
      this._setPartial({ operations, suppressedOperationIds, undoneOperationIds });
    }
  }

  hydrateOperations(payload = {}) {
    const operations = Array.isArray(payload.operations) ? payload.operations : [];
    const suppressedOperationIds = Array.isArray(payload.suppressedOperationIds)
      ? payload.suppressedOperationIds
      : [];
    const undoneOperationIds = Array.isArray(payload.undoneOperationIds)
      ? payload.undoneOperationIds
      : [];

    this._setPartial({
      operations: operations
        .filter((op) => op && op.id && op.objectId)
        .map((op) => ({
          id: op.id,
          objectId: op.objectId,
          type: op.type || 'operation',
          label: op.label || op.type || 'operation',
          payload: op.payload || null,
          timestamp: op.timestamp || Date.now(),
        })),
      suppressedOperationIds,
      undoneOperationIds,
    });

    this.pruneByExistingObjects();
  }

  exportOperations() {
    return {
      operations: this._state.operations,
      suppressedOperationIds: this._state.suppressedOperationIds,
      undoneOperationIds: this._state.undoneOperationIds,
    };
  }

  _setPartial(partial) {
    this._state = { ...this._state, ...partial };
    EventBus.emit('cad:state:changed', this.getSnapshot());
  }
}
