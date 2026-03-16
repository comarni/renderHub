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

import { Terminal }         from './ui/Terminal.js';
import { PropertiesPanel }  from './ui/PropertiesPanel.js';
import { SceneHierarchy }   from './ui/SceneHierarchy.js';
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

  /* ══ 7. UI Components ══════════════════════════════════════ */

  const terminal         = new Terminal(commandParser);
  const propertiesPanel  = new PropertiesPanel(commandParser, selectionManager, cameraManager);
  const sceneHierarchy   = new SceneHierarchy(objectManager, selectionManager, commandParser);
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
