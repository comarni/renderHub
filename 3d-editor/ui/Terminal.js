/* ═══════════════════════════════════════════════════════════════
   Terminal — CLI panel: input, history (↑↓), autocomplete (Tab)
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

const ALL_COMMANDS = [
  'add', 'select', 'deselect', 'move', 'rotate', 'scale',
  'color', 'material', 'roughness', 'metalness',
  'animate', 'fx', 'demo', 'timeline',
  'duplicate', 'delete', 'rename', 'list', 'focus',
  'reset', 'export', 'exportar', 'scenario', 'shuffle', 'view', 'wireframe', 'undo', 'redo', 'help'
];

const COMMAND_HINTS = {
  add:      'add <cube|sphere|cylinder|plane> [name]',
  select:   'select <name|all>',
  move:     'move <x> <y> <z>',
  rotate:   'rotate <axis> <deg>  or  rotate <x> <y> <z>',
  scale:    'scale <x> <y> <z>  or  scale <uniform>',
  color:    'color <#hex>',
  material: 'material <plastic|metal|matte|glass>',
  roughness:'roughness <0-1>',
  metalness:'metalness <0-1>',
  animate:  'animate <hover|tremor|shiver|breathe|reactive|alive|liquid|magnetic|glitch|breathing-architecture|clear>',
  fx:       'fx <preset>   alias de animate',
  demo:     'demo <reactive|cinematic|portfolio>',
  timeline: 'timeline <cinematic|portfolio|pulse|stop>',
  rename:   'rename <newname>',
  export:   'export [filename.stl]',
  exportar: 'exportar [nombre] [escenas]',
  scenario: 'scenario <cityTraffic|airplaneSky|harborBoat|forestWildlife|robotFactory> [shuffle]',
  shuffle:  'shuffle [scenario]',
  view:     'view <top|front|right|perspective>',
};

export class Terminal {
  /**
   * @param {import('../commands/CommandParser.js').CommandParser} commandParser
   */
  constructor(commandParser) {
    this.parser = commandParser;

    this._history = [];      // past commands
    this._histIdx = -1;      // current history cursor
    this._histDraft = '';    // draft before navigating history

    this._output = document.getElementById('terminal-output');
    this._input  = document.getElementById('terminal-input');

    if (!this._output || !this._input) {
      console.error('[Terminal] DOM elements not found');
      return;
    }

    this._setupListeners();

    // Listen for programmatic log messages
    EventBus.on('terminal:log', ({ message, type }) => {
      this._appendLine(message, type || 'info');
    });

    // Clear button
    const clearBtn = document.getElementById('btn-clear-terminal');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      this._output.innerHTML = '';
    });

    this._appendLine('RenderHub 3D Editor ready.', 'info');
    this._appendLine('Type "help" for a list of commands.', 'info');
  }

  _setupListeners() {
    this._input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
          this._submit();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._historyUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this._historyDown();
          break;
        case 'Tab':
          e.preventDefault();
          this._autocomplete();
          break;
      }
    });

    // Focus terminal input when clicking on the terminal panel
    const panel = document.getElementById('terminal-panel');
    if (panel) {
      panel.addEventListener('click', () => {
        this._input.focus();
      });
    }
  }

  _submit() {
    const raw = this._input.value.trim();
    if (!raw) return;

    EventBus.emit('analytics:event', {
      name: 'prompt_used',
      payload: {
        prompt: raw.slice(0, 140),
        source: 'terminal',
      },
    });

    // Record in history (avoid duplicates at top)
    if (this._history[0] !== raw) this._history.unshift(raw);
    if (this._history.length > 100) this._history.pop();
    this._histIdx   = -1;
    this._histDraft = '';

    // Show command in terminal
    this._appendLine(raw, 'input');

    // Execute
    const result = this.parser.execute(raw);
    if (result.message) {
      this._appendLine(result.message, result.success ? 'output' : 'error');
    }

    this._input.value = '';
    this._scrollToBottom();
  }

  _historyUp() {
    if (this._history.length === 0) return;
    if (this._histIdx === -1) {
      this._histDraft = this._input.value;
    }
    this._histIdx = Math.min(this._histIdx + 1, this._history.length - 1);
    this._input.value = this._history[this._histIdx];
    // Move cursor to end
    setTimeout(() => this._input.setSelectionRange(999, 999), 0);
  }

  _historyDown() {
    if (this._histIdx === -1) return;
    this._histIdx--;
    this._input.value = this._histIdx === -1
      ? this._histDraft
      : this._history[this._histIdx];
    setTimeout(() => this._input.setSelectionRange(999, 999), 0);
  }

  _autocomplete() {
    const val = this._input.value.toLowerCase().trim();
    if (!val) return;

    const parts = val.split(/\s+/);
    const cmd   = parts[0];

    if (parts.length === 1) {
      // Complete the command name
      const match = ALL_COMMANDS.find(c => c.startsWith(cmd) && c !== cmd);
      if (match) {
        this._input.value = match + ' ';
        return;
      }
    }

    // Show hint for known command
    if (COMMAND_HINTS[cmd]) {
      this._appendLine(`Hint: ${COMMAND_HINTS[cmd]}`, 'info');
      this._scrollToBottom();
    }
  }

  /** Append a line to the terminal output */
  _appendLine(text, type = 'output') {
    const lines = String(text).split('\n');
    lines.forEach(line => {
      const span = document.createElement('span');
      span.className = `terminal-line ${type}`;
      span.textContent = line;
      this._output.appendChild(span);
    });
    this._scrollToBottom();
  }

  _scrollToBottom() {
    this._output.scrollTop = this._output.scrollHeight;
  }

  /** External method — focus the input */
  focus() { this._input && this._input.focus(); }
}
