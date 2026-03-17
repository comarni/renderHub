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

  dispose() {
    this._detachGizmo();
    this.scene.remove(this.transformControls);
    this.transformControls.dispose();
  }
}
