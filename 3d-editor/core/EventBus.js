/* ═══════════════════════════════════════════════════════════════
   EventBus — Micro pub/sub (no dependencies)
   Central communication channel between all editor modules.
   ═══════════════════════════════════════════════════════════════ */

const _handlers = new Map();

export const EventBus = {
  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} fn
   */
  on(event, fn) {
    if (!_handlers.has(event)) _handlers.set(event, new Set());
    _handlers.get(event).add(fn);
  },

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} fn
   */
  off(event, fn) {
    if (_handlers.has(event)) _handlers.get(event).delete(fn);
  },

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    if (_handlers.has(event)) {
      _handlers.get(event).forEach(fn => {
        try { fn(data); }
        catch (e) { console.error(`[EventBus] Error in handler for "${event}":`, e); }
      });
    }
  }
};

/*
  Events used by the editor:
  ─────────────────────────
  'state:changed'    { type: 'scene'|'selection'|'transform'|'material'|'camera' }
  'terminal:log'     { message: string, type: 'output'|'error'|'info'|'input' }
  'selection:changed' { ids: Set<string> }
*/
