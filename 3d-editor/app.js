/* ═══════════════════════════════════════════════════════════════
   app.js — Bootstrap: instantiate all modules + RAF render loop
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

import { EventBus }         from './core/EventBus.js';
import { Renderer }         from './core/Renderer.js';
import { SceneManager }     from './core/Scene.js';
import { CameraManager }    from './core/Camera.js';
import { Grid }             from './core/Grid.js';
import { SelectionManager } from './core/SelectionManager.js';

import { MaterialManager }  from './objects/MaterialManager.js';
import { ObjectManager }    from './objects/ObjectManager.js';

import { CommandParser }    from './commands/CommandParser.js';
import { STLExporter }      from './export/STLExporter.js';
import { HTMLEmbeddedExporter } from './export/HTMLEmbeddedExporter.js';
import { AtmosphericStoryExporter } from './export/AtmosphericStoryExporter.js';
import { ModelImporter }    from './io/ModelImporter.js';

import { Terminal }         from './ui/Terminal.js';
import { PropertiesPanel }  from './ui/PropertiesPanel.js';
import { SceneHierarchy }   from './ui/SceneHierarchy.js';
import { ProjectLibrary }   from './ui/ProjectLibrary.js';
import { ViewportOverlay }  from './ui/ViewportOverlay.js';
import { EnvironmentManager } from './world/EnvironmentManager.js';
import { ScenarioDirector } from './world/ScenarioDirector.js';

/* ══ 1. Wait for DOM ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  init();
});

let _previewObjectUrl = null;

function init() {
  const canvasContainer = document.getElementById('viewport-canvas');
  if (!canvasContainer) {
    console.error('[app] #viewport-canvas not found');
    return;
  }

  /* ══ 2. Three.js Core ══════════════════════════════════════ */

  const sceneManager  = new SceneManager();
  const renderer      = new Renderer(canvasContainer);
  const cameraManager = new CameraManager(canvasContainer, renderer.domElement);

  // Wire resize callback from Renderer to Camera
  renderer._onResize = (w, h) => cameraManager.onResize(w, h);

  const grid = new Grid(sceneManager.scene);

  /* ══ 3. Object System ══════════════════════════════════════ */

  const materialManager = new MaterialManager();
  const objectManager   = new ObjectManager(sceneManager.scene, materialManager);

  /* ══ 4. Selection + Transform Gizmos ══════════════════════ */

  const selectionManager = new SelectionManager(
    cameraManager,
    sceneManager.scene,
    renderer,
    objectManager,
    materialManager
  );

  /* ══ 5. Export ═════════════════════════════════════════════ */

  const stlExporter = new STLExporter(sceneManager.scene, objectManager);
  const htmlExporter = new HTMLEmbeddedExporter(sceneManager.scene, objectManager, materialManager);
  const atmosphericExporter = new AtmosphericStoryExporter(sceneManager.scene, objectManager, materialManager);

  /* ══ 6. Command Parser ═════════════════════════════════════ */

  const commandParser = new CommandParser(
    objectManager,
    materialManager,
    selectionManager,
    cameraManager,
    stlExporter
  );

  const environmentManager = new EnvironmentManager(sceneManager.scene, cameraManager, grid);
  const scenarioDirector = new ScenarioDirector(
    objectManager,
    materialManager,
    selectionManager,
    environmentManager,
    cameraManager
  );
  commandParser.setEnvironmentManager(environmentManager);
  commandParser.setScenarioDirector(scenarioDirector);
  environmentManager.applyPreset('studio');

  /* ══ 6b. Save / Load toolbar buttons ══════════════════════ */

  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');

  let projectLibrary = null;

  const _doSave = () => {
    const name = prompt('Scene name:', 'my-scene') ?? 'my-scene';
    if (name !== null) {
      const result = commandParser.execute(`save ${name}`);
      if (projectLibrary) {
        const localResult = projectLibrary.saveCurrentProject(name);
        showToast(localResult.message, localResult.success ? 'info' : 'warn');
      }
      if (result?.message) showToast(result.message, result.success ? 'info' : 'warn');
    }
  };

  if (btnSave) btnSave.addEventListener('click', _doSave);
  if (btnLoad) btnLoad.addEventListener('click', () => commandParser.execute('load'));

  /* ══ 6c. Import button + drag & drop (Sprint 1.2) ══════════ */

  const modelImporter = new ModelImporter(objectManager);
  commandParser.setImporter(modelImporter);

  commandParser.setAtmosphericExporter(atmosphericExporter);
  const btnImport = document.getElementById('btn-import');
  if (btnImport) btnImport.addEventListener('click', () => modelImporter.openPicker());

  /* ══ 6c. Export buttons (STL + HTML) ════════════════════════ */

  const btnExportSTL = document.getElementById('btn-export-stl');
  const btnExportHTML = document.getElementById('btn-export-html');

  const _doExportSTL = () => {
    const filename = prompt('Export STL as:', 'scene') ?? 'scene';
    if (filename) {
      const result = stlExporter.export(filename);
      showToast(result.message, result.success ? 'info' : 'warn');
    }
  };

  const _doExportHTML = () => {
    const filename = prompt('Export HTML as:', 'scene-export') ?? 'scene-export';
    if (filename) {
      const result = htmlExporter.export(filename);
      showToast(result.message, result.success ? 'info' : 'warn');
    }
  };

  if (btnExportSTL)  btnExportSTL.addEventListener('click',  _doExportSTL);
  if (btnExportHTML) btnExportHTML.addEventListener('click', _doExportHTML);

  /* ══ 6d. Undo / Redo buttons + Ctrl+Z/Y (Sprint 1.3) ══════ */

  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');

  function _updateUndoRedoBtns() {
    const canUndo = commandParser.canUndo();
    const canRedo = commandParser.canRedo();
    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
    // Also update mobile mirror buttons
    const btnUndoM = document.getElementById('btn-undo-m');
    const btnRedoM = document.getElementById('btn-redo-m');
    if (btnUndoM) btnUndoM.disabled = !canUndo;
    if (btnRedoM) btnRedoM.disabled = !canRedo;
  }
  _updateUndoRedoBtns();
  EventBus.on('state:changed', _updateUndoRedoBtns);

  const _doUndo = () => {
    const r = commandParser.undo();
    showToast(r.message, r.success ? 'info' : 'warn');
    _updateUndoRedoBtns();
  };
  const _doRedo = () => {
    const r = commandParser.redo();
    showToast(r.message, r.success ? 'info' : 'warn');
    _updateUndoRedoBtns();
  };

  if (btnUndo) btnUndo.addEventListener('click', _doUndo);
  if (btnRedo) btnRedo.addEventListener('click', _doRedo);

  // Global Ctrl+Z / Ctrl+Y (outside terminal focus)
  document.addEventListener('keydown', e => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === 'z' && !e.shiftKey) {
      if (inInput) return; // let terminal handle its own history
      e.preventDefault();
      _doUndo();
    } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
      if (inInput) return;
      e.preventDefault();
      _doRedo();
    }
  });

  /* ══ 6e. Mobile more-menu (mirrors desktop buttons) ════════ */

  setupMobileMoreMenu({
    _doSave, _doUndo, _doRedo, _doExportSTL, _doExportHTML,
    modelImporter, commandParser,
  });

  /* ══ 7. UI Components ══════════════════════════════════════ */

  const terminal         = new Terminal(commandParser);
  const propertiesPanel  = new PropertiesPanel(commandParser, selectionManager, cameraManager);
  const sceneHierarchy   = new SceneHierarchy(objectManager, selectionManager, commandParser);
  projectLibrary         = new ProjectLibrary(commandParser, () => {
    try {
      return renderer.domElement.toDataURL('image/jpeg', 0.72);
    } catch {
      return null;
    }
  });
  const viewportOverlay  = new ViewportOverlay(commandParser, objectManager, selectionManager);
  setupMobileLayout();
  setupExportPreview();

  /* ══ 8. Render Loop ════════════════════════════════════════ */

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now() * 0.001;
    const delta = Math.min(0.033, now - (animate._prevNow || now));
    animate._prevNow = now;

    // Update OrbitControls (required for damping to work)
    cameraManager.update();

    // Update dynamic world ambience
    environmentManager.update(delta, now);
    scenarioDirector.update(delta, now);

    // Render
    renderer.render(sceneManager.scene, cameraManager.activeCamera);
  }

  animate();

  /* ══ 9. Focus terminal input on load ══════════════════════ */

  const termInput = document.getElementById('terminal-input');
  if (termInput) {
    // Short delay to let browser settle
    setTimeout(() => termInput.focus(), 200);
  }

  console.log('[RenderHub] 3D Editor initialized.');
}

