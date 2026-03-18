/* ═══════════════════════════════════════════════════════════════
   ExportPanel — Unified export UI panel for all registered formats
   ═══════════════════════════════════════════════════════════════
   Opens as a modal overlay on top of the editor.

   Features:
   • Dynamically lists all formats registered in ExportManager
   • Domain-aware hint (reads window.renderHubDomain)
   • Filename + format selection
   • Async export with loading state
   • Inline success / error result feedback
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

export class ExportPanel {
  /**
   * @param {import('./ExportManager.js').ExportManager} exportManager
   */
  constructor(exportManager) {
    this._mgr          = exportManager;
    this._el           = null;
    this._activeFormat = null;

    this._build();
    this._bind();
  }

  /* ── Build DOM ──────────────────────────────────────────────── */

  _build() {
    this._el = document.createElement('div');
    this._el.id        = 'export-panel-overlay';
    this._el.className = 'export-panel-overlay hidden';
    this._el.setAttribute('role', 'dialog');
    this._el.setAttribute('aria-modal', 'true');
    this._el.setAttribute('aria-label', 'Export Scene');

    this._el.innerHTML = `
      <div class="ep-modal">
        <div class="ep-header">
          <span class="ep-title">Export Scene</span>
          <button class="ep-close" aria-label="Close export panel">✕</button>
        </div>

        <div class="ep-body">
          <!-- Format buttons (populated dynamically) -->
          <div class="ep-section-label">Format</div>
          <div class="ep-formats" role="group" aria-label="Export format"></div>

          <!-- Domain hint (shown only when window.renderHubDomain is set) -->
          <div class="ep-domain-hint"></div>

          <!-- Filename -->
          <label class="ep-section-label" for="ep-filename">Filename</label>
          <input
            id="ep-filename"
            class="ep-input"
            type="text"
            value="scene"
            spellcheck="false"
            autocomplete="off"
          />

          <!-- Format description -->
          <p class="ep-format-desc"></p>

          <!-- Export button -->
          <button class="ep-btn ep-btn-primary ep-export-btn">Export</button>

          <!-- Result message -->
          <div class="ep-result hidden" role="alert"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this._el);
    this._populateFormats();
  }

  _populateFormats() {
    const container = this._el.querySelector('.ep-formats');
    container.innerHTML = '';

    const formats = this._mgr.getAvailableFormats();
    formats.forEach((fmt, i) => {
      const btn = document.createElement('button');
      btn.className      = 'ep-format-btn' + (i === 0 ? ' active' : '');
      btn.dataset.format = fmt.name.toLowerCase();
      btn.textContent    = fmt.name;
      btn.title          = fmt.label;
      container.appendChild(btn);
    });

    if (formats.length > 0) {
      this._activeFormat = formats[0].name.toLowerCase();
      this._syncFormatDesc();
    }
  }

  /* ── Event binding ──────────────────────────────────────────── */

  _bind() {
    // Close button
    this._el.querySelector('.ep-close').addEventListener('click', () => this.hide());

    // Click on dark backdrop closes
    this._el.addEventListener('click', e => {
      if (e.target === this._el) this.hide();
    });

    // Format selection (event-delegation)
    this._el.querySelector('.ep-formats').addEventListener('click', e => {
      const btn = e.target.closest('.ep-format-btn');
      if (!btn) return;
      this._el.querySelectorAll('.ep-format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this._activeFormat = btn.dataset.format;
      this._syncFormatDesc();
      this._hideResult();
    });

    // Trigger export on button click
    this._el.querySelector('.ep-export-btn').addEventListener('click', () => this._doExport());

    // Enter key inside filename field triggers export
    this._el.querySelector('#ep-filename').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._doExport(); }
    });

    // Escape closes the panel (only when visible)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this._el.classList.contains('hidden')) {
        e.stopImmediatePropagation();
        this.hide();
      }
    });
  }

  /* ── Helpers ────────────────────────────────────────────────── */

  _syncFormatDesc() {
    const exporter = this._mgr.get(this._activeFormat ?? '');
    const el = this._el.querySelector('.ep-format-desc');
    if (el) el.textContent = exporter?.label ?? '';
  }

  _showResult(message, success) {
    const el = this._el.querySelector('.ep-result');
    el.textContent = message;
    el.className   = `ep-result ep-result-${success ? 'ok' : 'err'}`;
  }

  _hideResult() {
    const el = this._el.querySelector('.ep-result');
    el.className   = 'ep-result hidden';
    el.textContent = '';
  }

  _updateDomainHint() {
    const el     = this._el.querySelector('.ep-domain-hint');
    const domain = window.renderHubDomain ?? 'default';
    if (el) el.textContent = domain !== 'default' ? `Domain: ${domain}` : '';
  }

  /* ── Public API ─────────────────────────────────────────────── */

  show() {
    // Refresh formats in case new exporters were registered after build
    const formats = this._mgr.getAvailableFormats();
    if (this._el.querySelectorAll('.ep-format-btn').length !== formats.length) {
      this._populateFormats();
    }

    this._hideResult();
    this._updateDomainHint();
    this._el.classList.remove('hidden');

    // Focus filename input for keyboard UX
    setTimeout(() => this._el.querySelector('#ep-filename')?.select(), 50);
  }

  hide() {
    this._el.classList.add('hidden');
  }

  toggle() {
    this._el.classList.contains('hidden') ? this.show() : this.hide();
  }

  /* ── Export execution ───────────────────────────────────────── */

  async _doExport() {
    const rawFilename = this._el.querySelector('#ep-filename').value.trim() || 'scene';
    const format      = this._activeFormat;
    const exportBtn   = this._el.querySelector('.ep-export-btn');

    exportBtn.disabled    = true;
    exportBtn.textContent = 'Exporting…';
    this._hideResult();

    try {
      const result = await this._mgr.export(format, {
        filename: rawFilename,
        download: true,
      });

      this._showResult(result.message, result.success);

      if (result.success) {
        EventBus.emit('analytics:event', {
          name:    'export_panel_success',
          payload: { format, filename: rawFilename },
        });
      }
    } finally {
      exportBtn.disabled    = false;
      exportBtn.textContent = 'Export';
    }
  }
}
