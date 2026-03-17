/* ═══════════════════════════════════════════════════════════════
   Renderer — WebGLRenderer wrapper with resize handling
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

export class Renderer {
  /**
   * @param {HTMLElement} containerEl — The #viewport-canvas div
   */
  constructor(containerEl) {
    this.container = containerEl;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });

    // r163: use outputColorSpace instead of deprecated outputEncoding
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Size to container
    const w = containerEl.clientWidth;
    const h = containerEl.clientHeight;
    this.renderer.setSize(w, h);

    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.setSize(w, h);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.inset = '0';
    this.cssRenderer.domElement.style.zIndex = '3';
    // Keep viewport controls natural: pass through by default.
    // Web surfaces opt-in with pointer-events:auto on their own elements.
    this.cssRenderer.domElement.style.pointerEvents = 'none';

    containerEl.appendChild(this.renderer.domElement);
    containerEl.appendChild(this.cssRenderer.domElement);

    // Use ResizeObserver so resize triggers when panel itself resizes
    this._onResize = null; // set by Camera after construction
    this._ro = new ResizeObserver(() => this._handleResize());
    this._ro.observe(containerEl);
  }

  _handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.cssRenderer.setSize(w, h);
    if (this._onResize) this._onResize(w, h);
  }

  get domElement() { return this.renderer.domElement; }

  render(scene, camera) {
    this.renderer.render(scene, camera);
    this.cssRenderer.render(scene, camera);
  }

  dispose() {
    this._ro.disconnect();
    this.renderer.dispose();
  }
}
