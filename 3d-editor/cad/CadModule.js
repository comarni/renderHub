import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';
import { CadState } from './core/CadState.js';
import { SnapManager } from './core/SnapManager.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { TransformTool } from './tools/TransformTool.js';
import { ExtrudeTool } from './tools/ExtrudeTool.js';
import { CadToolbar } from './ui/CadToolbar.js';
import { CadFloatingUI } from './ui/CadFloatingUI.js';
import { SnapPanel } from './ui/SnapPanel.js';

function mapSelectionModeToTool(mode) {
  if (mode === 'rotate') return 'rotate';
  if (mode === 'scale') return 'scale';
  return 'move';
}

function getEditableMesh(root) {
  if (root?.isMesh && root.geometry?.attributes?.position) return root;
  let found = null;
  root?.traverse((child) => {
    if (!found && child.isMesh && child.geometry?.attributes?.position) found = child;
  });
  return found;
}

function restoreGeometry(editableMesh, geometryState) {
  if (!editableMesh || !geometryState?.position) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geometryState.position, 3));
  if (Array.isArray(geometryState.index) && geometryState.index.length) {
    geometry.setIndex(geometryState.index);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  editableMesh.geometry.dispose();
  editableMesh.geometry = geometry;
}

function applyTransformState(mesh, state) {
  if (!mesh || !state) return;
  if (Array.isArray(state.position) && state.position.length === 3) {
    mesh.position.fromArray(state.position);
  }
  if (Array.isArray(state.rotation) && state.rotation.length === 3) {
    mesh.rotation.set(state.rotation[0], state.rotation[1], state.rotation[2]);
  }
  if (Array.isArray(state.scale) && state.scale.length === 3) {
    mesh.scale.fromArray(state.scale);
  }
  if (typeof state.visible === 'boolean') {
    mesh.visible = state.visible;
  }
}

function applyMaterialState(mesh, state) {
  const materialState = state?.material;
  if (!mesh || !materialState?.color) return;
  mesh.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      if (mat.color) mat.color.set(materialState.color);
      if (Number.isFinite(materialState.roughness) && Number.isFinite(mat.roughness)) {
        mat.roughness = materialState.roughness;
      }
      if (Number.isFinite(materialState.metalness) && Number.isFinite(mat.metalness)) {
        mat.metalness = materialState.metalness;
      }
      mat.needsUpdate = true;
    });
  });
}

function applyStateSnapshot(record, snapshot) {
  if (!record || !snapshot) return;
  applyTransformState(record.mesh, snapshot);
  applyMaterialState(record.mesh, snapshot);
  const editable = getEditableMesh(record.mesh);
  if (editable && snapshot.geometry) {
    restoreGeometry(editable, snapshot.geometry);
  }
}

function applyExtrusionData(record, extrusion, overrideDistance = null) {
  const editable = getEditableMesh(record.mesh);
  if (!editable?.geometry?.attributes?.position) return;
  const { vertexIndices, normal, distance } = extrusion || {};
  const finalDistance = Number.isFinite(overrideDistance) ? overrideDistance : distance;
  if (!Array.isArray(vertexIndices) || vertexIndices.length === 0) return;
  if (!Array.isArray(normal) || normal.length !== 3 || !Number.isFinite(finalDistance)) return;

  const n = new THREE.Vector3(normal[0], normal[1], normal[2]);
  if (n.lengthSq() < 1e-10) return;
  n.normalize();

  const pos = editable.geometry.attributes.position;
  vertexIndices.forEach((idx) => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= pos.count) return;
    const v = new THREE.Vector3().fromBufferAttribute(pos, idx).addScaledVector(n, finalDistance);
    pos.setXYZ(idx, v.x, v.y, v.z);
  });
  pos.needsUpdate = true;
  editable.geometry.computeVertexNormals();
  editable.geometry.computeBoundingBox();
  editable.geometry.computeBoundingSphere();
}

function applyOperationReplay(state, objectManager) {
  const operations = state.operations || [];
  const suppressed = new Set(state.suppressedOperationIds || []);
  const undone = new Set(state.undoneOperationIds || []);

  const byObject = new Map();
  operations.forEach((op) => {
    if (!op?.objectId) return;
    if (!byObject.has(op.objectId)) byObject.set(op.objectId, []);
    byObject.get(op.objectId).push(op);
  });

  objectManager.list().forEach((record) => {
    const ops = byObject.get(record.id) || [];
    if (!ops.length) return;

    const createOp = ops.find((op) => op.type === 'create');
    if (createOp && (suppressed.has(createOp.id) || undone.has(createOp.id))) {
      record.mesh.visible = false;
      return;
    }

    record.mesh.visible = true;

    const baseState = createOp?.payload?.base;
    if (baseState) {
      applyTransformState(record.mesh, baseState);
      applyMaterialState(record.mesh, baseState);
      const editable = getEditableMesh(record.mesh);
      if (editable && baseState.geometry) {
        restoreGeometry(editable, baseState.geometry);
      }
    }

    ops.forEach((op) => {
      if (!op || op.type === 'create' || suppressed.has(op.id) || undone.has(op.id)) return;
      const payload = op.payload || {};

      if (op.type === 'extrude' && payload.extrusion) {
        applyExtrusionData(record, payload.extrusion, payload.distance);
      }

      if (payload.after) {
        applyStateSnapshot(record, payload.after);
      }
    });
  });
}

