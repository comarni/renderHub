import { BaseTool } from './BaseTool.js';

export class ExtrudeTool extends BaseTool {
  constructor() {
    super({ id: 'extrude', label: 'Extrude', shortcut: 'Shift+E' });
    this.defaultDistance = 0.2;
  }

  onActivate(ctx) {
    ctx.selectionManager.activateSubEditTool('extrude');
    ctx.selectionManager.setPickMode('face');
  }

  onDeactivate(ctx) {
    // Return to object selection when leaving extrude mode.
    ctx.selectionManager.activateSubEditTool('move');
    ctx.selectionManager.setPickMode('object');
  }

  executeQuickAction(ctx, payload = {}) {
    const distance = Number(payload.distance ?? this.defaultDistance);
    if (!Number.isFinite(distance) || Math.abs(distance) < 1e-6) {
      return { success: false, message: 'Extrude distance must be a non-zero number.' };
    }
    return ctx.commandParser.execute(`extrude selection ${distance}`);
  }
}
