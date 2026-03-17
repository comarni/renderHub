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
import { ModelImporter }    from './io/ModelImporter.js';

import { Terminal }         from './ui/Terminal.js';
import { PropertiesPanel }  from './ui/PropertiesPanel.js';
import { SceneHierarchy }   from './ui/SceneHierarchy.js';
import { ProjectLibrary }   from './ui/ProjectLibrary.js';
import { ViewportOverlay }  from './ui/ViewportOverlay.js';

/* ══ 1. Wait for DOM ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  init();
});

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

  /* ══ 6. Command Parser ═════════════════════════════════════ */

  const commandParser = new CommandParser(
    objectManager,
    materialManager,
    selectionManager,
    cameraManager,
    stlExporter
  );

  /* ══ 6b. Save / Load toolbar buttons ══════════════════════ */

  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');

  let projectLibrary = null;

  if (btnSave) btnSave.addEventListener('click', () => {
    const name = prompt('Scene name:', 'my-scene') ?? 'my-scene';
    if (name !== null) {
      const result = commandParser.execute(`save ${name}`);
      if (projectLibrary) {
        const localResult = projectLibrary.saveCurrentProject(name);
        showToast(localResult.message, localResult.success ? 'info' : 'warn');
      }
      if (result?.message) showToast(result.message, result.success ? 'info' : 'warn');
    }
  });
  if (btnLoad) btnLoad.addEventListener('click', () => {
    commandParser.execute('load');
  });
  /* ══ 6c. Import button + drag & drop (Sprint 1.2) ══════════ */

  const modelImporter = new ModelImporter(objectManager);
  commandParser.setImporter(modelImporter);

  const btnImport = document.getElementById('btn-import');
  if (btnImport) btnImport.addEventListener('click', () => modelImporter.openPicker());

  /* ══ 6d. Undo / Redo buttons + Ctrl+Z/Y (Sprint 1.3) ══════ */

  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');

  function _updateUndoRedoBtns() {
    if (btnUndo) btnUndo.disabled = !commandParser.canUndo();
    if (btnRedo) btnRedo.disabled = !commandParser.canRedo();
  }
  _updateUndoRedoBtns();
  EventBus.on('state:changed', _updateUndoRedoBtns);

  if (btnUndo) btnUndo.addEventListener('click', () => {
    const r = commandParser.undo();
    showToast(r.message, r.success ? 'info' : 'warn');
    _updateUndoRedoBtns();
  });
  if (btnRedo) btnRedo.addEventListener('click', () => {
    const r = commandParser.redo();
    showToast(r.message, r.success ? 'info' : 'warn');
    _updateUndoRedoBtns();
  });

  // Global Ctrl+Z / Ctrl+Y (outside terminal focus)
  document.addEventListener('keydown', e => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === 'z' && !e.shiftKey) {
      if (inInput) return; // let terminal handle its own history
      e.preventDefault();
      const r = commandParser.undo();
      showToast(r.message, r.success ? 'info' : 'warn');
      _updateUndoRedoBtns();
    } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
      if (inInput) return;
      e.preventDefault();
      const r = commandParser.redo();
      showToast(r.message, r.success ? 'info' : 'warn');
      _updateUndoRedoBtns();
    }
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

  /* ══ 8. Render Loop ════════════════════════════════════════ */

  function animate() {
    requestAnimationFrame(animate);

    // Update OrbitControls (required for damping to work)
    cameraManager.update();

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

  btnTerm.addEventListener('click', () => {
    document.body.classList.toggle('show-terminal');
    closeDrawers();
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
}