export function initCadModule({ commandParser, selectionManager, objectManager }) {
  const viewportWrapper = document.getElementById('viewport-wrapper');
  if (!viewportWrapper) return null;

  const cadState = new CadState(selectionManager, objectManager);
  window.renderHubCadState = cadState;
  const snapManager = new SnapManager({
    scene: selectionManager.scene,
    cameraManager: selectionManager.cam,
    objectManager,
    selectionManager,
  });
  snapManager.updateSettings(cadState.getSnapshot().snapSettings);
  selectionManager.setSnapProvider(snapManager);
  const context = {
    commandParser,
    selectionManager,
    objectManager,
    state: cadState,
  };

  const toolRegistry = new ToolRegistry(cadState, context);
  toolRegistry.register(new TransformTool({ id: 'move', label: 'Move', shortcut: 'M' }));
  toolRegistry.register(new TransformTool({ id: 'rotate', label: 'Rotate', shortcut: 'R' }));
  toolRegistry.register(new TransformTool({ id: 'scale', label: 'Scale', shortcut: 'S' }));
  toolRegistry.register(new ExtrudeTool());

  new CadToolbar({ mountParent: viewportWrapper, toolRegistry });
  new CadFloatingUI({ mountParent: viewportWrapper, toolRegistry });
  new SnapPanel({ mountParent: viewportWrapper });

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key.toLowerCase() === 'm') toolRegistry.activate('move');
      if (e.key.toLowerCase() === 'r') toolRegistry.activate('rotate');
      if (e.key.toLowerCase() === 's') toolRegistry.activate('scale');
    }

    if (e.shiftKey && e.code === 'KeyE') {
      e.preventDefault();
      toolRegistry.activate('extrude');
    }

    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (e.code === 'Digit0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        cadState.updateSnapSettings({ enabled: !cadState.getSnapshot().snapSettings.enabled });
      }
      if (e.code === 'Digit1') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const curr = cadState.getSnapshot().snapSettings;
        cadState.updateSnapSettings({ vertex: !curr.vertex });
      }
      if (e.code === 'Digit2') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const curr = cadState.getSnapshot().snapSettings;
        cadState.updateSnapSettings({ edge: !curr.edge });
      }
      if (e.code === 'Digit3') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const curr = cadState.getSnapshot().snapSettings;
        cadState.updateSnapSettings({ grid: !curr.grid });
      }
    }
  });

  // Keep new CAD state synchronized when old controls are used.
  EventBus.on('state:changed', ({ type } = {}) => {
    if (toolRegistry.getActive()?.id === 'extrude') return;
    if (type !== 'selection' && type !== 'transform') return;
    const toolId = mapSelectionModeToTool(selectionManager.mode);
    if (toolId !== cadState.getSnapshot().activeToolId) {
      toolRegistry.activate(toolId);
    }
  });

  EventBus.on('cad:tool:changed', ({ label }) => {
    const activeLabel = document.getElementById('active-tool-label');
    if (activeLabel) activeLabel.textContent = label;
  });

  EventBus.on('cad:operation:toggle-suppress', ({ operationId } = {}) => {
    if (!operationId) return;
    cadState.toggleSuppressOperation(operationId);
  });

  EventBus.on('cad:operation:update-param', ({ operationId, patch } = {}) => {
    if (!operationId || !patch) return;
    cadState.updateOperationParam(operationId, patch);
  });

  EventBus.on('cad:operation:move', ({ operationId, direction } = {}) => {
    if (!operationId) return;
    cadState.moveOperation(operationId, direction);
  });

  EventBus.on('cad:snap:update', (partial = {}) => {
    cadState.updateSnapSettings(partial);
  });

  EventBus.on('cad:snap:changed', (settings) => {
    snapManager.updateSettings(settings || {});
  });

  EventBus.on('cad:operations:suppression-changed', (state) => {
    applyOperationReplay(state, objectManager);
    EventBus.emit('state:changed', { type: 'scene' });
  });

  EventBus.on('cad:operations:order-changed', (state) => {
    applyOperationReplay(state, objectManager);
    EventBus.emit('state:changed', { type: 'scene' });
  });

  EventBus.on('cad:operations:updated', (state) => {
    applyOperationReplay(state, objectManager);
    EventBus.emit('state:changed', { type: 'scene' });
  });

  EventBus.on('cad:operations:undone-changed', (state) => {
    applyOperationReplay(state, objectManager);
    EventBus.emit('state:changed', { type: 'scene' });
  });

  EventBus.on('scene:loaded', ({ cad } = {}) => {
    cadState.hydrateOperations(cad || {});
    applyOperationReplay(cadState.getSnapshot(), objectManager);
    EventBus.emit('state:changed', { type: 'scene' });
  });

  toolRegistry.activate('move');
  applyOperationReplay(cadState.getSnapshot(), objectManager);

  EventBus.on('state:changed', ({ type } = {}) => {
    if (type === 'scene' || type === 'geometry') {
      snapManager.invalidateAll();
    }
  });

  return {
    state: cadState,
    tools: toolRegistry,
  };
}
