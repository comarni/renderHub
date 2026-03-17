/* ═══════════════════════════════════════════════════════════════
  ModelImporter — Import 3D files, images and interactive web surfaces
   ═══════════════════════════════════════════════════════════════
   Works via:
    - Drag & drop onto the viewport (3D files + images + URLs/HTML)
    - File picker buttons
    - import <filename> command (delegates to file picker)
   ═══════════════════════════════════════════════════════════════ */

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader }  from 'three/addons/loaders/OBJLoader.js';
import { STLLoader }  from 'three/addons/loaders/STLLoader.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import * as THREE     from 'three';
import { EventBus }   from '../core/EventBus.js';
import { ImageTo3DGenerator } from './ImageTo3DGenerator.js';

export class ModelImporter {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager} objectManager
   * @param {import('../core/Camera.js').CameraManager|null} cameraManager
   * @param {import('../core/SelectionManager.js').SelectionManager|null} selectionManager
   * @param {import('./AIImage3DClient.js').AIImage3DClient|null} aiClient
   * @param {import('../core/Renderer.js').Renderer|null} renderer
   */
  constructor(objectManager, cameraManager = null, selectionManager = null, aiClient = null, renderer = null) {
    this.objs  = objectManager;
    this.camera = cameraManager;
    this.selection = selectionManager;
    this.aiClient = aiClient;
    this.renderer = renderer;
    this.image3D = new ImageTo3DGenerator(objectManager, cameraManager, selectionManager);
    this._gltf = new GLTFLoader();
    this._obj  = new OBJLoader();
    this._stl  = new STLLoader();

    this._pixelsPerUnit = 420;
    this._webSurfaces = new Map();
    this._tmpScale = new THREE.Vector3();
    this._tmpNormal = new THREE.Vector3();
    this._blobAssetUrls = new Set();
    this._raycaster = new THREE.Raycaster();
    this._dragPlane = new THREE.Plane();
    this._dragStartHit = new THREE.Vector3();
    this._dragCurrHit = new THREE.Vector3();
    this._dragStartWorldPos = new THREE.Vector3();
    this._dragNewWorldPos = new THREE.Vector3();
    this._dragCamNormal = new THREE.Vector3();
    this._dragNdc = new THREE.Vector2();
    this._tmpParentPos = new THREE.Vector3();

    this._setupDragDrop();
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /** Open system file picker and import the selected file. */
  openPicker() {
    this.openModelPicker();
  }

  openModelPicker() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.gltf,.glb,.obj,.stl';

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) this._importFile(file, { imageMode: 'image3d' });
    });

    input.click();
  }

  openImagePlanePicker() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.png,.jpg,.jpeg,.webp,.gif,.bmp';

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) this._importFile(file, { imageMode: 'plane' });
    });

    input.click();
  }

  openImage3DPicker() {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.png,.jpg,.jpeg,.webp,.gif,.bmp';

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) this._importFile(file, { imageMode: 'image3d' });
    });

    input.click();
  }

  openWebPlaneDialog() {
    const useFolder = confirm('Importar carpeta web completa (OK) o solo un archivo HTML (Cancelar)?');
    if (useFolder) {
      this.openWebFolderPicker();
      return;
    }
    this.openHTMLWebPlanePicker();
  }

  openHTMLWebPlanePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      await this._loadHTMLFileAsWebPlane(file);
    });

    input.click();
  }

  openWebFolderPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');

    input.addEventListener('change', async () => {
      const files = [...(input.files || [])];
      if (!files.length) return;

      const imported = await this._importWebFolderFiles(files);
      if (!imported) {
        EventBus.emit('terminal:log', {
          type: 'error',
          message: 'No se encontro un HTML principal en la carpeta (index.html/index.htm/index).',
        });
      }
    });

    input.click();
  }

  update() {
    this._syncWebSurfaces();
  }

  /* ── Drag & Drop ────────────────────────────────────────────── */

  _setupDragDrop() {
    const viewport = document.getElementById('viewport-canvas')
                  || document.getElementById('viewport-wrapper');
    if (!viewport) return;

    // Prevent browser from opening dropped files when not dropped exactly on viewport.
    window.addEventListener('dragover', e => e.preventDefault(), { passive: false });
    window.addEventListener('drop', e => e.preventDefault(), { passive: false });

    viewport.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      viewport.classList.add('drag-over');
    }, { passive: false });

    viewport.addEventListener('dragleave', () => {
      viewport.classList.remove('drag-over');
    });

    viewport.addEventListener('drop', async e => {
      e.preventDefault();
      viewport.classList.remove('drag-over');

      const files = [...e.dataTransfer.files];
      if (files.length) {
        const imageMode = e.altKey ? 'plane' : 'image3d';
        let importedAny = false;

        for (const file of files) {
          const ext = file.name?.split('.').pop()?.toLowerCase() || '';
          const isNativeImportable = /\.(gltf|glb|obj|stl|png|jpe?g|webp|gif|bmp)$/i.test(file.name);

          if (isNativeImportable) {
            this._importFile(file, { imageMode });
            importedAny = true;
            continue;
          }

          if (ext === 'html' || ext === 'htm' || this._isDroppedHtmlFile(file) || await this._looksLikeHtmlContent(file)) {
            await this._loadHTMLFileAsWebPlane(file, files);
            importedAny = true;
            continue;
          }
        }

        if (!importedAny && files.length > 1) {
          const folderImported = await this._importWebFolderFiles(files);
          if (folderImported) return;
        }

        if (importedAny) return;
      }

      const payload = this._extractDropPayload(e.dataTransfer);
      if (payload?.type === 'url') {
        EventBus.emit('terminal:log', {
          type: 'warn',
          message: 'Import de URLs remotas deshabilitado (modo local-only). Arrastra archivo(s) HTML local(es).',
        });
        return;
      }
      if (payload?.type === 'html') {
        this._loadHTMLStringAsWebPlane(payload.value, payload.label || 'dropped-html');
        return;
      }

      EventBus.emit('terminal:log', {
        type: 'error',
        message: 'Drop a 3D file, image, .html file, or HTML snippet.',
      });
    });
  }

  _extractDropPayload(dataTransfer) {
    const uriList = (dataTransfer.getData('text/uri-list') || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .find(s => !s.startsWith('#'));

    const text = (dataTransfer.getData('text/plain') || '').trim();
    const html = (dataTransfer.getData('text/html') || '').trim();

    const directUrl = this._parseUrl(uriList) || this._parseUrl(text);
    if (directUrl) {
      return {
        type: 'url',
        value: directUrl,
        label: directUrl.replace(/^https?:\/\//i, ''),
      };
    }

    if (html && /<\w+[^>]*>/i.test(html)) {
      return { type: 'html', value: html, label: 'html-snippet' };
    }

    if (text && /<\w+[^>]*>/i.test(text)) {
      return { type: 'html', value: text, label: 'html-snippet' };
    }

    return null;
  }

  _parseUrl(raw) {
    if (!raw) return null;
    try {
      const candidate = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  _isDroppedHtmlFile(file) {
    if (!file) return false;
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    if (ext === 'html' || ext === 'htm') return true;
    return typeof file.type === 'string' && file.type.toLowerCase().includes('text/html');
  }

  async _looksLikeHtmlContent(file) {
    if (!file || typeof file.text !== 'function') return false;
    if (file.size > 2 * 1024 * 1024) return false;

    try {
      const sample = (await file.text()).slice(0, 4096);
      return /<!doctype\s+html|<html\b|<head\b|<body\b/i.test(sample);
    } catch {
      return false;
    }
  }

  /* ── File loading ───────────────────────────────────────────── */

  _importFile(file, options = {}) {
    const ext  = file.name.split('.').pop().toLowerCase();
    const base = file.name.replace(/\.[^.]+$/, '');
    const imageMode = options.imageMode || 'image3d';

    EventBus.emit('terminal:log', {
      type: 'info',
      message: `Importing "${file.name}"…`,
    });

    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
      if (imageMode === 'plane') {
        const url = URL.createObjectURL(file);
        this._loadImagePlane(url, base, file.name);
      } else {
        this._loadImageAs3D(file, base, file.name);
      }
      return;
    }

    const url  = URL.createObjectURL(file);

    if (ext === 'glb' || ext === 'gltf') {
      this._loadGLTF(url, base, file.name);
    } else if (ext === 'obj') {
      this._loadOBJ(url, base, file.name);
    } else if (ext === 'stl') {
      this._loadSTL(url, base, file.name);
    } else {
      URL.revokeObjectURL(url);
      EventBus.emit('terminal:log', {
        type: 'error',
        message: `Unsupported file type: "${file.name}"`,
      });
    }
  }

  _loadGLTF(url, baseName, originalName) {
    this._gltf.load(
      url,
      gltf => {
        URL.revokeObjectURL(url);
        const root = gltf.scene;

        this._centerAndFloor(root);
        const name = this._uniqueName(baseName);
        this.objs.addGroup(root, name, 'gltf');

        EventBus.emit('terminal:log', {
          type: 'info',
          message: `✓ Imported "${originalName}" as "${name}"`,
        });
        EventBus.emit('state:changed', { type: 'scene' });
      },
      undefined,
      err => {
        URL.revokeObjectURL(url);
        EventBus.emit('terminal:log', {
          type: 'error',
          message: `Failed to import "${originalName}": ${err.message || err}`,
        });
      }
    );
  }

  _loadGLTFBuffer(arrayBuffer, baseName, originalName) {
    this._gltf.parse(
      arrayBuffer,
      '',
      gltf => {
        const root = gltf.scene;
        this._centerAndFloor(root);
        const name = this._uniqueName(baseName);
        this.objs.addGroup(root, name, 'gltf');

        EventBus.emit('terminal:log', {
          type: 'info',
          message: `✓ Imported AI model from "${originalName}" as "${name}"`,
        });
        EventBus.emit('state:changed', { type: 'scene' });
      },
      err => {
        EventBus.emit('terminal:log', {
          type: 'error',
          message: `Failed to parse AI GLB for "${originalName}": ${err.message || err}`,
        });
      }
    );
  }

  _loadOBJ(url, baseName, originalName) {
    this._obj.load(
      url,
      group => {
        URL.revokeObjectURL(url);

        // Assign a default grey StandardMaterial if the OBJ has MeshPhongMaterial
        group.traverse(child => {
          if (child.isMesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
            if (!child.material || child.material.isMeshPhongMaterial) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x909090,
                roughness: 0.7,
                metalness: 0.0,
              });
            }
          }
        });

        this._centerAndFloor(group);
        const name = this._uniqueName(baseName);
        this.objs.addGroup(group, name, 'obj');

        EventBus.emit('terminal:log', {
          type: 'info',
          message: `✓ Imported "${originalName}" as "${name}"`,
        });
        EventBus.emit('state:changed', { type: 'scene' });
      },
      undefined,
      err => {
        URL.revokeObjectURL(url);
        EventBus.emit('terminal:log', {
          type: 'error',
          message: `Failed to import "${originalName}": ${err.message || err}`,
        });
      }
    );
  }

  _loadSTL(url, baseName, originalName) {
    this._stl.load(
      url,
      geometry => {
        URL.revokeObjectURL(url);

        geometry.computeVertexNormals();
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
          color: 0x909090,
          roughness: 0.5,
          metalness: 0.0,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this._centerAndFloor(mesh);
        const name = this._uniqueName(baseName);
        this.objs.addGroup(mesh, name, 'stl');

        EventBus.emit('terminal:log', {
          type: 'info',
          message: `✓ Imported "${originalName}" as "${name}"`,
        });
        EventBus.emit('state:changed', { type: 'scene' });
      },
      undefined,
      err => {
        URL.revokeObjectURL(url);
        EventBus.emit('terminal:log', {
          type: 'error',
          message: `Failed to import "${originalName}": ${err.message || err}`,
        });
      }
    );
  }

  _loadImagePlane(url, baseName, originalName) {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || 1024;
      const height = image.naturalHeight || 1024;

      const texture = new THREE.Texture(image);
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;

      const ratio = width / Math.max(1, height);
      const maxDim = 2;
      const planeWidth = ratio >= 1 ? maxDim : maxDim * ratio;
      const planeHeight = ratio >= 1 ? maxDim / ratio : maxDim;

      const name = this._uniqueName(baseName);
      const record = this.objs.addImagePlane({
        name,
        texture,
        width: planeWidth,
        height: planeHeight,
      });

      if (record?.id && this.selection) {
        this.selection.selectByIds([record.id], false);
      }
      if (record?.mesh && this.camera) {
        this.camera.focusOn(record.mesh);
      }

      URL.revokeObjectURL(url);
      EventBus.emit('terminal:log', {
        type: 'info',
        message: `✓ Imported image plane "${originalName}" as "${name}"`,
      });
      EventBus.emit('state:changed', { type: 'scene' });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      EventBus.emit('terminal:log', {
        type: 'error',
        message: `Failed to import image "${originalName}"`,
      });
    };

    image.src = url;
  }

  async _loadHTMLFileAsWebPlane(file, droppedFiles = []) {
    try {
      const html = await file.text();
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const rewritten = this._rewriteHtmlWithDroppedAssets(html, file, droppedFiles);
      this._loadHTMLStringAsWebPlane(rewritten.html, baseName, file.name, rewritten.assetUrls);
    } catch (err) {
      EventBus.emit('terminal:log', {
        type: 'error',
        message: `Failed to read HTML file "${file.name}": ${err.message || err}`,
      });
    }
  }

  _loadHTMLStringAsWebPlane(html, baseName = 'web-html', originalName = 'html', assetUrls = []) {
    const name = this._uniqueName(baseName);
    const { width, height } = this._webPlaneDimensions(16 / 9);

    const record = this.objs.addWebPlane({
      name,
      width,
      height,
      source: { mode: 'html', value: html },
    });

    if (record?.mesh?.userData) {
      record.mesh.userData.webAssetUrls = assetUrls;
    }

    this._ensureWebSurface(record);

    if (record?.id && this.selection) {
      this.selection.selectByIds([record.id], false);
    }
    if (record?.mesh && this.camera) {
      this.camera.focusOn(record.mesh);
    }

    EventBus.emit('terminal:log', {
      type: 'info',
      message: `✓ Imported HTML as interactive web plane "${name}" (source: "${originalName}")`,
    });
    EventBus.emit('state:changed', { type: 'scene' });
  }

  _loadWebUrl(url, baseName = 'web-page') {
    EventBus.emit('terminal:log', {
      type: 'warn',
      message: 'Import de URLs remotas deshabilitado (modo local-only).',
    });
    return;

    const parsed = this._parseUrl(url);
    if (!parsed) {
      EventBus.emit('terminal:log', {
        type: 'error',
        message: `Invalid URL: "${url}"`,
      });
      return;
    }

    const shortName = baseName.split('/')[0].slice(0, 24) || 'web-page';
    const name = this._uniqueName(shortName);
    const { width, height } = this._webPlaneDimensions(16 / 9);

    const record = this.objs.addWebPlane({
      name,
      width,
      height,
      source: { mode: 'url', value: parsed },
    });

    this._ensureWebSurface(record);

    if (record?.id && this.selection) {
      this.selection.selectByIds([record.id], false);
    }
    if (record?.mesh && this.camera) {
      this.camera.focusOn(record.mesh);
    }

    EventBus.emit('terminal:log', {
      type: 'info',
      message: `✓ Imported URL as interactive web plane "${name}": ${parsed}`,
    });
    EventBus.emit('state:changed', { type: 'scene' });
  }

  async _loadImageAs3D(file, baseName, originalName) {
    if (this.aiClient) {
      try {
        EventBus.emit('terminal:log', {
          type: 'info',
          message: `Sending "${originalName}" to AI Image→3D backend...`,
        });

        const aiResult = await this.aiClient.generateFromImage(file, {
          provider: 'deepseek-local',
          prompt: `Generate a 3D object from image ${originalName}`,
        });

        if (aiResult?.arrayBuffer) {
          this._loadGLTFBuffer(aiResult.arrayBuffer, baseName, originalName);
          return;
        }

        EventBus.emit('terminal:log', {
          type: 'info',
          message: aiResult?.message || 'AI backend requested local fallback; using local Image→3D relief.',
        });
      } catch (err) {
        EventBus.emit('terminal:log', {
          type: 'info',
          message: `AI backend unavailable, using local Image→3D: ${err.message || err}`,
        });
      }
    }

    try {
      const result = await this.image3D.fromImageFile(file, { name: baseName });
      EventBus.emit('terminal:log', {
        type: 'info',
        message: `✓ Generated 3D from image "${originalName}" as "${result.record.name}" (${result.stats.vertices} vertices)`,
      });
      EventBus.emit('state:changed', { type: 'scene' });
    } catch (err) {
      EventBus.emit('terminal:log', {
        type: 'error',
        message: `Failed Image→3D for "${originalName}": ${err.message || err}`,
      });
    }
  }

  _webPlaneDimensions(aspect = 16 / 9) {
    const maxWidth = 2.8;
    let width = maxWidth;
    let height = width / Math.max(0.2, aspect);

    if (height > 1.9) {
      height = 1.9;
      width = height * aspect;
    }

    return { width, height };
  }

  _ensureWebSurface(record) {
    if (!record || record.type !== 'web' || this._webSurfaces.has(record.id)) return;

    const source = record.mesh.userData?.webSource || { mode: 'url', value: 'about:blank' };
    const width = record.mesh.geometry?.parameters?.width || 2.4;
    const height = record.mesh.geometry?.parameters?.height || 1.35;

    const element = document.createElement('div');
    element.className = 'web-plane-surface';
    element.style.width = `${Math.round(width * this._pixelsPerUnit)}px`;
    element.style.height = `${Math.round(height * this._pixelsPerUnit)}px`;
    element.style.pointerEvents = 'auto';

    const iframe = document.createElement('iframe');
    iframe.className = 'web-plane-frame';
    iframe.style.pointerEvents = 'auto';
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');

    if (source.mode === 'html') {
      // Keep full interactivity for local dropped HTML and avoid sandbox escape warning.
      iframe.srcdoc = source.value;
      iframe.addEventListener('load', () => {
        this._autoFitWebPlaneToIframeContent(record, iframe, element);
      });
    } else {
      // URLs are disabled in local-only mode, but keep safe defaults if re-enabled.
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups allow-downloads');
      iframe.src = source.value;
    }

    const interaction = this._attachWebPlaneInteraction(record, element, iframe);

    element.appendChild(iframe);

    const cssObject = new CSS3DObject(element);
    cssObject.userData.editorRuntimeWeb = true;

    this.objs.scene.add(cssObject);

    this._webSurfaces.set(record.id, {
      recordId: record.id,
      cssObject,
      element,
      baseScale: 1 / this._pixelsPerUnit,
      assetUrls: record.mesh.userData?.webAssetUrls || [],
      disposeInteraction: interaction?.dispose || null,
    });
  }

  _syncWebSurfaces() {
    const webRecords = this.objs.list().filter(r => r.type === 'web');

    // Auto-register new web records (including duplicates or scene loads).
    webRecords.forEach(record => this._ensureWebSurface(record));

    // Remove stale runtime surfaces.
    for (const [id, entry] of this._webSurfaces.entries()) {
      if (this.objs.getById(id)) continue;
      this.objs.scene.remove(entry.cssObject);
      if (typeof entry.disposeInteraction === 'function') {
        entry.disposeInteraction();
      }
      entry.element.remove();
      if (Array.isArray(entry.assetUrls)) {
        entry.assetUrls.forEach(url => URL.revokeObjectURL(url));
      }
      this._webSurfaces.delete(id);
    }

    for (const record of webRecords) {
      const entry = this._webSurfaces.get(record.id);
      if (!entry) continue;

      record.mesh.updateWorldMatrix(true, false);

      entry.cssObject.position.setFromMatrixPosition(record.mesh.matrixWorld);
      entry.cssObject.quaternion.setFromRotationMatrix(record.mesh.matrixWorld);

      record.mesh.getWorldScale(this._tmpScale);
      entry.cssObject.scale.set(
        this._tmpScale.x * entry.baseScale,
        this._tmpScale.y * entry.baseScale,
        this._tmpScale.z * entry.baseScale
      );

      // Keep iframe a tiny bit in front of the mesh to avoid z-fighting visual mismatch.
      this._tmpNormal.set(0, 0, 1).applyQuaternion(entry.cssObject.quaternion).normalize();
      entry.cssObject.position.addScaledVector(this._tmpNormal, 0.0025);

      const geo = record.mesh.geometry?.parameters;
      if (geo?.width && geo?.height) {
        const pxW = Math.round(geo.width * this._pixelsPerUnit);
        const pxH = Math.round(geo.height * this._pixelsPerUnit);
        if (entry.element.style.width !== `${pxW}px`) entry.element.style.width = `${pxW}px`;
        if (entry.element.style.height !== `${pxH}px`) entry.element.style.height = `${pxH}px`;
      }
    }
  }

  _autoFitWebPlaneToIframeContent(record, iframe, element) {
    if (!record?.mesh || !iframe || !element) return;

    let doc;
    try {
      doc = iframe.contentDocument || iframe.contentWindow?.document;
    } catch {
      return;
    }
    if (!doc) return;

    const readRatio = () => {
      const de = doc.documentElement;
      const body = doc.body;
      const w = Math.max(
        de?.scrollWidth || 0,
        de?.clientWidth || 0,
        body?.scrollWidth || 0,
        body?.clientWidth || 0,
        1
      );
      const h = Math.max(
        de?.scrollHeight || 0,
        de?.clientHeight || 0,
        body?.scrollHeight || 0,
        body?.clientHeight || 0,
        1
      );
      return Math.max(0.4, Math.min(2.6, w / h));
    };

    const applyFit = () => {
      const aspect = readRatio();
      const { width, height } = this._webPlaneDimensions(aspect);
      this._resizeWebPlane(record.mesh, width, height);
      element.style.width = `${Math.round(width * this._pixelsPerUnit)}px`;
      element.style.height = `${Math.round(height * this._pixelsPerUnit)}px`;
    };

    applyFit();
    setTimeout(applyFit, 120);
    setTimeout(applyFit, 450);
  }

  _resizeWebPlane(mesh, width, height) {
    if (!mesh?.geometry || !Number.isFinite(width) || !Number.isFinite(height)) return;

    const oldGeo = mesh.geometry;
    mesh.geometry = new THREE.PlaneGeometry(width, height);
    oldGeo.dispose();

    const frame = mesh.userData?.webFrameRef;
    if (frame && frame.isLineSegments) {
      if (frame.geometry) frame.geometry.dispose();
      frame.geometry = new THREE.EdgesGeometry(mesh.geometry);
      frame.position.z = 0.0015;
    }
  }

  /* ── Helpers ────────────────────────────────────────────────── */

  /**
   * Centre the model horizontally and place its bottom at y = 0.
   */
  _centerAndFloor(group) {
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());

    // Normalise size: scale down if too big (> 4 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 4) {
      const s = 3 / maxDim;
      group.scale.setScalar(s);
      // Re-compute after scale
      box.setFromObject(group);
      box.getCenter(center);
      box.getSize(size);
    }

    group.position.x -= center.x;
    group.position.z -= center.z;
    group.position.y -= box.min.y;  // floor it
  }

  _uniqueName(base) {
    const trunc = base.slice(0, 20);
    this.objs._counter[trunc] = (this.objs._counter[trunc] || 0) + 1;
    const n = this.objs._counter[trunc];
    return n === 1 ? trunc : `${trunc}.${String(n).padStart(3, '0')}`;
  }

  _attachWebPlaneInteraction(record, element, iframe) {
    if (!record?.mesh || !element) return null;

    const mesh = record.mesh;

    const moveFrame = document.createElement('div');
    moveFrame.className = 'web-plane-move-frame';

    const makeMoveHandle = (cls) => {
      const h = document.createElement('div');
      h.className = `web-plane-move-handle ${cls}`;
      moveFrame.appendChild(h);
      return h;
    };

    const moveHandles = [
      makeMoveHandle('top'),
      makeMoveHandle('right'),
      makeMoveHandle('bottom'),
      makeMoveHandle('left'),
    ];

    const makeScaleHandle = (cls) => {
      const h = document.createElement('div');
      h.className = `web-plane-scale-handle ${cls}`;
      moveFrame.appendChild(h);
      return h;
    };

    const scaleHandles = [
      makeScaleHandle('tl'),
      makeScaleHandle('tr'),
      makeScaleHandle('bl'),
      makeScaleHandle('br'),
    ];

    element.appendChild(moveFrame);

    const isPerspective = (cam) => cam && cam.isPerspectiveCamera;

    const getIntersectionsWithDragPlane = (evt, out) => {
      const cam = this.camera?.activeCamera;
      if (!cam) return false;

      const rect = this.renderer?.domElement?.getBoundingClientRect?.();
      if (!rect || !rect.width || !rect.height) return false;

      this._dragNdc.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      this._dragNdc.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._dragNdc, cam);
      return this._raycaster.ray.intersectPlane(this._dragPlane, out);
    };

    const startMoveDrag = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      const cam = this.camera?.activeCamera;
      if (!cam) return;

      if (this.selection) {
        this.selection.selectByIds([record.id], false);
      }

      mesh.updateMatrixWorld(true);
      mesh.getWorldPosition(this._dragStartWorldPos);

      if (isPerspective(cam)) {
        cam.getWorldDirection(this._dragCamNormal).normalize();
      } else {
        this._dragCamNormal.set(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
      }

      this._dragPlane.setFromNormalAndCoplanarPoint(this._dragCamNormal, this._dragStartWorldPos);
      if (!getIntersectionsWithDragPlane(evt, this._dragStartHit)) return;

      this.camera.controls.enabled = false;

      const onMove = (moveEvt) => {
        if (!getIntersectionsWithDragPlane(moveEvt, this._dragCurrHit)) return;

        this._dragNewWorldPos.copy(this._dragStartWorldPos).add(
          this._dragCurrHit.clone().sub(this._dragStartHit)
        );

        if (mesh.parent) {
          mesh.position.copy(mesh.parent.worldToLocal(this._dragNewWorldPos));
        } else {
          mesh.position.copy(this._dragNewWorldPos);
        }

        EventBus.emit('state:changed', { type: 'transform' });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.camera.controls.enabled = true;
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    const startScaleDrag = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (this.selection) {
        this.selection.selectByIds([record.id], false);
      }

      const startX = evt.clientX;
      const startY = evt.clientY;
      const startScale = mesh.scale.clone();

      this.camera.controls.enabled = false;

      const onMove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        const factor = Math.exp((dx - dy) * 0.005);
        const clamped = Math.min(8, Math.max(0.15, factor));

        mesh.scale.set(
          startScale.x * clamped,
          startScale.y * clamped,
          startScale.z * clamped
        );

        EventBus.emit('state:changed', { type: 'transform' });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.camera.controls.enabled = true;
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    moveHandles.forEach(h => h.addEventListener('pointerdown', startMoveDrag));
    scaleHandles.forEach(h => h.addEventListener('pointerdown', startScaleDrag));

    return {
      dispose: () => {
        moveHandles.forEach(h => h.removeEventListener('pointerdown', startMoveDrag));
        scaleHandles.forEach(h => h.removeEventListener('pointerdown', startScaleDrag));
      },
    };
  }

  async _importWebFolderFiles(files) {
    const mainHtml = await this._findPrimaryHtmlFile(files);
    if (!mainHtml) return false;

    await this._loadHTMLFileAsWebPlane(mainHtml, files);
    EventBus.emit('terminal:log', {
      type: 'info',
      message: `✓ Carpeta web importada (${files.length} archivos). Entrada: "${mainHtml.name}"`,
    });
    return true;
  }

  async _findPrimaryHtmlFile(files) {
    const lowered = files.map(f => ({ file: f, name: String(f.name || '').toLowerCase() }));

    const preferred = lowered.find(x => x.name === 'index.html' || x.name === 'index.htm' || x.name === 'index');
    if (preferred) return preferred.file;

    const byExt = lowered.find(x => /\.html?$/.test(x.name));
    if (byExt) return byExt.file;

    for (const item of lowered) {
      if (await this._looksLikeHtmlContent(item.file)) return item.file;
    }

    return null;
  }

  _normalizeRelPath(pathLike) {
    return String(pathLike || '').replace(/\\\\/g, '/').replace(/^\.\//, '');
  }

  _resolveRelativePath(baseDir, ref) {
    const parts = this._normalizeRelPath(`${baseDir}/${ref}`).split('/');
    const out = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (out.length) out.pop();
        continue;
      }
      out.push(part);
    }
    return out.join('/');
  }

  _rewriteHtmlWithDroppedAssets(html, htmlFile, droppedFiles) {
    if (!Array.isArray(droppedFiles) || droppedFiles.length <= 1) {
      return { html, assetUrls: [] };
    }

    let doc;
    try {
      doc = new DOMParser().parseFromString(html, 'text/html');
    } catch {
      return { html, assetUrls: [] };
    }

    const lower = s => this._normalizeRelPath(s).toLowerCase();
    const basename = s => {
      const n = lower(s);
      const i = n.lastIndexOf('/');
      return i >= 0 ? n.slice(i + 1) : n;
    };

    const htmlName = lower(htmlFile?.name || '');
    const htmlRel = lower(htmlFile?.webkitRelativePath || htmlName);
    const htmlDir = htmlRel.includes('/') ? htmlRel.slice(0, htmlRel.lastIndexOf('/') + 1) : '';

    const fileToBlob = new Map();
    const manifest = Object.create(null);
    const assetUrls = [];
    const addManifest = (key, url) => {
      if (!key || manifest[key]) return;
      manifest[key] = url;
    };
    const getBlobUrl = (file) => {
      if (fileToBlob.has(file)) return fileToBlob.get(file);
      const blobUrl = URL.createObjectURL(file);
      fileToBlob.set(file, blobUrl);
      this._blobAssetUrls.add(blobUrl);
      assetUrls.push(blobUrl);
      return blobUrl;
    };

    droppedFiles.forEach(file => {
      const rel = lower(file.webkitRelativePath || file.name);
      const base = basename(rel);
      const blobUrl = getBlobUrl(file);

      addManifest(rel, blobUrl);
      addManifest(base, blobUrl);
    });

    const attrs = [
      ['img', 'src'],
      ['script', 'src'],
      ['link', 'href'],
      ['a', 'href'],
      ['iframe', 'src'],
      ['source', 'src'],
      ['video', 'src'],
      ['audio', 'src'],
    ];

    const isLocalRef = value => {
      const v = this._normalizeRelPath(String(value || '').trim());
      if (!v) return false;
      if (v.startsWith('#')) return false;
      if (/^(?:https?:|data:|blob:|javascript:|mailto:|tel:)/i.test(v)) return false;
      return true;
    };

    const cleanRef = value => {
      const v = this._normalizeRelPath(String(value || '').trim());
      const noQuery = v.split('?')[0].split('#')[0];
      return noQuery.replace(/^\//, '').replace(/^\.\//, '');
    };

    attrs.forEach(([tag, attr]) => {
      doc.querySelectorAll(`${tag}[${attr}]`).forEach(node => {
        const raw = node.getAttribute(attr);
        if (!isLocalRef(raw)) return;

        const ref = cleanRef(raw);
        const refLower = lower(ref);
        const resolved = lower(this._resolveRelativePath(htmlDir, refLower));
        const candidates = [
          resolved,
          refLower,
          basename(refLower),
        ];

        let resolvedUrl = null;
        for (const candidate of candidates) {
          if (manifest[candidate]) {
            resolvedUrl = manifest[candidate];
            break;
          }
        }

        if (!resolvedUrl) return;
        node.setAttribute(attr, resolvedUrl);
      });
    });

    const escapeScript = s => String(s).replace(/<\//g, '<\\/');
    const runtimeScript = escapeScript(`;(() => { try {
  const MAP = ${JSON.stringify(manifest)};
  const norm = (v) => String(v || '').trim().replace(/\\\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  const isLocal = (v) => {
    const s = String(v || '').trim();
    return !!s && !s.startsWith('#') && !/^(?:https?:|data:|blob:|javascript:|mailto:|tel:)/i.test(s);
  };
  const resolve = (v) => {
    if (!isLocal(v)) return null;
    const clean = norm(String(v).split('?')[0].split('#')[0]);
    if (MAP[clean]) return MAP[clean];
    const base = clean.includes('/') ? clean.slice(clean.lastIndexOf('/') + 1) : clean;
    return MAP[base] || null;
  };

  window.__renderhubResolveLocal = resolve;

  if (typeof window.fetch === 'function') {
    const _fetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      if (typeof input === 'string') {
        const r = resolve(input);
        if (r) input = r;
      } else if (input && typeof input.url === 'string') {
        const r = resolve(input.url);
        if (r) input = r;
      }
      return _fetch(input, init);
    };
  }

  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype && window.XMLHttpRequest.prototype.open) {
    const _open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string') {
        const r = resolve(url);
        if (r) {
          arguments[1] = r;
        }
      }
      // Avoid deprecated sync XHR in imported content; enforce async open.
      if (arguments.length >= 3 && arguments[2] === false) {
        arguments[2] = true;
      }
      return _open.apply(this, arguments);
    };
  }

  if (window.Element && window.Element.prototype && window.Element.prototype.setAttribute) {
    const _setAttribute = window.Element.prototype.setAttribute;
    window.Element.prototype.setAttribute = function(name, value) {
      const key = String(name || '').toLowerCase();
      if ((key === 'src' || key === 'href' || key === 'action') && typeof value === 'string') {
        const r = resolve(value);
        if (r) value = r;
      }
      return _setAttribute.call(this, name, value);
    };
  }

  if (window.location && typeof window.location.assign === 'function') {
    const _assign = window.location.assign.bind(window.location);
    window.location.assign = function(url) {
      if (typeof url === 'string') {
        const r = resolve(url);
        if (r) url = r;
      }
      return _assign(url);
    };
  }

  if (window.location && typeof window.location.replace === 'function') {
    const _replace = window.location.replace.bind(window.location);
    window.location.replace = function(url) {
      if (typeof url === 'string') {
        const r = resolve(url);
        if (r) url = r;
      }
      return _replace(url);
    };
  }

  if (typeof window.open === 'function') {
    const _openWindow = window.open.bind(window);
    window.open = function(url) {
      if (typeof url === 'string') {
        const r = resolve(url);
        if (r) {
          arguments[0] = r;
        }
      }
      return _openWindow.apply(window, arguments);
    };
  }

  document.addEventListener('click', function(e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    const r = resolve(a.getAttribute('href'));
    if (!r) return;
    e.preventDefault();
    if (a.target === '_blank') {
      window.open(r, '_blank');
      return;
    }
    window.location.href = r;
  }, true);
} catch (e) { console.warn('[RenderHub:web-runtime]', e); } })();`);

    const injectRuntime = () => {
      const script = doc.createElement('script');
      script.type = 'text/javascript';
      script.textContent = runtimeScript;
      if (doc.head) {
        doc.head.prepend(script);
      } else if (doc.documentElement) {
        doc.documentElement.prepend(script);
      }
    };
    injectRuntime();

    return {
      html: `<!doctype html>\n${doc.documentElement.outerHTML}`,
      assetUrls,
    };
  }
}