/* ══ Toast notifications (Sprint 1.3) ═══════════════════ */

function showToast(message, type = 'info', duration = 2400) {
  const container = document.getElementById('toast-container');
  if (!container || !message) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Trigger transition
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

function setupExportPreview() {
  const preview = document.getElementById('export-preview');
  const frame = document.getElementById('export-preview-frame');
  const title = document.getElementById('export-preview-title');
  const btnClose = document.getElementById('btn-preview-close');
  const btnOpenTab = document.getElementById('btn-preview-open-tab');

  if (!preview || !frame || !title || !btnClose || !btnOpenTab) return;

  const cleanupUrl = () => {
    if (_previewObjectUrl) {
      URL.revokeObjectURL(_previewObjectUrl);
      _previewObjectUrl = null;
    }
  };

  const closePreview = () => {
    preview.classList.add('hidden');
    frame.removeAttribute('srcdoc');
    cleanupUrl();
  };

  btnClose.addEventListener('click', closePreview);
  btnOpenTab.addEventListener('click', () => {
    if (_previewObjectUrl) window.open(_previewObjectUrl, '_blank', 'noopener,noreferrer');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !preview.classList.contains('hidden')) {
      closePreview();
    }
  });

  EventBus.on('preview:open', ({ html, title: previewTitle }) => {
    cleanupUrl();
    _previewObjectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    title.textContent = previewTitle || 'Atmos Preview';
    frame.srcdoc = html;
    preview.classList.remove('hidden');
    showToast('Preview cargado en RenderHub', 'info');
  });
}

