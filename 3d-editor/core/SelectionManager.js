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

    // Sub-selection states (editor mode)
    this._faceSelection = null;
    this._edgeSelection = null;
    this._vertexSelection = null;

    this._faceOutline = null;
    this._edgeOutline = null;
    this._vertexMarker = null;

    // Pivot group used for multi-object transform
    this._pivotGroup = null;

    // TransformControls — attached to single or pivot mesh
    this.transformControls = new TransformControls(
      this.cam.activeCamera,
      renderer.domElement
    );
    this.transformControls.setMode(this._transformMode);
    this.transformControls.setSize(0.8);
    this.transformControls.name = '__transformControls';
    scene.add(this.transformControls);

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
    });

    // Emit state change when user drags a gizmo
    this.transformControls.addEventListener('objectChange', () => {
      EventBus.emit('state:changed', { type: 'transform' });
    });

    // Click listener on the renderer canvas
    this._onClick = this._handleClick.bind(this);
    renderer.domElement.addEventListener('click', this._onClick);
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
    return { success: true, message: `Extruded face ${faceIndex} by ${amount.toFixed(3)}` };
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

    const canvas = event.target;
    const rect   = canvas.getBoundingClientRect();

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
    const id = hitMesh.userData.editorId;
    if (!id) return;

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
    this.scene.remove(this.transformControls);
    this.transformControls.dispose();
  }
}
