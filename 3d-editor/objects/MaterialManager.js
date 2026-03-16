/* ═══════════════════════════════════════════════════════════════
   MaterialManager — PBR material creation + presets
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export const MATERIAL_PRESETS = {
  plastic: { roughness: 0.5,  metalness: 0.0,  transparent: false, opacity: 1.0 },
  metal:   { roughness: 0.15, metalness: 1.0,  transparent: false, opacity: 1.0 },
  matte:   { roughness: 0.95, metalness: 0.0,  transparent: false, opacity: 1.0 },
  glass:   { roughness: 0.05, metalness: 0.0,  transparent: true,  opacity: 0.25 }
};

export const DEFAULT_COLOR = 0x909090;

export class MaterialManager {

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
    mesh.material.color.set(color);
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
    mesh.material.roughness   = p.roughness;
    mesh.material.metalness   = p.metalness;
    mesh.material.transparent = p.transparent;
    mesh.material.opacity     = p.opacity;
    mesh.material.needsUpdate = true;
  }

  setRoughness(mesh, value) {
    mesh.material.roughness = Math.max(0, Math.min(1, parseFloat(value)));
  }

  setMetalness(mesh, value) {
    mesh.material.metalness = Math.max(0, Math.min(1, parseFloat(value)));
  }

  /**
   * Set the emissive color for selection highlighting.
   * Pass null to clear.
   * @param {THREE.Mesh} mesh
   * @param {number|null} color
   */
  setEmissive(mesh, color) {
    if (!mesh.material) return;
    if (color === null) {
      mesh.material.emissive.set(0x000000);
      mesh.material.emissiveIntensity = 0;
    } else {
      mesh.material.emissive.set(color);
      mesh.material.emissiveIntensity = 0.15;
    }
  }
}
