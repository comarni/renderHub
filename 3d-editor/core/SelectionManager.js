/* ═══════════════════════════════════════════════════════════════
   SelectionManager — Raycasting, multi-select, TransformControls
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { EventBus } from './EventBus.js';

// Blender orange — used for selection emissive highlight
const SELECT_COLOR = 0xe87d0d;

export class SelectionManager {
  /**
   * @param {import('./Camera.js').CameraManager}       cameraManager
   * @param {THREE.Scene}                                scene
   * @param {import('./Renderer.js').Renderer}           renderer
   * @param {import('../objects/ObjectManager.js').ObjectManager} objectManager
   * @param {import('../objects/MaterialManager.js').MaterialManager} materialManager
   */
  constructor(cameraManager, scene, renderer, objectManager, materialManager) {
    this.cam   = cameraManager;
    this.scene = scene;
    this.objs  = objectManager;
    this.mats  = materialManager;

    /** @type {Set<string>} — set of selected object ids */
    this.selected = new Set();

    this._transformMode = 'translate'; // 'translate'|'rotate'|'scale'

    this.raycaster = new THREE.Raycaster();
    this._pointer  = new THREE.Vector2();
    this._domElement = renderer.domElement;

    // Sub-selection states (editor mode)
    this._faceSelection = null;
    this._edgeSelection = null;
    this._vertexSelection = null;

    this._faceOutline = null;
    this._edgeOutline = null;
    this._vertexMarker = null;

    this._pickMode = 'object'; // 'object' | 'face' | 'edge' | 'vertex'
    this._subEditTool = 'move'; // 'move' | 'extrude'

    this._pointerDown = false;
    this._pointerMoved = false;
    this._pointerDownPos = { x: 0, y: 0 };
    this._boxSelectState = null;
    this._isBoxSelecting = false;
    this._dragState = null;
    this._dragPlane = new THREE.Plane();
    this._dragStartWorld = new THREE.Vector3();
    this._dragCurrentWorld = new THREE.Vector3();
    this._snapProvider = null;
    this._transformSnapState = null;

    // Pivot group used for multi-object transform
    this._pivotGroup = null;

    // TransformControls — attached to single or pivot mesh
    this.transformControls = new TransformControls(
      this.cam.activeCamera,
      renderer.domElement
    );
    this.transformControls.setMode(this._transformMode);
    this.transformControls.setSize(0.62);
    this.transformControls.name = '__transformControls';
    scene.add(this.transformControls);
    this._styleTransformGizmo();

    // Space (world vs local)
    this._space = 'world';
    this.transformControls.setSpace('world');

    // Ctrl+drag snapping: 0.25u translation, 15° rotation, 0.25 scale
    const _snapOn  = () => {
      this.transformControls.setTranslationSnap(0.25);
      this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
      this.transformControls.setScaleSnap(0.25);
    };
    const _snapOff = () => {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
      this.transformControls.setScaleSnap(null);
    };
    window.addEventListener('keydown', e => { if (e.key === 'Control') _snapOn(); });
    window.addEventListener('keyup',   e => { if (e.key === 'Control') _snapOff(); });

    // CRITICAL: disable OrbitControls while dragging gizmo
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.cam.controls.enabled = !e.value;
      if (e.value && this._transformMode === 'translate') {
        this._beginTransformSnap();
      }
      if (!e.value) {
        this._transformSnapState = null;
        this._snapProvider?.clearFeedback?.();
        const rec = this.getPrimary();
        if (rec?.id) {
          EventBus.emit('cad:operation:recorded', {
            id: `cadop_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            label: `${this._transformMode} ${rec.name}`,
            type: 'transform',
            objectId: rec.id,
            payload: {
              after: {
                position: rec.mesh.position.toArray(),
                rotation: [rec.mesh.rotation.x, rec.mesh.rotation.y, rec.mesh.rotation.z],
                scale: rec.mesh.scale.toArray(),
                visible: rec.mesh.visible,
              },
            },
            timestamp: Date.now(),
          });
        }
      }
    });

    // Emit state change when user drags a gizmo
    this.transformControls.addEventListener('objectChange', () => {
      EventBus.emit('state:changed', { type: 'transform' });
    });

    // Pointer listeners on the renderer canvas
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);

    this._domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    this._domElement.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointerup', this._onPointerUp);
    this._onContextMenu = this._handleContextMenu.bind(this);
    this._domElement.addEventListener('contextmenu', this._onContextMenu);

    this._selectionBoxEl = document.createElement('div');
    this._selectionBoxEl.className = 'selection-box';
    const wrapper = this._domElement.parentElement || document.body;
    wrapper.appendChild(this._selectionBoxEl);
  }

  setSnapProvider(provider) {
    this._snapProvider = provider || null;
  }

  /* ── Transform mode ───────────────────────────────────────── */

  /**
   * @param {'translate'|'rotate'|'scale'} mode
   */
  setMode(mode) {
    this._transformMode = mode;
    this.transformControls.setMode(mode);
    EventBus.emit('state:changed', { type: 'selection' });
  }

  get mode() { return this._transformMode; }

  setPickMode(mode) {
    const next = ['object', 'face', 'edge', 'vertex'].includes(mode) ? mode : 'object';
    this._pickMode = next;
    if (next === 'object') this.clearSubSelection();
    if (next === 'object') this._subEditTool = 'move';
    EventBus.emit('state:changed', { type: 'selection' });
    return this._pickMode;
  }

  get pickMode() { return this._pickMode; }

  activateSubEditTool(tool) {
    const next = ['move', 'extrude'].includes(tool) ? tool : 'move';
    this._subEditTool = next;
    if (next === 'extrude') this.setPickMode('face');
    EventBus.emit('state:changed', { type: 'selection' });
    return { pickMode: this._pickMode, tool: this._subEditTool };
  }

  get subEditTool() { return this._subEditTool; }

  /** Toggle between 'world' and 'local' transform space. Returns new space. */
  toggleSpace() {
    this._space = this._space === 'world' ? 'local' : 'world';
    this.transformControls.setSpace(this._space);
    return this._space;
  }

  get space() { return this._space; }

  /* ── Selection ────────────────────────────────────────────── */

  /**
   * Select objects by id.
   * @param {string[]} ids
   * @param {boolean} additive  — if true, adds to current selection (Shift)
   */
  selectByIds(ids, additive = false) {
    if (!additive) this._clearEmissive();

    if (!additive) this.selected.clear();

    ids.forEach(id => {
      const rec = this.objs.getById(id);
      if (!rec) return;
      this.selected.add(id);
      this.mats.setEmissive(rec.mesh, SELECT_COLOR);
    });

    this._attachGizmo();
    EventBus.emit('state:changed', { type: 'selection' });
    EventBus.emit('selection:changed', { ids: new Set(this.selected) });
  }

  /**
   * Select by display name.
   * @param {string} name  — 'all' selects everything
   * @param {boolean} additive
   */
  selectByName(name, additive = false) {
    if (name === 'all') {
      const ids = this.objs.list().map(r => r.id);
      this.selectByIds(ids, additive);
      return;
    }
    const rec = this.objs.getByName(name);
    if (!rec) return null;
    this.selectByIds([rec.id], additive);
    return rec;
  }

  /** Deselect all */
  deselectAll() {
    this._clearEmissive();
    this.selected.clear();
    this.clearSubSelection();
    this._detachGizmo();
    EventBus.emit('state:changed', { type: 'selection' });
    EventBus.emit('selection:changed', { ids: new Set() });
  }

  /**
   * Get the primary selected record (first in set).
   * @returns {import('../objects/ObjectManager.js').ObjectRecord|null}
   */
  getPrimary() {
    const id = [...this.selected][0];
    return id ? this.objs.getById(id) : null;
  }

  /** All selected records */
  getAll() {
    return [...this.selected].map(id => this.objs.getById(id)).filter(Boolean);
  }

  /**
   * Select a face on the object's primary editable mesh.
   * @param {string} objectToken id or name
   * @param {number} faceIndex triangle index
   */
  selectFaceByObjectToken(objectToken, faceIndex) {
    const rec = this.objs.getById(objectToken) || this.objs.getByName(objectToken);
    if (!rec) return { success: false, message: `Object not found: "${objectToken}"` };

    const mesh = this._findEditableMesh(rec.mesh);
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes?.position) {
      return { success: false, message: `Object "${rec.name}" has no editable mesh geometry.` };
    }

    const triCount = this._getTriangleCount(mesh.geometry);
    if (faceIndex < 0 || faceIndex >= triCount) {
      return { success: false, message: `Face index out of range: ${faceIndex} (0..${triCount - 1})` };
    }

    this.selectByIds([rec.id], false);
    this._setSubSelection({ objectId: rec.id, mesh, faceIndex }, null, null);
    this._updateSubSelectionVisuals();
    EventBus.emit('state:changed', { type: 'selection' });
    return { success: true, message: `Selected face ${faceIndex} on "${rec.name}"` };
  }

  selectEdgeByObjectToken(objectToken, edgeIndex) {
    const rec = this.objs.getById(objectToken) || this.objs.getByName(objectToken);
    if (!rec) return { success: false, message: `Object not found: "${objectToken}"` };

    const mesh = this._findEditableMesh(rec.mesh);
    if (!mesh || !mesh.geometry || !mesh.geometry.attributes?.position) {
      return { success: false, message: `Object "${rec.name}" has no editable mesh geometry.` };
    }

    const edges = this._buildEdges(mesh.geometry);
    if (edgeIndex < 0 || edgeIndex >= edges.length) {
      return { success: false, message: `Edge index out of range: ${edgeIndex} (0..${Math.max(0, edges.length - 1)})` };
    }

    this.selectByIds([rec.id], false);
    this._setSubSelection(null, { objectId: rec.id, mesh, edgeIndex, edges }, null);
    this._updateSubSelectionVisuals();
    EventBus.emit('state:changed', { type: 'selection' });
    return { success: true, message: `Selected edge ${edgeIndex} on "${rec.name}"` };
  }

  selectVertexByObjectToken(objectToken, vertexIndex) {
    const rec = this.objs.getById(objectToken) || this.objs.getByName(objectToken);
    if (!rec) return { success: false, message: `Object not found: "${objectToken}"` };

    const mesh = this._findEditableMesh(rec.mesh);
    const pos = mesh?.geometry?.attributes?.position;
    if (!mesh || !pos) {
      return { success: false, message: `Object "${rec.name}" has no editable mesh geometry.` };
    }

    if (vertexIndex < 0 || vertexIndex >= pos.count) {
      return { success: false, message: `Vertex index out of range: ${vertexIndex} (0..${pos.count - 1})` };
    }

    this.selectByIds([rec.id], false);
    this._setSubSelection(null, null, { objectId: rec.id, mesh, vertexIndex });
    this._updateSubSelectionVisuals();
    EventBus.emit('state:changed', { type: 'selection' });
    return { success: true, message: `Selected vertex ${vertexIndex} on "${rec.name}"` };
  }

  clearSubSelection() {
    this._faceSelection = null;
    this._edgeSelection = null;
    this._vertexSelection = null;

    if (this._faceOutline) {
      this._faceOutline.removeFromParent();
      this._faceOutline.geometry.dispose();
      this._faceOutline.material.dispose();
      this._faceOutline = null;
    }
    if (this._edgeOutline) {
      this._edgeOutline.removeFromParent();
      this._edgeOutline.geometry.dispose();
      this._edgeOutline.material.dispose();
      this._edgeOutline = null;
    }
    if (this._vertexMarker) {
      this._vertexMarker.removeFromParent();
      this._vertexMarker.geometry.dispose();
      this._vertexMarker.material.dispose();
      this._vertexMarker = null;
    }
  }

  getFaceSelection() {
    return this._faceSelection;
  }

  /**
   * Extrude current selected face by offsetting coplanar vertices.
   * Note: this is a lightweight geometric operation for browser editing.
   */
  extrudeSelectedFace(distance) {
    if (!this._faceSelection) {
      return { success: false, message: 'No face selected. Use: select face <id> <faceIndex>' };
    }

    const { mesh, faceIndex } = this._faceSelection;
    const geo = mesh.geometry;
    if (!geo?.attributes?.position) {
      return { success: false, message: 'Selected face has no editable geometry.' };
    }

    const amount = parseFloat(distance);
    if (!Number.isFinite(amount) || Math.abs(amount) < 1e-6) {
      return { success: false, message: 'Usage: extrude selection <distance>' };
    }

    const pos = geo.attributes.position;
    const triangle = this._getFaceTriangle(geo, faceIndex);
    if (!triangle) return { success: false, message: 'Invalid face selection.' };

    const [ia, ib, ic] = triangle;
    const a = new THREE.Vector3().fromBufferAttribute(pos, ia);
    const b = new THREE.Vector3().fromBufferAttribute(pos, ib);
    const c = new THREE.Vector3().fromBufferAttribute(pos, ic);

    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const planeD = normal.dot(a);

    const selectedCoords = [];
    const movable = new Set();
    const triCount = this._getTriangleCount(geo);

    for (let f = 0; f < triCount; f++) {
      const tri = this._getFaceTriangle(geo, f);
      if (!tri) continue;
      const v0 = new THREE.Vector3().fromBufferAttribute(pos, tri[0]);
      const v1 = new THREE.Vector3().fromBufferAttribute(pos, tri[1]);
      const v2 = new THREE.Vector3().fromBufferAttribute(pos, tri[2]);

      const n = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v2, v0)).normalize();
      const d = n.dot(v0);

      const aligned = Math.abs(n.dot(normal)) > 0.999;
      const coplanar = Math.abs(d - planeD) < 1e-5;
      if (!aligned || !coplanar) continue;

      tri.forEach(idx => movable.add(idx));
    }

    movable.forEach(idx => {
      selectedCoords.push(new THREE.Vector3().fromBufferAttribute(pos, idx));
    });

    // Also move duplicated seam vertices with identical coordinates.
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const sameAsSelected = selectedCoords.some(s => s.distanceToSquared(v) < 1e-10);
      if (sameAsSelected) movable.add(i);
    }

    movable.forEach(idx => {
      const v = new THREE.Vector3().fromBufferAttribute(pos, idx).addScaledVector(normal, amount);
      pos.setXYZ(idx, v.x, v.y, v.z);
    });

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    this._updateSubSelectionVisuals();
    EventBus.emit('state:changed', { type: 'geometry' });
    return {
      success: true,
      message: `Extruded face ${faceIndex} by ${amount.toFixed(3)}`,
      data: {
        distance: amount,
        normal: [normal.x, normal.y, normal.z],
        vertexIndices: [...movable],
      },
    };
  }

  /* ── Gizmo attachment ─────────────────────────────────────── */

  _attachGizmo() {
    this._detachGizmo();

    const recs = this.getAll();
    if (recs.length === 0) return;

    if (recs.length === 1) {
      this.transformControls.attach(recs[0].mesh);
    } else {
      // Multi-select: create a pivot group at centroid
      const centroid = new THREE.Vector3();
      recs.forEach(r => centroid.add(r.mesh.position));
      centroid.divideScalar(recs.length);

      this._pivotGroup = new THREE.Group();
      this._pivotGroup.name = '__pivot';
      this._pivotGroup.position.copy(centroid);
      this.scene.add(this._pivotGroup);

      // Re-parent using attach() to preserve world transforms
      recs.forEach(r => this._pivotGroup.attach(r.mesh));

      this.transformControls.attach(this._pivotGroup);
    }
  }

  _detachGizmo() {
    this.transformControls.detach();

    if (this._pivotGroup) {
      // Return meshes to scene root, preserving world transform
      [...this._pivotGroup.children].forEach(child => {
        this.scene.attach(child);
      });
      this.scene.remove(this._pivotGroup);
      this._pivotGroup = null;
    }
  }

  _clearEmissive() {
    this.selected.forEach(id => {
      const rec = this.objs.getById(id);
      if (rec) this.mats.setEmissive(rec.mesh, null);
    });
  }

  /* ── Click / Raycasting ───────────────────────────────────── */

  _handleClick(event) {
    // Don't select if the TransformControls gizmo is being interacted with
    if (this.transformControls.dragging) return;

    const rect = this._domElement.getBoundingClientRect();

    this._pointer.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this._pointer, this.cam.activeCamera);

    const meshes = this.objs.getMeshes();
    const hits   = this.raycaster.intersectObjects(meshes, false);

    if (hits.length === 0) {
      // Click on empty space — deselect
      if (!event.shiftKey) this.deselectAll();
      return;
    }

    const hitMesh = hits[0].object;
    const id = this._getEditorIdFromObject(hitMesh);
    if (!id) return;

    if (this._pickMode !== 'object') {
      const res = this._selectSubElementFromHit(hits[0], id);
      if (res) {
        EventBus.emit('state:changed', { type: 'selection' });
        return;
      }
    }

    this.clearSubSelection();

    if (event.shiftKey) {
      // Shift-click: toggle in selection
      if (this.selected.has(id)) {
        this.mats.setEmissive(hitMesh, null);
        this.selected.delete(id);
        this._attachGizmo();
        EventBus.emit('state:changed', { type: 'selection' });
        EventBus.emit('selection:changed', { ids: new Set(this.selected) });
      } else {
        this.selectByIds([id], true);
      }
    } else {
      this.selectByIds([id], false);
    }
  }

  _startSelectionBox(event) {
    const rect = this._domElement.getBoundingClientRect();
    this._isBoxSelecting = true;
    this._boxSelectState = {
      startX: event.clientX,
      startY: event.clientY,
      currX: event.clientX,
      currY: event.clientY,
      viewportRect: rect,
    };

    this._selectionBoxEl.style.display = 'block';
    this._selectionBoxEl.classList.remove('select-touch');
    this.cam.controls.enabled = false;
    this._updateSelectionBox(event);
  }

  _updateSelectionBox(event) {
    if (!this._isBoxSelecting || !this._boxSelectState) return;
    const s = this._boxSelectState;
    s.currX = event.clientX;
    s.currY = event.clientY;

    const left = Math.min(s.startX, s.currX) - s.viewportRect.left;
    const top = Math.min(s.startY, s.currY) - s.viewportRect.top;
    const width = Math.abs(s.currX - s.startX);
    const height = Math.abs(s.currY - s.startY);

    this._selectionBoxEl.style.left = `${left}px`;
    this._selectionBoxEl.style.top = `${top}px`;
    this._selectionBoxEl.style.width = `${width}px`;
    this._selectionBoxEl.style.height = `${height}px`;

    // Bottom->Top drag => touch mode (crossing)
    if (s.currY < s.startY) this._selectionBoxEl.classList.add('select-touch');
    else this._selectionBoxEl.classList.remove('select-touch');
  }

  _finishSelectionBox() {
    if (!this._isBoxSelecting || !this._boxSelectState) return false;

    const s = this._boxSelectState;
    const width = Math.abs(s.currX - s.startX);
    const height = Math.abs(s.currY - s.startY);

    this._selectionBoxEl.style.display = 'none';
    this._selectionBoxEl.classList.remove('select-touch');
    this.cam.controls.enabled = true;

    this._isBoxSelecting = false;
    this._boxSelectState = null;

    // Treat tiny drag as normal click fallback
    if (width < 6 || height < 6) return false;

    const dragRect = {
      left: Math.min(s.startX, s.currX),
      right: Math.max(s.startX, s.currX),
      top: Math.min(s.startY, s.currY),
      bottom: Math.max(s.startY, s.currY),
    };

    const touchMode = s.currY < s.startY; // bottom->top
    const ids = this._collectObjectsInSelectionBox(dragRect, touchMode, s.viewportRect);
    this.selectByIds(ids, true);
    return true;
  }

  _collectObjectsInSelectionBox(screenRect, touchMode, viewportRect) {
    const ids = [];
    const records = this.objs.list();

    for (const rec of records) {
      const bounds = this._projectObjectScreenBounds(rec.mesh, viewportRect);
      if (!bounds) continue;

      const match = touchMode
        ? this._rectsIntersect(screenRect, bounds)
        : this._rectContains(screenRect, bounds);

      if (match) ids.push(rec.id);
    }
    return ids;
  }

  _projectObjectScreenBounds(object, viewportRect) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return null;

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    corners.forEach((v) => {
      v.project(this.cam.activeCamera);
      const sx = viewportRect.left + ((v.x + 1) * 0.5) * viewportRect.width;
      const sy = viewportRect.top + ((-v.y + 1) * 0.5) * viewportRect.height;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx);
      maxY = Math.max(maxY, sy);
    });

    return { left: minX, right: maxX, top: minY, bottom: maxY };
  }

  _rectsIntersect(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  _rectContains(outer, inner) {
    return inner.left >= outer.left
      && inner.right <= outer.right
      && inner.top >= outer.top
      && inner.bottom <= outer.bottom;
  }

  _handlePointerDown(event) {
    if (event.button !== 0) return;
    this._pointerDown = true;
    this._pointerMoved = false;
    this._pointerDownPos.x = event.clientX;
    this._pointerDownPos.y = event.clientY;

    if (event.shiftKey && this._pickMode === 'object' && !this.transformControls.dragging) {
      this._startSelectionBox(event);
      return;
    }

    if (this._pickMode === 'object') return;
    if (this.transformControls.dragging) return;
    const hit = this._raycastFromEvent(event);
    if (!hit) return;

    const hitId = this._getEditorIdFromObject(hit.object);
    if (!hitId) return;

    if (!this._hasActiveSubSelection() || !this._isHitCurrentSubSelection(hit)) {
      this._selectSubElementFromHit(hit, hitId);
    }

    if (!this._hasActiveSubSelection() || !this._isHitCurrentSubSelection(hit)) return;

    this._startSubDrag(event);
  }

  _handlePointerMove(event) {
    if (!this._pointerDown && !this._dragState && !this.transformControls.dragging) return;

    const dx = event.clientX - this._pointerDownPos.x;
    const dy = event.clientY - this._pointerDownPos.y;
    if (Math.hypot(dx, dy) > 3) this._pointerMoved = true;

    if (this.transformControls.dragging && this._transformMode === 'translate') {
      this._applyTransformSnapFromEvent(event);
    }

    if (this._isBoxSelecting) {
      this._updateSelectionBox(event);
      return;
    }

    if (!this._dragState) return;
    this._applyDragToGeometry(event);
  }

  _handlePointerUp(event) {
    if (!this._pointerDown && !this._dragState) return;

    if (this._isBoxSelecting) {
      const hasSelectionBox = this._finishSelectionBox();
      if (!hasSelectionBox && event.target === this._domElement && !this._pointerMoved) {
        this._handleClick(event);
      }
      this._pointerDown = false;
      this._pointerMoved = false;
      return;
    }

    if (this._dragState) {
      this._endSubDrag();
    } else if (event.target === this._domElement && !this._pointerMoved) {
      this._handleClick(event);
    }

    this._pointerDown = false;
    this._pointerMoved = false;
  }

  /** Update TransformControls camera reference (needed when switching views) */
  updateCamera() {
    this.transformControls.camera = this.cam.activeCamera;
  }

  _findEditableMesh(root) {
    if (root?.isMesh && root.geometry?.attributes?.position) return root;
    let found = null;
    root?.traverse(child => {
      if (!found && child.isMesh && child.geometry?.attributes?.position) found = child;
    });
    return found;
  }

  _rayFromEvent(event) {
    const rect = this._domElement.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._pointer, this.cam.activeCamera);
    return this.raycaster.ray;
  }

  _raycastFromEvent(event) {
    this._rayFromEvent(event);
    const meshes = this.objs.getMeshes();
    const hits = this.raycaster.intersectObjects(meshes, false);
    return hits[0] || null;
  }

  _getEditorIdFromObject(object) {
    let curr = object;
    while (curr) {
      if (curr.userData?.editorId) return curr.userData.editorId;
      curr = curr.parent;
    }
    return null;
  }

  _selectSubElementFromHit(hit, objectId) {
    const mesh = hit.object;
    const geo = mesh?.geometry;
    const pos = geo?.attributes?.position;
    if (!mesh?.isMesh || !pos) return false;
    if (!Number.isInteger(hit.faceIndex)) return false;

    this.selectByIds([objectId], false);

    if (this._pickMode === 'face') {
      this._setSubSelection({ objectId, mesh, faceIndex: hit.faceIndex }, null, null);
      this._updateSubSelectionVisuals();
      return true;
    }

    const tri = this._getFaceTriangle(geo, hit.faceIndex);
    if (!tri) return false;
    const localPoint = mesh.worldToLocal(hit.point.clone());

    if (this._pickMode === 'vertex') {
      let bestIndex = tri[0];
      let bestDist = Infinity;
      tri.forEach((idx) => {
        const v = new THREE.Vector3().fromBufferAttribute(pos, idx);
        const d = v.distanceToSquared(localPoint);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = idx;
        }
      });
      this._setSubSelection(null, null, { objectId, mesh, vertexIndex: bestIndex });
      this._updateSubSelectionVisuals();
      return true;
    }

    if (this._pickMode === 'edge') {
      const pairs = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];

      let bestPair = pairs[0];
      let bestDist = Infinity;
      pairs.forEach(([aIdx, bIdx]) => {
        const a = new THREE.Vector3().fromBufferAttribute(pos, aIdx);
        const b = new THREE.Vector3().fromBufferAttribute(pos, bIdx);
        const cp = new THREE.Vector3();
        new THREE.Line3(a, b).closestPointToPoint(localPoint, true, cp);
        const d = cp.distanceToSquared(localPoint);
        if (d < bestDist) {
          bestDist = d;
          bestPair = [aIdx, bIdx];
        }
      });

      const edges = this._buildEdges(geo);
      const targetMin = Math.min(bestPair[0], bestPair[1]);
      const targetMax = Math.max(bestPair[0], bestPair[1]);
      const edgeIndex = edges.findIndex(([a, b]) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return min === targetMin && max === targetMax;
      });

      if (edgeIndex < 0) return false;
      this._setSubSelection(null, { objectId, mesh, edgeIndex, edges }, null);
      this._updateSubSelectionVisuals();
      return true;
    }

    return false;
  }

  _hasActiveSubSelection() {
    return Boolean(this._faceSelection || this._edgeSelection || this._vertexSelection);
  }

  _isHitCurrentSubSelection(hit) {
    if (!hit?.object) return false;
    const mesh = this._faceSelection?.mesh || this._edgeSelection?.mesh || this._vertexSelection?.mesh;
    if (!mesh) return false;
    return hit.object === mesh;
  }

  _startSubDrag(event) {
    const active = this._faceSelection || this._edgeSelection || this._vertexSelection;
    if (!active?.mesh?.geometry?.attributes?.position) return;

    const indices = this._collectSubSelectionVertexIndices(active.mesh.geometry);
    if (!indices.length) return;

    const ray = this._rayFromEvent(event);
    const centroidLocal = new THREE.Vector3();
    const pos = active.mesh.geometry.attributes.position;
    indices.forEach((idx) => centroidLocal.add(new THREE.Vector3().fromBufferAttribute(pos, idx)));
    centroidLocal.divideScalar(indices.length);
    const centroidWorld = active.mesh.localToWorld(centroidLocal.clone());

    const camNormal = new THREE.Vector3();
    this.cam.activeCamera.getWorldDirection(camNormal);
    this._dragPlane.setFromNormalAndCoplanarPoint(camNormal.normalize(), centroidWorld);
    if (!ray.intersectPlane(this._dragPlane, this._dragStartWorld)) return;

    let dragMode = 'move';
    let faceNormalWorld = null;
    if (this._subEditTool === 'extrude' && this._faceSelection) {
      faceNormalWorld = this._computeFaceNormalWorld(this._faceSelection.mesh, this._faceSelection.faceIndex);
      if (faceNormalWorld) dragMode = 'extrude';
    }

    const startPositions = indices.map((index) => ({
      index,
      value: new THREE.Vector3().fromBufferAttribute(pos, index),
    }));

    this._dragState = {
      mesh: active.mesh,
      startPositions,
      mode: dragMode,
      faceNormalWorld,
      startMouseY: event.clientY,
    };

    this.cam.controls.enabled = false;
  }

  _endSubDrag() {
    if (!this._dragState) return;
    this.cam.controls.enabled = true;
    this._dragState = null;
    EventBus.emit('state:changed', { type: 'geometry' });
  }

  _applyDragToGeometry(event) {
    if (!this._dragState) return;
    const geometry = this._dragState.mesh.geometry;
    const pos = geometry?.attributes?.position;
    if (!pos) return;

    if (this._dragState.mode === 'extrude' && this._dragState.faceNormalWorld) {
      let amount = (this._dragState.startMouseY - event.clientY) * 0.006;

      const ray = this._rayFromEvent(event);
      if (ray.intersectPlane(this._dragPlane, this._dragCurrentWorld) && this._snapProvider?.getSnap) {
        const snapped = this._snapProvider.getSnap(this._dragCurrentWorld.clone(), {
          camera: this.cam.activeCamera,
          ray,
          sceneObjects: this.objs.list(),
          activeSnapSettings: this._snapProvider.getSettings?.(),
        });
        if (snapped?.position) {
          const deltaWorld = new THREE.Vector3().subVectors(snapped.position, this._dragStartWorld);
          amount = deltaWorld.dot(this._dragState.faceNormalWorld);
        }
      }

      const localNormal = this._dragState.faceNormalWorld.clone().transformDirection(this._dragState.mesh.matrixWorld.clone().invert()).normalize();
      this._dragState.startPositions.forEach(({ index, value }) => {
        const moved = value.clone().addScaledVector(localNormal, amount);
        pos.setXYZ(index, moved.x, moved.y, moved.z);
      });
    } else {
      const ray = this._rayFromEvent(event);
      if (!ray.intersectPlane(this._dragPlane, this._dragCurrentWorld)) return;

      const targetWorld = this._dragCurrentWorld.clone();
      if (this._snapProvider?.getSnap) {
        const snap = this._snapProvider.getSnap(targetWorld, {
          camera: this.cam.activeCamera,
          ray,
          sceneObjects: this.objs.list(),
          activeSnapSettings: this._snapProvider.getSettings?.(),
        });
        if (snap?.position) targetWorld.copy(snap.position);
      }

      const deltaWorld = new THREE.Vector3().subVectors(targetWorld, this._dragStartWorld);
      const originLocal = this._dragState.mesh.worldToLocal(this._dragStartWorld.clone());
      const targetLocal = this._dragState.mesh.worldToLocal(this._dragStartWorld.clone().add(deltaWorld));
      const deltaLocal = targetLocal.sub(originLocal);

      this._dragState.startPositions.forEach(({ index, value }) => {
        pos.setXYZ(index, value.x + deltaLocal.x, value.y + deltaLocal.y, value.z + deltaLocal.z);
      });
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this._updateSubSelectionVisuals();
    EventBus.emit('state:changed', { type: 'geometry' });
  }

  _beginTransformSnap() {
    const object = this.transformControls.object;
    if (!object) return;

    const camNormal = new THREE.Vector3();
    this.cam.activeCamera.getWorldDirection(camNormal);

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camNormal.normalize(),
      object.position.clone()
    );

    this._transformSnapState = {
      plane,
      offset: new THREE.Vector3(),
      initialized: false,
    };
  }

  _applyTransformSnapFromEvent(event) {
    if (!this._snapProvider?.getSnap || !this._transformSnapState) return;
    const object = this.transformControls.object;
    if (!object) return;

    const ray = this._rayFromEvent(event);
    const hit = new THREE.Vector3();
    if (!ray.intersectPlane(this._transformSnapState.plane, hit)) return;

    if (!this._transformSnapState.initialized) {
      this._transformSnapState.offset.copy(object.position).sub(hit);
      this._transformSnapState.initialized = true;
    }

    const rawTarget = hit.add(this._transformSnapState.offset);
    const snap = this._snapProvider.getSnap(rawTarget, {
      camera: this.cam.activeCamera,
      ray,
      sceneObjects: this.objs.list(),
      activeSnapSettings: this._snapProvider.getSettings?.(),
    });
    if (!snap?.position) return;

    // Respect active gizmo axis/plane: never overwrite unconstrained axes.
    const constrained = this._constrainPositionToTransformAxis(
      object.position,
      snap.position,
      this.transformControls.axis
    );
    object.position.copy(constrained);
    EventBus.emit('state:changed', { type: 'transform' });
  }

  _constrainPositionToTransformAxis(current, target, axis) {
    if (!axis || axis === 'XYZ') return target.clone();

    const next = current.clone();

    // Single-axis handles
    if (axis.includes('X')) next.x = target.x;
    if (axis.includes('Y')) next.y = target.y;
    if (axis.includes('Z')) next.z = target.z;

    return next;
  }

  _computeFaceNormalWorld(mesh, faceIndex) {
    const geo = mesh?.geometry;
    const pos = geo?.attributes?.position;
    const tri = geo ? this._getFaceTriangle(geo, faceIndex) : null;
    if (!pos || !tri) return null;

    const a = new THREE.Vector3().fromBufferAttribute(pos, tri[0]);
    const b = new THREE.Vector3().fromBufferAttribute(pos, tri[1]);
    const c = new THREE.Vector3().fromBufferAttribute(pos, tri[2]);
    const normalLocal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    return normalLocal.transformDirection(mesh.matrixWorld).normalize();
  }

  _styleTransformGizmo() {
    this.transformControls.traverse((child) => {
      if (!child.material) return;
      if (child.name?.toLowerCase().includes('picker')) return;

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        if (!mat || typeof mat !== 'object') return;
        mat.transparent = true;
        if (typeof mat.opacity === 'number') mat.opacity = Math.min(mat.opacity, 0.62);
      });
    });
  }

  _collectSubSelectionVertexIndices(geo) {
    if (this._vertexSelection) {
      const idx = this._vertexSelection.vertexIndex;
      return this._withCoincidentVertices(geo, [idx]);
    }
    if (this._edgeSelection) {
      const edge = this._edgeSelection.edges?.[this._edgeSelection.edgeIndex];
      if (!edge) return [];
      return this._withCoincidentVertices(geo, edge);
    }
    if (this._faceSelection) {
      const tri = this._getFaceTriangle(geo, this._faceSelection.faceIndex);
      if (!tri) return [];
      return this._withCoincidentVertices(geo, tri);
    }
    return [];
  }

  _withCoincidentVertices(geo, seedIndices) {
    const pos = geo.attributes?.position;
    if (!pos) return [];

    const all = new Set(seedIndices);
    const seeds = seedIndices.map((idx) => new THREE.Vector3().fromBufferAttribute(pos, idx));

    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const coincident = seeds.some((s) => s.distanceToSquared(v) < 1e-10);
      if (coincident) all.add(i);
    }

    return [...all];
  }

  _getTriangleCount(geo) {
    if (geo.index) return Math.floor(geo.index.count / 3);
    const pos = geo.attributes?.position;
    return pos ? Math.floor(pos.count / 3) : 0;
  }

  _getFaceTriangle(geo, faceIndex) {
    if (faceIndex < 0) return null;
    if (geo.index) {
      const arr = geo.index.array;
      const base = faceIndex * 3;
      if (base + 2 >= arr.length) return null;
      return [arr[base], arr[base + 1], arr[base + 2]];
    }
    const pos = geo.attributes?.position;
    if (!pos) return null;
    const base = faceIndex * 3;
    if (base + 2 >= pos.count) return null;
    return [base, base + 1, base + 2];
  }

  _buildEdges(geo) {
    const edges = [];
    const set = new Set();
    const triCount = this._getTriangleCount(geo);

    for (let f = 0; f < triCount; f++) {
      const tri = this._getFaceTriangle(geo, f);
      if (!tri) continue;
      const pairs = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];

      pairs.forEach(([a, b]) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const key = `${min}:${max}`;
        if (set.has(key)) return;
        set.add(key);
        edges.push([min, max]);
      });
    }

    return edges;
  }

  _setSubSelection(face, edge, vertex) {
    this._faceSelection = face;
    this._edgeSelection = edge;
    this._vertexSelection = vertex;
    if (!face && this._faceOutline) {
      this._faceOutline.removeFromParent();
      this._faceOutline.geometry.dispose();
      this._faceOutline.material.dispose();
      this._faceOutline = null;
    }
    if (!edge && this._edgeOutline) {
      this._edgeOutline.removeFromParent();
      this._edgeOutline.geometry.dispose();
      this._edgeOutline.material.dispose();
      this._edgeOutline = null;
    }
    if (!vertex && this._vertexMarker) {
      this._vertexMarker.removeFromParent();
      this._vertexMarker.geometry.dispose();
      this._vertexMarker.material.dispose();
      this._vertexMarker = null;
    }
  }

  _updateSubSelectionVisuals() {
    if (this._faceSelection) this._updateFaceOutline();
    if (this._edgeSelection) this._updateEdgeOutline();
    if (this._vertexSelection) this._updateVertexMarker();
  }

  _updateFaceOutline() {
    if (!this._faceSelection) return;
    const { mesh, faceIndex } = this._faceSelection;
    const geo = mesh.geometry;
    const pos = geo?.attributes?.position;
    if (!pos) return;

    const tri = this._getFaceTriangle(geo, faceIndex);
    if (!tri) return;

    const p0 = new THREE.Vector3().fromBufferAttribute(pos, tri[0]);
    const p1 = new THREE.Vector3().fromBufferAttribute(pos, tri[1]);
    const p2 = new THREE.Vector3().fromBufferAttribute(pos, tri[2]);

    const outlineGeo = new THREE.BufferGeometry().setFromPoints([p0, p1, p2, p0]);
    if (!this._faceOutline) {
      const mat = new THREE.LineBasicMaterial({ color: 0x4fd4ff, depthTest: false, transparent: true, opacity: 0.95 });
      this._faceOutline = new THREE.Line(outlineGeo, mat);
      this._faceOutline.renderOrder = 999;
      mesh.add(this._faceOutline);
    } else {
      this._faceOutline.geometry.dispose();
      this._faceOutline.geometry = outlineGeo;
      if (this._faceOutline.parent !== mesh) {
        this._faceOutline.removeFromParent();
        mesh.add(this._faceOutline);
      }
    }
  }

  _updateEdgeOutline() {
    if (!this._edgeSelection) return;
    const { mesh, edgeIndex, edges } = this._edgeSelection;
    const geo = mesh.geometry;
    const pos = geo?.attributes?.position;
    if (!pos || !edges || !edges[edgeIndex]) return;

    const [aIdx, bIdx] = edges[edgeIndex];
    const a = new THREE.Vector3().fromBufferAttribute(pos, aIdx);
    const b = new THREE.Vector3().fromBufferAttribute(pos, bIdx);

    const edgeGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
    if (!this._edgeOutline) {
      const mat = new THREE.LineBasicMaterial({ color: 0xffcf4d, depthTest: false, transparent: true, opacity: 0.95 });
      this._edgeOutline = new THREE.Line(edgeGeo, mat);
      this._edgeOutline.renderOrder = 999;
      mesh.add(this._edgeOutline);
    } else {
      this._edgeOutline.geometry.dispose();
      this._edgeOutline.geometry = edgeGeo;
      if (this._edgeOutline.parent !== mesh) {
        this._edgeOutline.removeFromParent();
        mesh.add(this._edgeOutline);
      }
    }
  }

  _updateVertexMarker() {
    if (!this._vertexSelection) return;
    const { mesh, vertexIndex } = this._vertexSelection;
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;

    const p = new THREE.Vector3().fromBufferAttribute(pos, vertexIndex);
    if (!this._vertexMarker) {
      const geo = new THREE.SphereGeometry(0.04, 12, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0x7dff8d, depthTest: false });
      this._vertexMarker = new THREE.Mesh(geo, mat);
      this._vertexMarker.renderOrder = 999;
      mesh.add(this._vertexMarker);
    } else if (this._vertexMarker.parent !== mesh) {
      this._vertexMarker.removeFromParent();
      mesh.add(this._vertexMarker);
    }

    this._vertexMarker.position.copy(p);
  }

  dispose() {
    this.clearSubSelection();
    this._detachGizmo();
    this._domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    this._domElement.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.scene.remove(this.transformControls);
    this.transformControls.dispose();
    this._domElement.removeEventListener('contextmenu', this._onContextMenu);
    this._selectionBoxEl?.remove();
  }

  _handleContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    const rect = this._domElement.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this._pointer, this.cam.activeCamera);
    const hits = this.raycaster.intersectObjects(this.objs.getMeshes(), false);
    if (hits.length === 0) return;

    const id = this._getEditorIdFromObject(hits[0].object);
    if (!id) return;

    if (!this.selected.has(id)) {
      this.selectByIds([id], false);
    }

    const record = this.objs.getById(id);
    if (!record) return;

    EventBus.emit('contextmenu:show', {
      record,
      x: event.clientX,
      y: event.clientY,
    });
  }

  /** Update TransformControls camera reference (needed when switching views) */
  updateCamera() {
    this.transformControls.camera = this.cam.activeCamera;
  }
}
