/* ═══════════════════════════════════════════════════════════════
   ProjectLibrary — Local project gallery with thumbnails
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

const STORAGE_KEY = 'renderhub_projects_v1';
const MAX_PROJECTS = 12;

export class ProjectLibrary {
  /**
   * @param {import('../commands/CommandParser.js').CommandParser} commandParser
   * @param {() => string | null} captureThumbnail
   */
  constructor(commandParser, captureThumbnail) {
    this.parser = commandParser;
    this.captureThumbnail = captureThumbnail;

    this._listEl = document.getElementById('project-library');
    this._countEl = document.getElementById('project-count');

    if (!this._listEl) return;

    this._listEl.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const id = button.dataset.id;
      if (!id) return;

      if (button.dataset.action === 'open') this.openProject(id);
      if (button.dataset.action === 'delete') this.deleteProject(id);
    });

    this.render();
  }

  saveCurrentProject(name) {
    const scene = this.parser.serializeScene(name);
    const thumbnail = this.captureThumbnail?.() || null;
    const now = new Date().toISOString();
    const entries = this._read();
    const existingIndex = entries.findIndex(entry => entry.name.toLowerCase() === name.toLowerCase());
    const nextEntry = {
      id: existingIndex >= 0 ? entries[existingIndex].id : `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      updatedAt: now,
      createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : now,
      thumbnail,
      scene,
    };

    if (existingIndex >= 0) entries.splice(existingIndex, 1);
    entries.unshift(nextEntry);
    const trimmed = entries.slice(0, MAX_PROJECTS);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      this.render();
      return { success: true, message: `Saved local project "${name}"` };
    } catch (error) {
      return { success: false, message: `Local save failed: ${error.message}` };
    }
  }

  openProject(id) {
    const entry = this._read().find(project => project.id === id);
    if (!entry) {
      EventBus.emit('terminal:log', { type: 'error', message: 'Project not found in local library.' });
      return;
    }

    try {
      const message = this.parser.loadSceneData(entry.scene);
      EventBus.emit('terminal:log', { type: 'info', message: `Opened local project "${entry.name}". ${message}` });
      EventBus.emit('state:changed', { type: 'scene' });
    } catch (error) {
      EventBus.emit('terminal:log', { type: 'error', message: `Failed to open local project: ${error.message}` });
    }
  }

  deleteProject(id) {
    const entries = this._read();
    const next = entries.filter(entry => entry.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.render();
    EventBus.emit('terminal:log', { type: 'info', message: 'Removed project from local library.' });
  }

  render() {
    if (!this._listEl) return;

    const entries = this._read();
    if (this._countEl) this._countEl.textContent = String(entries.length);
    this._listEl.innerHTML = '';

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'project-library-empty';
      empty.textContent = 'No local projects yet';
      this._listEl.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const card = document.createElement('div');
      card.className = 'project-card';

      const thumb = document.createElement('div');
      thumb.className = 'project-thumb';
      if (entry.thumbnail) thumb.style.backgroundImage = `url(${entry.thumbnail})`;
      else thumb.textContent = 'No preview';

      const meta = document.createElement('div');
      meta.className = 'project-meta';
      meta.innerHTML = `
        <div class="project-name" title="${entry.name}">${entry.name}</div>
        <div class="project-date">${new Date(entry.updatedAt).toLocaleString()}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'project-actions';
      actions.innerHTML = `
        <button class="btn-project" data-action="open" data-id="${entry.id}">Open</button>
        <button class="btn-project danger" data-action="delete" data-id="${entry.id}">Delete</button>
      `;

      card.appendChild(thumb);
      card.appendChild(meta);
      card.appendChild(actions);
      this._listEl.appendChild(card);
    });
  }

  _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
