/* ═══════════════════════════════════════════════════════════════
   CameraManager — Perspective + Orthographic + OrbitControls
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraManager {
  /**
   * @param {HTMLElement} containerEl
   * @param {HTMLElement} rendererDomElement
   */
  constructor(containerEl, rendererDomElement) {
    this.container = containerEl;
    this._mode = 'perspective'; // 'perspective' | 'top' | 'front' | 'right'

    const w = containerEl.clientWidth  || 800;
    const h = containerEl.clientHeight || 600;
    const aspect = w / h;

    // Perspective camera
    this.perspCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.perspCamera.position.set(5, 5, 8);
    this.perspCamera.lookAt(0, 0, 0);

    // Orthographic camera
    this._orthoSize = 6;
    this.orthoCamera = new THREE.OrthographicCamera(
      -this._orthoSize * aspect,
       this._orthoSize * aspect,
       this._orthoSize,
      -this._orthoSize,
      0.1, 1000
    );

    // OrbitControls on perspective camera
    this.controls = new OrbitControls(this.perspCamera, rendererDomElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 200;
    this.controls.zoomSpeed = 0.8;
    this.controls.rotateSpeed = 0.6;
    this.controls.panSpeed = 0.8;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Camera currently used for rendering */
  get activeCamera() {
    return this._mode === 'perspective' ? this.perspCamera : this.orthoCamera;
  }

  get mode() { return this._mode; }

  /**
   * Switch between view modes.
   * @param {'perspective'|'top'|'front'|'right'} view
   */
  setView(view) {
    const w = this.container.clientWidth  || 800;
    const h = this.container.clientHeight || 600;
    const aspect = w / h;

    this._mode = view;

    if (view === 'perspective') {
      this.controls.enableRotate = true;
      return;
    }

    // Ortho views: position camera far away on the appropriate axis
    this.controls.enableRotate = false;

    const dist = 50;
    switch (view) {
      case 'top':
        this.orthoCamera.position.set(0, dist, 0);
        this.orthoCamera.up.set(0, 0, -1);
        break;
      case 'front':
        this.orthoCamera.position.set(0, 0, dist);
        this.orthoCamera.up.set(0, 1, 0);
        break;
      case 'right':
        this.orthoCamera.position.set(dist, 0, 0);
        this.orthoCamera.up.set(0, 1, 0);
        break;
    }
    this.orthoCamera.lookAt(0, 0, 0);
    this._updateOrthoFrustum(aspect);
  }

  /**
   * Called on resize — updates both cameras.
   * @param {number} w
   * @param {number} h
   */
  onResize(w, h) {
    const aspect = w / h;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
    this._updateOrthoFrustum(aspect);
  }

  _updateOrthoFrustum(aspect) {
    this.orthoCamera.left   = -this._orthoSize * aspect;
    this.orthoCamera.right  =  this._orthoSize * aspect;
    this.orthoCamera.top    =  this._orthoSize;
    this.orthoCamera.bottom = -this._orthoSize;
    this.orthoCamera.updateProjectionMatrix();
  }

  /** Reset to default perspective view */
  resetView() {
    this._mode = 'perspective';
    this.controls.enableRotate = true;
    this.perspCamera.position.set(5, 5, 8);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Focus camera on a given object/position */
  focusOn(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.5;

    // Keep current direction, just change distance
    const dir = this.perspCamera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(center);
    this.perspCamera.position.copy(center).addScaledVector(dir, distance);
    this.controls.update();
  }

  /** Update FOV on perspective camera */
  setFOV(fov) {
    this.perspCamera.fov = fov;
    this.perspCamera.updateProjectionMatrix();
  }

  setNear(near) {
    this.perspCamera.near = near;
    this.perspCamera.updateProjectionMatrix();
    this.orthoCamera.near = near;
    this.orthoCamera.updateProjectionMatrix();
  }

  setFar(far) {
    this.perspCamera.far = far;
    this.perspCamera.updateProjectionMatrix();
    this.orthoCamera.far = far;
    this.orthoCamera.updateProjectionMatrix();
  }

  /** Called every frame in the RAF loop */
  update() {
    if (this._mode === 'perspective') this.controls.update();
  }
}
