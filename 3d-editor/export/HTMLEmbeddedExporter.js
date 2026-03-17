/* ═══════════════════════════════════════════════════════════════
   HTMLEmbeddedExporter — Export interactive 3D scene as standalone HTML
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export class HTMLEmbeddedExporter {
  /**
   * @param {THREE.Scene}                                             scene
   * @param {import('../objects/ObjectManager.js').ObjectManager}     objectManager
   * @param {import('../objects/MaterialManager.js').MaterialManager} materialManager
   */
  constructor(scene, objectManager, materialManager) {
    this.scene = scene;
    this.objs = objectManager;
    this.mat = materialManager;
  }

  /**
   * Serialize scene data (objects, materials, transforms).
   * @returns {Object}
   */
  _serializeScene() {
    const objects = this.objs.list();
    const sceneData = {
      background: this.scene.background ? `#${this.scene.background.getHexString()}` : '#2b2b2b',
      objects: []
    };

    objects.forEach(record => {
      const mesh = record.mesh;
      this.scene.updateMatrixWorld(false);

      // Get primary material
      let mat = null;
      if (mesh.material) {
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        mat = {
          color: material.color ? `#${material.color.getHexString()}` : '#909090',
          roughness: material.roughness !== undefined ? material.roughness : 0.5,
          metalness: material.metalness !== undefined ? material.metalness : 0,
          transparent: material.transparent || false,
          opacity: material.opacity !== undefined ? material.opacity : 1.0
        };
      }

      // Geometry type from userData
      const geoType = record.type || 'box';

      sceneData.objects.push({
        id: record.id,
        name: record.name,
        type: geoType,
        position: [mesh.position.x, mesh.position.y, mesh.position.z],
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
        material: mat,
        // Geometry parameters
        geometryParams: this._getGeometryParams(geoType)
      });
    });

    return sceneData;
  }

  /**
   * Get geometry construction parameters for a given type.
   * @param {string} geoType - 'box'|'sphere'|'cylinder'|'plane'
   * @returns {Object}
   */
  _getGeometryParams(geoType) {
    switch (geoType) {
      case 'box':      return { type: 'box', width: 1, height: 1, depth: 1 };
      case 'sphere':   return { type: 'sphere', radius: 0.5, widthSegments: 32, heightSegments: 32 };
      case 'cylinder': return { type: 'cylinder', radiusTop: 0.5, radiusBottom: 0.5, height: 1, radialSegments: 32 };
      case 'plane':    return { type: 'plane', width: 2, height: 2 };
      default:         return { type: 'box', width: 1, height: 1, depth: 1 };
    }
  }

  /**
   * Generate complete standalone HTML with embedded Three.js scene.
   * @param {string} title - Page title
   * @returns {string} Complete HTML document
   */
  _generateHTML(title = 'RenderHub Export') {
    const sceneData = JSON.stringify(this._serializeScene(), null, 2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a1a;
      overflow: hidden;
    }

    #canvas-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #2b2b2b;
      position: relative;
    }

    #info-panel {
      position: absolute;
      top: 16px;
      left: 16px;
      background: rgba(0, 0, 0, 0.8);
      color: #e0e0e0;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      max-width: 280px;
      z-index: 100;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    }

    #info-panel h3 {
      font-size: 14px;
      margin-bottom: 8px;
      color: #6fc9f6;
    }

    .info-line {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
    }

    #controls-panel {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #e0e0e0;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      text-align: center;
      z-index: 100;
    }

    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #6fc9f6;
      font-size: 16px;
    }

    .spinner {
      display: inline-block;
      width: 30px;
      height: 30px;
      border: 3px solid rgba(111, 201, 246, 0.3);
      border-top: 3px solid #6fc9f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading 3D scene...</p>
    </div>
  </div>

  <div id="info-panel">
    <h3>🎨 RenderHub Export</h3>
    <div class="info-line">
      <span>Objects:</span>
      <span id="obj-count">0</span>
    </div>
    <div class="info-line">
      <span>FPS:</span>
      <span id="fps">60</span>
    </div>
  </div>

  <div id="controls-panel">
    <strong>Controls:</strong> Drag to rotate • Scroll to zoom • Right-click + drag to pan
  </div>

  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js"
      }
    }
  </script>

  <script type="module">
    import * as THREE from 'three';

    // ═══════════════════════════════════════════════════════════════
    // SCENE DATA (EMBEDDED)
    // ═══════════════════════════════════════════════════════════════
    const SCENE_DATA = ${sceneData};

    // ═══════════════════════════════════════════════════════════════
    // RENDERER SETUP
    // ═══════════════════════════════════════════════════════════════
    const container = document.getElementById('canvas-container');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // ═══════════════════════════════════════════════════════════════
    // SCENE RECONSTRUCTION
    // ═══════════════════════════════════════════════════════════════
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_DATA.background);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 50;
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    key.shadow.bias = -0.0003;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
    fill.position.set(-5, 4, -6);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.15);
    rim.position.set(0, -5, 0);
    scene.add(rim);

    // ═══════════════════════════════════════════════════════════════
    // GEOMETRY FACTORIES
    // ═══════════════════════════════════════════════════════════════
    function createGeometry(type, params) {
      switch (type) {
        case 'box':
          return new THREE.BoxGeometry(params.width, params.height, params.depth);
        case 'sphere':
          return new THREE.SphereGeometry(params.radius, params.widthSegments, params.heightSegments);
        case 'cylinder':
          return new THREE.CylinderGeometry(
            params.radiusTop, params.radiusBottom, params.height, params.radialSegments
          );
        case 'plane':
          return new THREE.PlaneGeometry(params.width, params.height);
        default:
          return new THREE.BoxGeometry(1, 1, 1);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MATERIAL CREATION
    // ═══════════════════════════════════════════════════════════════
    function createMaterial(matData) {
      if (!matData) {
        return new THREE.MeshStandardMaterial({ color: 0x909090 });
      }

      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(matData.color || '#909090'),
        roughness: matData.roughness !== undefined ? matData.roughness : 0.5,
        metalness: matData.metalness !== undefined ? matData.metalness : 0,
        transparent: matData.transparent || false,
        opacity: matData.opacity !== undefined ? matData.opacity : 1.0,
        side: THREE.FrontSide
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // LOAD SCENE OBJECTS
    // ═══════════════════════════════════════════════════════════════
    const loadedMeshes = [];

    SCENE_DATA.objects.forEach(objData => {
      const geometry = createGeometry(objData.type, objData.geometryParams);
      const material = createMaterial(objData.material);
      const mesh = new THREE.Mesh(geometry, material);

      // Apply transforms
      mesh.position.fromArray(objData.position);
      mesh.rotation.fromArray(objData.rotation);
      mesh.scale.fromArray(objData.scale);

      // Setup shadows
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = objData.name;
      mesh.userData = { ...objData };

      scene.add(mesh);
      loadedMeshes.push(mesh);
    });

    // Update object count
    document.getElementById('obj-count').textContent = loadedMeshes.length;

    // ═══════════════════════════════════════════════════════════════
    // CAMERA SETUP
    // ═══════════════════════════════════════════════════════════════
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(4, 4, 5);
    camera.lookAt(0, 0, 0);

    // ═══════════════════════════════════════════════════════════════
    // INTERACTION SYSTEM
    // ═══════════════════════════════════════════════════════════════
    const controls = {
      isDragging: false,
      isRotating: false,
      isPanning: false,
      startX: 0,
      startY: 0,
      deltaX: 0,
      deltaY: 0,
      rotationSpeed: 0.005,
      panSpeed: 0.01,
      zoomSpeed: 5
    };

    canvas.addEventListener('mousedown', (e) => {
      controls.isDragging = true;
      controls.startX = e.clientX;
      controls.startY = e.clientY;
      controls.isRotating = e.button === 0; // Left click = rotate
      controls.isPanning = e.button === 2;   // Right click = pan
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!controls.isDragging) return;

      controls.deltaX = e.clientX - controls.startX;
      controls.deltaY = e.clientY - controls.startY;

      if (controls.isRotating) {
        const qx = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          controls.deltaX * controls.rotationSpeed
        );
        const qy = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          controls.deltaY * controls.rotationSpeed
        );
        camera.quaternion.multiplyQuaternions(qx, camera.quaternion);
        camera.quaternion.multiplyQuaternions(camera.quaternion, qy);
      }

      if (controls.isPanning) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
        const up = camera.up;

        camera.position.addScaledVector(right, -controls.deltaX * controls.panSpeed);
        camera.position.addScaledVector(up, controls.deltaY * controls.panSpeed);
      }

      controls.startX = e.clientX;
      controls.startY = e.clientY;
    });

    canvas.addEventListener('mouseup', () => {
      controls.isDragging = false;
      controls.isRotating = false;
      controls.isPanning = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const distance = e.deltaY > 0 ? controls.zoomSpeed : -controls.zoomSpeed;
      camera.position.addScaledVector(direction, distance);
    });

    // ═══════════════════════════════════════════════════════════════
    // RESIZE HANDLER
    // ═══════════════════════════════════════════════════════════════
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ═══════════════════════════════════════════════════════════════
    // RENDER LOOP + FPS COUNTER
    // ═══════════════════════════════════════════════════════════════
    let frameCount = 0;
    let lastTime = performance.now();
    const fpsElement = document.getElementById('fps');
    const loadingDiv = document.querySelector('.loading');

    function animate(time) {
      requestAnimationFrame(animate);

      // FPS counter
      frameCount++;
      const elapsed = time - lastTime;
      if (elapsed >= 1000) {
        fpsElement.textContent = frameCount;
        frameCount = 0;
        lastTime = time;
      }

      // Hide loading screen on first frame
      if (loadingDiv && loadingDiv.style.display !== 'none') {
        loadingDiv.style.display = 'none';
      }

      scene.updateMatrixWorld();
      renderer.render(scene, camera);
    }

    animate(performance.now());
  </script>
</body>
</html>`;
  }

  /**
   * Export scene as interactive HTML and trigger download.
   * @param {string} filename - output filename (without .html)
   * @returns {{ success: boolean, message: string }}
   */
  export(filename = 'scene-export') {
    const objects = this.objs.list();

    if (objects.length === 0) {
      return { success: false, message: 'Scene is empty. Add objects before exporting.' };
    }

    try {
      const title = filename.replace(/[^a-z0-9]/gi, '-').substring(0, 50);
      const html = this._generateHTML(title);

      // Trigger browser download
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.toLowerCase().endsWith('.html') ? filename : filename + '.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const kb = (blob.size / 1024).toFixed(1);
      return {
        success: true,
        message: `Exported "${link.download}" (${objects.length} object${objects.length !== 1 ? 's' : ''}, ${kb} KB)`
      };
    } catch (err) {
      console.error('[HTMLEmbeddedExporter] Error:', err);
      return { success: false, message: `Export failed: ${err.message}` };
    }
  }
}
