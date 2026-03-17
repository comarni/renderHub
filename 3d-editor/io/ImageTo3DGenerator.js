/* ═══════════════════════════════════════════════════════════════
   ImageTo3DGenerator — Build a 3D relief mesh from a dropped image
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export class ImageTo3DGenerator {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager} objectManager
   * @param {import('../core/Camera.js').CameraManager|null} cameraManager
   * @param {import('../core/SelectionManager.js').SelectionManager|null} selectionManager
   */
  constructor(objectManager, cameraManager = null, selectionManager = null) {
    this.objs = objectManager;
    this.camera = cameraManager;
    this.selection = selectionManager;
  }

  /**
   * Generate a displaced mesh from image luminance and alpha.
   * @param {File} file
   * @param {{name?: string, segments?: number, depth?: number}} options
   * @returns {Promise<{record: any, stats: {vertices: number, segments: number}}>} 
   */
  async fromImageFile(file, options = {}) {
    const baseName = (options.name || file.name || 'image')
      .replace(/\.[^.]+$/, '')
      .slice(0, 28);

    const image = await this._loadImageFromFile(file);
    const width = image.naturalWidth || image.width || 1024;
    const height = image.naturalHeight || image.height || 1024;

    const ratio = width / Math.max(1, height);
    const targetMax = 2.4;
    const worldW = ratio >= 1 ? targetMax : targetMax * ratio;
    const worldH = ratio >= 1 ? targetMax / ratio : targetMax;

    const texture = new THREE.Texture(image);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const segments = Math.max(40, Math.min(180, options.segments || 120));
    const depthStrength = Math.max(0.03, Math.min(0.5, options.depth || 0.22));

    const sample = this._sampleImage(image, segments + 1, segments + 1);
    const geometry = new THREE.PlaneGeometry(worldW, worldH, segments, segments);
    const pos = geometry.attributes.position;

    for (let yi = 0; yi <= segments; yi++) {
      for (let xi = 0; xi <= segments; xi++) {
        const i = yi * (segments + 1) + xi;
        const idx = i * 4;
        const r = sample[idx] / 255;
        const g = sample[idx + 1] / 255;
        const b = sample[idx + 2] / 255;
        const a = sample[idx + 3] / 255;

        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const edge = this._estimateEdge(sample, xi, yi, segments + 1, segments + 1);

        // Weighted pseudo-depth from luminance + local contrast.
        const depth = ((1 - luma) * 0.68 + edge * 0.45) * a;
        const z = depth * depthStrength;
        pos.setZ(i, z);
      }
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.06,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Keep it visible by default in front area.
    mesh.position.set(0, Math.max(1.0, worldH * 0.6), 0);

    const name = this._uniqueName(baseName);
    const record = this.objs.addGroup(mesh, name, 'image3d');

    if (record?.id && this.selection) {
      this.selection.selectByIds([record.id], false);
    }
    if (record?.mesh && this.camera) {
      this.camera.focusOn(record.mesh);
    }

    return {
      record,
      stats: {
        vertices: (segments + 1) * (segments + 1),
        segments,
      },
    };
  }

  async _loadImageFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image decode failed'));
        img.src = url;
      });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  _sampleImage(image, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }

  _estimateEdge(data, x, y, w, h) {
    const ix0 = Math.max(0, x - 1);
    const ix1 = Math.min(w - 1, x + 1);
    const iy0 = Math.max(0, y - 1);
    const iy1 = Math.min(h - 1, y + 1);

    const l = this._lumaAt(data, ix0, y, w);
    const r = this._lumaAt(data, ix1, y, w);
    const t = this._lumaAt(data, x, iy0, w);
    const b = this._lumaAt(data, x, iy1, w);

    return Math.min(1, Math.hypot(r - l, b - t));
  }

  _lumaAt(data, x, y, w) {
    const i = (y * w + x) * 4;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  _uniqueName(base) {
    const trunc = base.slice(0, 20);
    this.objs._counter[trunc] = (this.objs._counter[trunc] || 0) + 1;
    const n = this.objs._counter[trunc];
    return n === 1 ? `${trunc}.3d` : `${trunc}.3d.${String(n).padStart(3, '0')}`;
  }
}
