/* ═══════════════════════════════════════════════════════════════
   SceneManager — Three.js scene + PBR lighting setup
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2b2b2b);

    this._setupLights();
  }

  _setupLights() {
    // Soft ambient fill
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    ambient.name = '__ambient';
    this.scene.add(ambient);

    // Key directional light with shadows
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.name = '__key';
    key.position.set(6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 50;
    key.shadow.camera.left   = -15;
    key.shadow.camera.right  =  15;
    key.shadow.camera.top    =  15;
    key.shadow.camera.bottom = -15;
    key.shadow.bias = -0.0003;
    this.scene.add(key);

    // Soft fill light (opposite side)
    const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
    fill.name = '__fill';
    fill.position.set(-5, 4, -6);
    this.scene.add(fill);

    // Rim light from below (slight bounce)
    const rim = new THREE.DirectionalLight(0xffffff, 0.15);
    rim.name = '__rim';
    rim.position.set(0, -5, 0);
    this.scene.add(rim);
  }
}
