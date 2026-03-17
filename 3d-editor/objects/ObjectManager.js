/* ═══════════════════════════════════════════════════════════════
   ObjectManager — Create, delete, duplicate, list scene objects
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';

/** Internal prefix for editor system objects (not user-created) */
const SYSTEM_PREFIX = '__';

export class ObjectManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./MaterialManager.js').MaterialManager} materialManager
   */
  constructor(scene, materialManager) {
    this.scene = scene;
    this.mat   = materialManager;

    /** @type {Map<string, ObjectRecord>} */
    this.objects = new Map();

    // Counters for auto-naming
    this._counter = { box: 0, sphere: 0, cylinder: 0, plane: 0 };
  }

  /* ── Geometry factories ───────────────────────────────────── */

  _createGeometry(type) {
    switch (type) {
      case 'box':      return new THREE.BoxGeometry(1, 1, 1);
      case 'sphere':   return new THREE.SphereGeometry(0.5, 32, 32);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      case 'plane':    return new THREE.PlaneGeometry(2, 2);
      default:         throw new Error(`Unknown primitive type: "${type}"`);
    }
  }

  _generateName(type) {
    this._counter[type] = (this._counter[type] || 0) + 1;
    const labels = {
      box: 'Cube', sphere: 'Sphere', cylinder: 'Cylinder', plane: 'Plane',
      dog: 'Dog', cat: 'Cat', car: 'Car', house: 'House',
      tree: 'Tree', chair: 'Chair', table: 'Table', robot: 'Robot', human: 'Human',
    };
    const n = this._counter[type];
    const label = labels[type] || (type.charAt(0).toUpperCase() + type.slice(1));
    return `${label}.${String(n).padStart(3, '0')}`;
  }

  /**
   * Register a pre-built THREE.Group (from ProceduralGenerator) as an editor object.
   * @param {THREE.Group}  group
   * @param {string}       displayName
   * @param {string}       type
   * @returns {ObjectRecord}
   */
  addGroup(group, displayName, type) {
    const id = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    group.name                = displayName;
    group.userData.editorId   = id;
    group.userData.editorName = displayName;
    group.userData.editorType = type;
    group.userData.isGroup    = true;

    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.userData.editorId   = id;
        child.userData.editorName = displayName;
        child.userData.editorType = type;
      }
    });

    const record = { id, name: displayName, type, mesh: group, material: null };
    this.objects.set(id, record);
    this.scene.add(group);

    EventBus.emit('state:changed', { type: 'scene' });
    return record;
  }

  /* ── Public API ───────────────────────────────────────────── */

  /**
   * Add a new primitive to the scene.
   * @param {'box'|'sphere'|'cylinder'|'plane'} type
   * @param {string|null} name  — optional display name
   * @returns {ObjectRecord}
   */
  add(type, name = null) {
    const geo  = this._createGeometry(type);
    const mat  = this.mat.createMaterial(0x909090, 'plastic');
    const mesh = new THREE.Mesh(geo, mat);

    mesh.castShadow    = true;
    mesh.receiveShadow = true;

    // Place above the grid floor
    if (type !== 'plane') {
      mesh.position.y = 0.5;
    } else {
      // Floor plane: lay flat
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.001;
    }

    const id          = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const displayName = name || this._generateName(type);

    mesh.name            = displayName;
    mesh.userData.editorId   = id;
    mesh.userData.editorName = displayName;
    mesh.userData.editorType = type;

    const record = { id, name: displayName, type, mesh, material: mat };

    this.objects.set(id, record);
    this.scene.add(mesh);

    EventBus.emit('state:changed', { type: 'scene' });
    return record;
  }

  /**
   * Duplicate an existing object.
   * @param {string} id
   * @returns {ObjectRecord}
   */
  duplicate(id) {
    const src = this.objects.get(id);
    if (!src) throw new Error(`Object not found: ${id}`);

    const mesh = this._cloneObject3D(src.mesh);

    // Copy transform, offset slightly so duplicate is visible
    mesh.position.copy(src.mesh.position).add(new THREE.Vector3(0.3, 0, 0.3));
    mesh.rotation.copy(src.mesh.rotation);
    mesh.scale.copy(src.mesh.scale);

    const newId   = `obj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newName = src.name + '.copy';

    mesh.name                = newName;
    mesh.userData.editorId   = newId;
    mesh.userData.editorName = newName;
    mesh.userData.editorType = src.type;
    mesh.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.editorId = newId;
        child.userData.editorName = newName;
        child.userData.editorType = src.type;
      }
    });

    const record = { id: newId, name: newName, type: src.type, mesh, material: mesh.material || null };

    this.objects.set(newId, record);
    this.scene.add(mesh);

    EventBus.emit('state:changed', { type: 'scene' });
    return record;
  }

  /**
   * Remove an object from the scene and registry.
   * @param {string} id
   */
  delete(id) {
    const record = this.objects.get(id);
    if (!record) return;
    this.scene.remove(record.mesh);
    this._disposeObject3D(record.mesh);
    this.objects.delete(id);
    EventBus.emit('state:changed', { type: 'scene' });
  }

  /**
   * Rename an object.
   * @param {string} id
   * @param {string} newName
   */
  rename(id, newName) {
    const record = this.objects.get(id);
    if (!record) return;
    record.name              = newName;
    record.mesh.name         = newName;
    record.mesh.userData.editorName = newName;
    EventBus.emit('state:changed', { type: 'scene' });
  }

  /**
   * Get all user objects (excludes system/grid objects).
   * @returns {ObjectRecord[]}
   */
  list() {
    return [...this.objects.values()];
  }

  /**
   * Find by display name (case-insensitive).
   * @param {string} name
   * @returns {ObjectRecord|undefined}
   */
  getByName(name) {
    const lower = name.toLowerCase();
    for (const r of this.objects.values()) {
      if (r.name.toLowerCase() === lower) return r;
    }
  }

  /**
   * Find by id.
   * @param {string} id
   * @returns {ObjectRecord|undefined}
   */
  getById(id) { return this.objects.get(id); }

  /**
   * Get all Three.js meshes for raycasting.
   * @returns {THREE.Mesh[]}
   */
  getMeshes() {
    const meshes = [];
    for (const record of this.objects.values()) {
      record.mesh.traverse(child => {
        if (child.isMesh) meshes.push(child);
      });
    }
    return meshes;
  }

  /** Total triangle count across all objects */
  getTriangleCount() {
    let tris = 0;
    for (const r of this.objects.values()) {
      r.mesh.traverse(child => {
        if (!child.isMesh || !child.geometry) return;
        const index = child.geometry.index;
        const pos   = child.geometry.attributes.position;
        if (index) tris += index.count / 3;
        else if (pos) tris += pos.count / 3;
      });
    }
    return Math.round(tris);
  }

  /** Reset scene — remove all user objects */
  reset() {
    const ids = [...this.objects.keys()];
    ids.forEach(id => this.delete(id));
    // Reset counters
    this._counter = { box: 0, sphere: 0, cylinder: 0, plane: 0 };
  }

  _cloneObject3D(object) {
    const clone = object.clone(true);
    clone.traverse(child => {
      if (!child.isMesh) return;
      if (child.geometry) child.geometry = child.geometry.clone();
      if (Array.isArray(child.material)) {
        child.material = child.material.map(material => material.clone());
      } else if (child.material) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }

  _disposeObject3D(object) {
    object.traverse(child => {
      if (!child.isMesh) return;
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
      else if (child.material) child.material.dispose();
    });
  }
}

/**
 * @typedef {Object} ObjectRecord
 * @property {string} id
 * @property {string} name
 * @property {'box'|'sphere'|'cylinder'|'plane'} type
 * @property {THREE.Mesh} mesh
 * @property {THREE.MeshStandardMaterial} material
 */