function setupMobileLayout() {
  const btnScene = document.getElementById('btn-mobile-scene');
  const btnProps = document.getElementById('btn-mobile-props');
  const btnTerm = document.getElementById('btn-mobile-terminal');
  const backdrop = document.getElementById('mobile-backdrop');

  if (!btnScene || !btnProps || !btnTerm || !backdrop) return;

  const closeDrawers = () => {
    document.body.classList.remove('show-hierarchy');
    document.body.classList.remove('show-properties');
  };

  btnScene.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('show-hierarchy');
    closeDrawers();
    if (!isOpen) document.body.classList.add('show-hierarchy');
  });

  btnProps.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('show-properties');
    closeDrawers();
    if (!isOpen) document.body.classList.add('show-properties');
  });

  backdrop.addEventListener('click', () => {
    closeDrawers();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      document.body.classList.remove('show-hierarchy');
      document.body.classList.remove('show-properties');
      document.body.classList.remove('show-terminal');
    }
  });

  // ── Visual Viewport: keep layout correct when soft keyboard opens ──
  // On iOS/Android the visual viewport shrinks when the keyboard appears.
  // We update a CSS variable so the app layout can respond.
  if ('visualViewport' in window) {
    const vv = window.visualViewport;
    const applyVV = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    };
    vv.addEventListener('resize', applyVV);
    vv.addEventListener('scroll', applyVV);
    applyVV();
  }

  // ── Mobile Send button ──────────────────────────────────────────────
  const btnSend = document.getElementById('btn-terminal-send');
  const termInput = document.getElementById('terminal-input');

  btnTerm.addEventListener('click', () => {
    const wasOpen = document.body.classList.contains('show-terminal');
    closeDrawers();
    document.body.classList.toggle('show-terminal', !wasOpen);
    // If opening the terminal, focus the input after the CSS transition settles
    if (!wasOpen && termInput) {
      setTimeout(() => termInput.focus(), 280);
    }
  });

  if (btnSend && termInput) {
    btnSend.addEventListener('click', () => {
      // Dispatch an Enter keydown so the Terminal class handles submission
      termInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      termInput.focus();
    });
  }
}

/**
 * Wire up the mobile ⋮ more-actions dropdown that mirrors the desktop header buttons.
 */
function setupMobileMoreMenu({ _doSave, _doUndo, _doRedo, _doExportSTL, _doExportHTML, modelImporter, commandParser }) {
  const btn  = document.getElementById('btn-mobile-more');
  const menu = document.getElementById('mobile-more-menu');
  if (!btn || !menu) return;

  const openMenu = () => {
    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    menu.removeAttribute('aria-hidden');
  };
  const closeMenu = () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
  };
  const toggleMenu = () => menu.classList.contains('open') ? closeMenu() : openMenu();

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });

  // Wire menu items — each closes the menu after acting
  const wire = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { closeMenu(); fn(); });
  };

  wire('btn-undo-m',       _doUndo);
  wire('btn-redo-m',       _doRedo);
  wire('btn-import-m',     () => modelImporter.openPicker());
  wire('btn-save-m',       _doSave);
  wire('btn-load-m',       () => commandParser.execute('load'));
  wire('btn-export-stl-m', _doExportSTL);
  wire('btn-export-html-m', _doExportHTML);
}
