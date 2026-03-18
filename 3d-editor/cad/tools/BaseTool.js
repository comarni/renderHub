export class BaseTool {
  constructor({ id, label, shortcut = '' }) {
    this.id = id;
    this.label = label;
    this.shortcut = shortcut;
  }

  onActivate(_ctx) {}
  onDeactivate(_ctx) {}

  /**
   * Optional quick action for floating UI.
   * @returns {{ success: boolean, message: string }|null}
   */
  executeQuickAction(_ctx, _payload) {
    return null;
  }
}
