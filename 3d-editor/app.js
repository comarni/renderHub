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

const analytics = {
  events: [],
  track(name, payload = {}) {
    const evt = {
      name,
      payload,
      ts: new Date().toISOString(),
    };
    this.events.push(evt);
    if (this.events.length > 200) this.events.shift();
    try {
      localStorage.setItem('renderhub.analytics.events', JSON.stringify(this.events));
    } catch {
      // Ignore localStorage errors in private mode/quota limits.
    }
    console.info('[analytics]', evt);
    EventBus.emit('analytics:tracked', evt);
  },
};

window.renderHubAnalytics = analytics;

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

  EventBus.on('analytics:event', ({ name, payload }) => {
    if (!name) return;
    analytics.track(name, payload || {});
  });

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

  // Local-only mode: do not initialize remote AI clients.
  const modelImporter = new ModelImporter(objectManager, cameraManager, selectionManager, null, renderer);
  commandParser.setImporter(modelImporter);

  commandParser.setAtmosphericExporter(atmosphericExporter);
  const btnImport = document.getElementById('btn-import');
  const btnImportImage = document.getElementById('btn-import-image');
  const btnImageTo3D = document.getElementById('btn-image-to-3d');
  const btnImportWeb = document.getElementById('btn-import-web');
  if (btnImport) btnImport.addEventListener('click', () => modelImporter.openModelPicker());
  if (btnImportImage) btnImportImage.addEventListener('click', () => modelImporter.openImagePlanePicker());
  if (btnImageTo3D) btnImageTo3D.addEventListener('click', () => modelImporter.openImage3DPicker());
  if (btnImportWeb) btnImportWeb.addEventListener('click', () => modelImporter.openWebPlaneDialog());

  /* ══ 6c. Export buttons (STL + HTML) ════════════════════════ */

  const btnExportSTL = document.getElementById('btn-export-stl');
  const btnExportHTML = document.getElementById('btn-export-html');
  const exportPresetSelect = document.getElementById('export-preset');

  if (btnExportSTL) {
    btnExportSTL.addEventListener('click', () => {
      const filename = prompt('Export STL as:', 'scene') ?? 'scene';
      if (filename) {
        EventBus.emit('analytics:event', {
          name: 'export_clicked',
          payload: {
            source: 'button',
            exportType: 'stl',
            filename,
          },
        });
        const result = stlExporter.export(filename);
        showToast(result.message, result.success ? 'info' : 'warn');
      }
    });
  }

  if (btnExportHTML) {
    btnExportHTML.addEventListener('click', () => {
      const filename = prompt('Export HTML as:', 'scene-export') ?? 'scene-export';
      if (filename) {
        const preset = exportPresetSelect?.value || 'agency';
        EventBus.emit('analytics:event', {
          name: 'export_clicked',
          payload: {
            source: 'button',
            exportType: 'html',
            preset,
            filename,
          },
        });
        const result = htmlExporter.export(filename, { preset });
        showToast(result.message, result.success ? 'info' : 'warn');
      }
    });
  }

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
  setupExportPreview();
  setupGuidedDemo(commandParser);

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
    modelImporter.update();

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

function setupGuidedDemo(commandParser) {
  const panel = document.getElementById('guided-demo');
  const btnStart = document.getElementById('btn-demo');
  const btnClose = document.getElementById('btn-demo-close');
  const btnPrev = document.getElementById('btn-demo-prev');
  const btnNext = document.getElementById('btn-demo-next');
  const btnRun = document.getElementById('btn-demo-run');
  const stepEl = document.getElementById('guided-demo-step');
  const titleEl = document.getElementById('guided-demo-title');
  const textEl = document.getElementById('guided-demo-text');
  const exportPresetSelect = document.getElementById('export-preset');
  const btnExportHTML = document.getElementById('btn-export-html');

  if (!panel || !btnStart || !btnClose || !btnPrev || !btnNext || !btnRun || !stepEl || !titleEl || !textEl) return;

  const runCommand = (command) => {
    EventBus.emit('analytics:event', {
      name: 'prompt_used',
      payload: {
        source: 'guided_demo',
        prompt: command,
      },
    });
    const result = commandParser.execute(command);
    showToast(result.message || command, result.success ? 'info' : 'warn');
  };

  const steps = [
    {
      title: 'Crear base de escena',
      text: 'Genera un entorno base para demo comercial.',
      run: () => runCommand('scenario cityTraffic 2'),
    },
    {
      title: 'Añadir producto protagonista',
      text: 'Crea un objeto hero para demostrar personalización.',
      run: () => runCommand('gen car gold 1'),
    },
    {
      title: 'Aplicar look premium',
      text: 'Activa un ambiente para demo orientada a cliente.',
      run: () => runCommand('environment sky'),
    },
    {
      title: 'Preset de export',
      text: 'Selecciona preset de vertical para salida final.',
      run: () => {
        if (exportPresetSelect) exportPresetSelect.value = 'agency';
        showToast('Preset seleccionado: agency', 'info');
      },
    },
    {
      title: 'Exportar demo',
      text: 'Descarga el HTML interactivo listo para presentar.',
      run: () => {
        if (btnExportHTML) btnExportHTML.click();
      },
    },
  ];

  let idx = 0;

  const renderStep = () => {
    const step = steps[idx];
    stepEl.textContent = `Step ${idx + 1}/${steps.length}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    btnPrev.disabled = idx === 0;
    btnNext.disabled = idx === steps.length - 1;
  };

  btnStart.addEventListener('click', () => {
    panel.classList.remove('hidden');
    idx = 0;
    renderStep();
    EventBus.emit('analytics:event', {
      name: 'guided_demo_opened',
      payload: { source: 'header_button' },
    });
  });

  btnClose.addEventListener('click', () => panel.classList.add('hidden'));
  btnPrev.addEventListener('click', () => {
    idx = Math.max(0, idx - 1);
    renderStep();
  });
  btnNext.addEventListener('click', () => {
    idx = Math.min(steps.length - 1, idx + 1);
    renderStep();
  });
  btnRun.addEventListener('click', () => steps[idx].run());

  renderStep();
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
