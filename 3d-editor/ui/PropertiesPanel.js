/* ═══════════════════════════════════════════════════════════════
   PropertiesPanel — Right panel: transform + material + camera
   Syncs bidirectionally with CommandParser via EventBus.
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';

const RAD2DEG = 180 / Math.PI;

export class PropertiesPanel {
  /**
   * @param {import('../commands/CommandParser.js').CommandParser}   commandParser
   * @param {import('../core/SelectionManager.js').SelectionManager} selectionManager
   * @param {import('../core/Camera.js').CameraManager}              cameraManager
   * @param {import('../export/ObjectExporter.js').ObjectExporter|null} objectExporter
   */
  constructor(commandParser, selectionManager, cameraManager, objectExporter = null) {
    this.parser = commandParser;
    this.sel    = selectionManager;
    this.cam    = cameraManager;
    this.objectExporter = objectExporter;

    // Guard against circular updates
    this._isRefreshing = false;

    this._bindElements();
    this._setupListeners();

    EventBus.on('state:changed', () => this._refresh());
  }

  _bindElements() {
    // Object section
    this._empty   = document.getElementById('props-empty');
    this._content = document.getElementById('props-content');
    this._propName = document.getElementById('prop-name');
    this._propType = document.getElementById('prop-type');

    // Transform
    this._posX = document.getElementById('pos-x');
    this._posY = document.getElementById('pos-y');
    this._posZ = document.getElementById('pos-z');
    this._rotX = document.getElementById('rot-x');
    this._rotY = document.getElementById('rot-y');
    this._rotZ = document.getElementById('rot-z');
    this._sclX = document.getElementById('scl-x');
    this._sclY = document.getElementById('scl-y');
    this._sclZ = document.getElementById('scl-z');

    // Material
    this._colorPicker  = document.getElementById('prop-color');
    this._colorHex     = document.getElementById('prop-color-hex');
    this._matGallery   = document.getElementById('material-gallery');
    this._roughSlider  = document.getElementById('prop-roughness');
    this._roughVal     = document.getElementById('prop-roughness-val');
    this._metalSlider  = document.getElementById('prop-metalness');
    this._metalVal     = document.getElementById('prop-metalness-val');

    // Actions
    this._btnExportSTL = document.getElementById('btn-export-object-stl');
    this._btnExportGLB = document.getElementById('btn-export-object-glb');
    this._btnDuplicate = document.getElementById('btn-duplicate');
    this._btnFocus     = document.getElementById('btn-focus');
    this._btnDelete    = document.getElementById('btn-delete');

    // Camera
    this._camFOV   = document.getElementById('cam-fov');
    this._camFOVVal= document.getElementById('cam-fov-val');
    this._camNear  = document.getElementById('cam-near');
    this._camFar   = document.getElementById('cam-far');
    this._btnResetCam = document.getElementById('btn-reset-camera');
  }

  _setupListeners() {
    // Object name
    if (this._propName) {
      this._propName.addEventListener('change', () => {
        if (this._isRefreshing) return;
        const rec = this.sel.getPrimary();
        if (rec) this.parser.execute(`rename ${this._propName.value}`);
      });
    }

    // Position
    [this._posX, this._posY, this._posZ].forEach(input => {
      if (!input) return;
      input.addEventListener('change', () => {
        if (this._isRefreshing) return;
        this.parser.execute(`move ${this._posX.value} ${this._posY.value} ${this._posZ.value}`);
      });
    });

    // Rotation
    [this._rotX, this._rotY, this._rotZ].forEach(input => {
      if (!input) return;
      input.addEventListener('change', () => {
        if (this._isRefreshing) return;
        this.parser.execute(`rotate ${this._rotX.value} ${this._rotY.value} ${this._rotZ.value}`);
      });
    });

    // Scale
    [this._sclX, this._sclY, this._sclZ].forEach(input => {
      if (!input) return;
      input.addEventListener('change', () => {
        if (this._isRefreshing) return;
        this.parser.execute(`scale ${this._sclX.value} ${this._sclY.value} ${this._sclZ.value}`);
      });
    });

    // Color picker
    if (this._colorPicker) {
      this._colorPicker.addEventListener('input', () => {
        if (this._isRefreshing) return;
        this.parser.execute(`color ${this._colorPicker.value}`);
        if (this._colorHex) this._colorHex.value = this._colorPicker.value;
      });
    }

    // Color hex text input
    if (this._colorHex) {
      this._colorHex.addEventListener('change', () => {
        if (this._isRefreshing) return;
        let hex = this._colorHex.value.trim();
        if (!hex.startsWith('#')) hex = '#' + hex;
        this.parser.execute(`color ${hex}`);
      });
    }

    // Material gallery buttons
    if (this._matGallery) {
      this._matGallery.addEventListener('click', (e) => {
        const btn = e.target.closest('.mat-btn');
        if (!btn || this._isRefreshing) return;
        this.parser.execute(`material ${btn.dataset.preset}`);
        this._highlightMatBtn(btn.dataset.preset);
      });
    }

    // Roughness slider
    if (this._roughSlider) {
      this._roughSlider.addEventListener('input', () => {
        if (this._isRefreshing) return;
        if (this._roughVal) this._roughVal.textContent = parseFloat(this._roughSlider.value).toFixed(2);
        this.parser.execute(`roughness ${this._roughSlider.value}`);
      });
    }

    // Metalness slider
    if (this._metalSlider) {
      this._metalSlider.addEventListener('input', () => {
        if (this._isRefreshing) return;
        if (this._metalVal) this._metalVal.textContent = parseFloat(this._metalSlider.value).toFixed(2);
        this.parser.execute(`metalness ${this._metalSlider.value}`);
      });
    }

    // Action buttons
    if (this._btnExportSTL) {
      this._btnExportSTL.addEventListener('click', () => {
        const rec = this.sel.getPrimary();
        if (!rec || !this.objectExporter) return;
        const res = this.objectExporter.exportSTL(rec);
        EventBus.emit('terminal:log', { type: res.success ? 'info' : 'error', message: res.message });
      });
    }
    if (this._btnExportGLB) {
      this._btnExportGLB.addEventListener('click', async () => {
        const rec = this.sel.getPrimary();
        if (!rec || !this.objectExporter) return;
        EventBus.emit('terminal:log', { type: 'info', message: `Exportando GLB "${rec.name}"…` });
        const res = await this.objectExporter.exportGLB(rec);
        EventBus.emit('terminal:log', { type: res.success ? 'info' : 'error', message: res.message });
      });
    }
    if (this._btnDuplicate) this._btnDuplicate.addEventListener('click', () => this.parser.execute('duplicate'));
    if (this._btnFocus)     this._btnFocus.addEventListener('click',     () => this.parser.execute('focus'));
    if (this._btnDelete)    this._btnDelete.addEventListener('click',    () => this.parser.execute('delete'));

    // Camera FOV
    if (this._camFOV) {
      this._camFOV.addEventListener('input', () => {
        const fov = parseInt(this._camFOV.value, 10);
        if (this._camFOVVal) this._camFOVVal.textContent = fov;
        this.cam.setFOV(fov);
      });
    }

    // Camera near/far
    if (this._camNear) {
      this._camNear.addEventListener('change', () => {
        const near = parseFloat(this._camNear.value);
        if (near > 0) this.cam.setNear(near);
      });
    }
    if (this._camFar) {
      this._camFar.addEventListener('change', () => {
        const far = parseFloat(this._camFar.value);
        if (far > 0) this.cam.setFar(far);
      });
    }

    // Reset camera
    if (this._btnResetCam) {
      this._btnResetCam.addEventListener('click', () => {
        this.cam.resetView();
        this._refreshCamera();
        EventBus.emit('state:changed', { type: 'camera' });
      });
    }

    // Collapsible sections
    document.querySelectorAll('.panel-header.collapsible').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const body = targetId ? document.getElementById(targetId) : null;
        if (!body) return;
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? '' : 'none';
        header.classList.toggle('collapsed', !isHidden);
      });
    });
  }

  /* ══ Refresh ══════════════════════════════════════════════════ */

  _refresh() {
    const rec = this.sel.getPrimary();

    if (!rec) {
      this._showEmpty();
      return;
    }

    this._showContent();
    this._isRefreshing = true;

    try {
      const mesh = rec.mesh;

      // Object info
      if (this._propName) this._propName.value = rec.name;
      if (this._propType) this._propType.textContent = rec.type;

      // Position
      if (this._posX) this._posX.value = mesh.position.x.toFixed(3);
      if (this._posY) this._posY.value = mesh.position.y.toFixed(3);
      if (this._posZ) this._posZ.value = mesh.position.z.toFixed(3);

      // Rotation (rad → deg)
      if (this._rotX) this._rotX.value = (mesh.rotation.x * RAD2DEG).toFixed(1);
      if (this._rotY) this._rotY.value = (mesh.rotation.y * RAD2DEG).toFixed(1);
      if (this._rotZ) this._rotZ.value = (mesh.rotation.z * RAD2DEG).toFixed(1);

      // Scale
      if (this._sclX) this._sclX.value = mesh.scale.x.toFixed(3);
      if (this._sclY) this._sclY.value = mesh.scale.y.toFixed(3);
      if (this._sclZ) this._sclZ.value = mesh.scale.z.toFixed(3);

      // Material
      const material = this.parser.mats.getPrimaryMaterial(mesh);
      if (material) {
        const hexStr = '#' + material.color.getHexString();
        if (this._colorPicker) this._colorPicker.value = hexStr;
        if (this._colorHex)    this._colorHex.value    = hexStr;

        if (this._roughSlider) this._roughSlider.value = material.roughness;
        if (this._roughVal)    this._roughVal.textContent = material.roughness.toFixed(2);
        if (this._metalSlider) this._metalSlider.value = material.metalness;
        if (this._metalVal)    this._metalVal.textContent = material.metalness.toFixed(2);
        this._highlightMatBtn(mesh.userData.presetName || null);
      }
    } finally {
      this._isRefreshing = false;
    }
  }

  _refreshCamera() {
    this._isRefreshing = true;
    if (this._camFOV) {
      this._camFOV.value = Math.round(this.cam.perspCamera.fov);
      if (this._camFOVVal) this._camFOVVal.textContent = Math.round(this.cam.perspCamera.fov);
    }
    if (this._camNear) this._camNear.value = this.cam.perspCamera.near;
    if (this._camFar)  this._camFar.value  = this.cam.perspCamera.far;
    this._isRefreshing = false;
  }

  _highlightMatBtn(presetName) {
    if (!this._matGallery) return;
    this._matGallery.querySelectorAll('.mat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });
  }

  _showEmpty() {
    if (this._empty)   this._empty.classList.remove('hidden');
    if (this._content) this._content.classList.add('hidden');
  }

  _showContent() {
    if (this._empty)   this._empty.classList.add('hidden');
    if (this._content) this._content.classList.remove('hidden');
  }
}
