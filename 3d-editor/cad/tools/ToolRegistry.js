import { EventBus } from '../../core/EventBus.js';

/**
 * ToolRegistry
 * Holds CAD tools and controls activation/deactivation lifecycle.
 */
export class ToolRegistry {
  constructor(cadState, context) {
    this.cadState = cadState;
    this.ctx = context;
    this.tools = new Map();
    this.activeTool = null;
  }

  register(tool) {
    this.tools.set(tool.id, tool);
  }

  activate(toolId) {
    const next = this.tools.get(toolId);
    if (!next) return false;
    if (this.activeTool?.id === next.id) return true;

    if (this.activeTool) this.activeTool.onDeactivate(this.ctx);

    this.activeTool = next;
    this.activeTool.onActivate(this.ctx);
    this.cadState.setActiveTool(next.id);
    EventBus.emit('cad:tool:changed', { id: next.id, label: next.label });
    return true;
  }

  getActive() {
    return this.activeTool;
  }

  list() {
    return [...this.tools.values()];
  }
}
