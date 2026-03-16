/* ═══════════════════════════════════════════════════════════════
   Grid — Floor grid + axis helpers
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export class Grid {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this._visible = true;

    // Main grid helper
    // GridHelper(size, divisions, centerLineColor, gridColor)
    this.gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x3a3a3a);
    this.gridHelper.name = '__grid';
    // Slight offset so it doesn't z-fight with floor plane objects
    this.gridHelper.position.y = 0;
    scene.add(this.gridHelper);

    // Axes helper at origin (X=red, Y=green, Z=blue)
    this.axesHelper = new THREE.AxesHelper(1.2);
    this.axesHelper.name = '__axes';
    scene.add(this.axesHelper);

    // Semi-transparent shadow-receiving ground plane (invisible, but catches shadows)
    const shadowGeo = new THREE.PlaneGeometry(40, 40);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.25 });
    this.shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowPlane.name = '__shadowplane';
    this.shadowPlane.rotation.x = -Math.PI / 2;
    this.shadowPlane.position.y = -0.001;
    this.shadowPlane.receiveShadow = true;
    scene.add(this.shadowPlane);
  }

  /** Toggle grid visibility */
  setVisible(bool) {
    this._visible = bool;
    this.gridHelper.visible = bool;
    this.axesHelper.visible = bool;
  }

  get visible() { return this._visible; }
}
