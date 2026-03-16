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
