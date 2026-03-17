/* ═══════════════════════════════════════════════════════════════
   MaterialManager — PBR material creation + presets
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export const MATERIAL_PRESETS = {
  plastic:  { roughness: 0.50, metalness: 0.00, transparent: false, opacity: 1.0,  swatch: '#9090e0' },
  metal:    { roughness: 0.15, metalness: 1.00, transparent: false, opacity: 1.0,  swatch: '#b0b8c0' },
  matte:    { roughness: 0.95, metalness: 0.00, transparent: false, opacity: 1.0,  swatch: '#606060' },
  glass:    { roughness: 0.05, metalness: 0.00, transparent: true,  opacity: 0.25, swatch: '#88ccee' },
  rubber:   { roughness: 0.90, metalness: 0.00, transparent: false, opacity: 1.0,  swatch: '#2a2a2a' },
  chrome:   { roughness: 0.05, metalness: 1.00, transparent: false, opacity: 1.0,  swatch: '#c8d0d8' },
  gold:     { roughness: 0.20, metalness: 1.00, transparent: false, opacity: 1.0,  swatch: '#ffc060' },
  wood:     { roughness: 0.80, metalness: 0.00, transparent: false, opacity: 1.0,  swatch: '#8b5e3c' },
  concrete: { roughness: 0.95, metalness: 0.05, transparent: false, opacity: 1.0,  swatch: '#888880' },
  ceramic:  { roughness: 0.30, metalness: 0.05, transparent: false, opacity: 1.0,  swatch: '#f0ebe0' },
  carbon:   { roughness: 0.40, metalness: 0.60, transparent: false, opacity: 1.0,  swatch: '#1c2028' },
  velvet:   { roughness: 1.00, metalness: 0.00, transparent: false, opacity: 1.0,  swatch: '#7030a0' },
};

export const DEFAULT_COLOR = 0x909090;

export class MaterialManager {

  _forEachMesh(target, callback) {
    if (!target) return;
    if (target.isMesh) {
      callback(target);
      return;
    }
    if (target.traverse) {
      target.traverse(child => {
        if (child.isMesh) callback(child);
      });
    }
  }

  getPrimaryMaterial(target) {
    if (!target) return null;
    if (target.isMesh && target.material) return Array.isArray(target.material) ? target.material[0] : target.material;

    let first = null;
    this._forEachMesh(target, mesh => {
      if (first || !mesh.material) return;
      first = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    });
    return first;
  }

  /**
   * Create a new MeshStandardMaterial with preset defaults.
   * @param {number|string} color   — THREE color (0xrrggbb or '#rrggbb')
   * @param {string} preset         — 'plastic'|'metal'|'matte'|'glass'
   * @returns {THREE.MeshStandardMaterial}
   */
  createMaterial(color = DEFAULT_COLOR, preset = 'plastic') {
    const p = MATERIAL_PRESETS[preset] || MATERIAL_PRESETS.plastic;
    return new THREE.MeshStandardMaterial({
      color,
      roughness:   p.roughness,
      metalness:   p.metalness,
      transparent: p.transparent,
      opacity:     p.opacity,
      side:        THREE.FrontSide
    });
  }

  /**
   * Apply a HEX color string to a mesh material.
   * @param {THREE.Mesh} mesh
   * @param {string} hexColor — '#rrggbb' or 'rrggbb'
   */
  applyColor(mesh, hexColor) {
    const color = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;
    this._forEachMesh(mesh, child => {
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (material?.color) material.color.set(color);
    });
  }

  /**
   * Apply a named material preset (replaces roughness/metalness/transparency).
   * Preserves current color.
   * @param {THREE.Mesh} mesh
   * @param {string} presetName
   */
  applyPreset(mesh, presetName) {
    const p = MATERIAL_PRESETS[presetName];
    if (!p) return;
    this._forEachMesh(mesh, child => {
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (!material) return;
      material.roughness   = p.roughness;
      material.metalness   = p.metalness;
      material.transparent = p.transparent;
      material.opacity     = p.opacity;
      material.needsUpdate = true;
      child.userData.presetName = presetName;
    });
    mesh.userData.presetName  = presetName;
  }

  setRoughness(mesh, value) {
    const next = Math.max(0, Math.min(1, parseFloat(value)));
    this._forEachMesh(mesh, child => {
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (material) material.roughness = next;
    });
  }

  setMetalness(mesh, value) {
    const next = Math.max(0, Math.min(1, parseFloat(value)));
    this._forEachMesh(mesh, child => {
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (material) material.metalness = next;
    });
  }

  /**
   * Set the emissive color for selection highlighting.
   * Pass null to clear.
   * @param {THREE.Mesh} mesh
   * @param {number|null} color
   */
  setEmissive(mesh, color) {
    this._forEachMesh(mesh, child => {
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (!material?.emissive) return;
      if (color === null) {
        material.emissive.set(0x000000);
        material.emissiveIntensity = 0;
      } else {
        material.emissive.set(color);
        material.emissiveIntensity = 0.15;
      }
    });
  }
}
