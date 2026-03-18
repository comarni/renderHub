import { BaseTool } from './BaseTool.js';

const MODE_MAP = {
  move: 'translate',
  rotate: 'rotate',
  scale: 'scale',
};

export class TransformTool extends BaseTool {
  constructor({ id, label, shortcut }) {
    super({ id, label, shortcut });
    this.mode = MODE_MAP[id] || 'translate';
  }

  onActivate(ctx) {
    ctx.selectionManager.activateSubEditTool('move');
    ctx.selectionManager.setPickMode('object');
    ctx.selectionManager.setMode(this.mode);
  }
}
