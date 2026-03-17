import * as THREE from 'three';

const DEFAULT_BG = 0x2b2b2b;

export class EnvironmentManager {
  constructor(scene, cameraManager, grid) {
    this.scene = scene;
    this.cam = cameraManager;
    this.grid = grid;

    this._root = new THREE.Group();
    this._root.name = '__environmentRoot';
    this.scene.add(this._root);

    this._updaters = [];
    this._waterState = null;

    this._ambient = this.scene.getObjectByName('__ambient') || null;
    this._key = this.scene.getObjectByName('__key') || null;
    this._fill = this.scene.getObjectByName('__fill') || null;
    this._rim = this.scene.getObjectByName('__rim') || null;

    this._preset = 'studio';
  }

  listPresets() {
    return ['studio', 'sky', 'meadow', 'ocean', 'space'];
  }

  applyPreset(name) {
    const preset = (name || '').toLowerCase();
    if (!this.listPresets().includes(preset)) {
      return { success: false, message: `Unknown environment: ${name}` };
    }

    this._clearEnvironment();

    switch (preset) {
      case 'studio':
        this._buildStudio();
        break;
      case 'sky':
        this._buildSky();
        break;
      case 'meadow':
        this._buildMeadow();
        break;
      case 'ocean':
        this._buildOcean();
        break;
      case 'space':
        this._buildSpace();
        break;
    }

    this._preset = preset;
    return { success: true, message: `Environment applied: ${preset}` };
  }

  generateFromPrompt(prompt) {
    const txt = (prompt || '').toLowerCase();
    if (!txt.trim()) return { success: false, message: 'Usage: environment prompt <text>' };

    const map = [
      { preset: 'space', tokens: ['space', 'galaxy', 'stars', 'nebula', 'planet'] },
      { preset: 'ocean', tokens: ['ocean', 'water', 'sea', 'wave', 'island'] },
      { preset: 'meadow', tokens: ['grass', 'forest', 'meadow', 'rocks', 'field'] },
      { preset: 'sky', tokens: ['sky', 'cloud', 'sunset', 'dawn', 'atmosphere'] },
    ];

    const scored = map.map((entry) => ({
      preset: entry.preset,
      score: entry.tokens.reduce((acc, token) => acc + (txt.includes(token) ? 1 : 0), 0),
    }));

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0]?.score > 0 ? scored[0].preset : 'sky';
    const result = this.applyPreset(best);
    if (!result.success) return result;

    return {
      success: true,
      message: `Prompt mapped to environment: ${best}`,
    };
  }

  update(delta, elapsed) {
    this._updaters.forEach((fn) => fn(delta, elapsed));
  }

  get currentPreset() {
    return this._preset;
  }

  _clearEnvironment() {
    this._updaters = [];
    this._waterState = null;

    this._root.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });

    this._root.clear();
    this.scene.background = new THREE.Color(DEFAULT_BG);
    this.scene.fog = null;

    if (this.grid) this.grid.setVisible(true);
    this._setLights({
      ambient: { color: 0xffffff, intensity: 0.5 },
      key: { color: 0xffffff, intensity: 1.5, pos: [6, 10, 6] },
      fill: { color: 0x8899ff, intensity: 0.4, pos: [-5, 4, -6] },
      rim: { color: 0xffffff, intensity: 0.15, pos: [0, -5, 0] },
    });
  }

  _setLights(config) {
    if (this._ambient) {
      this._ambient.color.setHex(config.ambient.color);
      this._ambient.intensity = config.ambient.intensity;
    }
    if (this._key) {
      this._key.color.setHex(config.key.color);
      this._key.intensity = config.key.intensity;
      this._key.position.set(...config.key.pos);
    }
    if (this._fill) {
      this._fill.color.setHex(config.fill.color);
      this._fill.intensity = config.fill.intensity;
      this._fill.position.set(...config.fill.pos);
    }
    if (this._rim) {
      this._rim.color.setHex(config.rim.color);
      this._rim.intensity = config.rim.intensity;
      this._rim.position.set(...config.rim.pos);
    }
  }

  _buildStudio() {
    if (this.grid) this.grid.setVisible(true);
  }

  _buildSky() {
    if (this.grid) this.grid.setVisible(false);

    this.scene.background = new THREE.Color(0x89b7ff);
    this.scene.fog = new THREE.Fog(0x9cc3ff, 50, 220);

    this._setLights({
      ambient: { color: 0xffffff, intensity: 0.7 },
      key: { color: 0xfff4d6, intensity: 1.4, pos: [15, 18, 6] },
      fill: { color: 0x9dc6ff, intensity: 0.45, pos: [-10, 8, -10] },
      rim: { color: 0xffffff, intensity: 0.12, pos: [0, -4, 0] },
    });

    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });
    for (let i = 0; i < 28; i++) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 2.8, 14, 12), cloudMat);
      cloud.position.set((Math.random() - 0.5) * 120, 14 + Math.random() * 20, (Math.random() - 0.5) * 120);
      cloud.scale.y *= 0.55;
      cloudGroup.add(cloud);
    }
    this._root.add(cloudGroup);

    this._updaters.push((delta) => {
      cloudGroup.position.x += delta * 0.55;
      if (cloudGroup.position.x > 18) cloudGroup.position.x = -18;
    });
  }

  _buildMeadow() {
    this._buildSky();

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(140, 72),
      new THREE.MeshStandardMaterial({ color: 0x4f8a48, roughness: 0.98, metalness: 0.01 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this._root.add(ground);

    const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x74716b, roughness: 0.95, metalness: 0.03 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 80);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 70;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -0.01;
      q.setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random()));
      s.setScalar(0.2 + Math.random() * 1.4);
      m.compose(new THREE.Vector3(x, y, z), q, s);
      rocks.setMatrixAt(i, m);
    }
    rocks.instanceMatrix.needsUpdate = true;
    this._root.add(rocks);
  }

  _buildOcean() {
    if (this.grid) this.grid.setVisible(false);

    this.scene.background = new THREE.Color(0x89d3ff);
    this.scene.fog = new THREE.Fog(0x9fe0ff, 40, 200);

    this._setLights({
      ambient: { color: 0xd8f0ff, intensity: 0.78 },
      key: { color: 0xfff0cc, intensity: 1.25, pos: [10, 16, 8] },
      fill: { color: 0x9fd8ff, intensity: 0.36, pos: [-9, 7, -12] },
      rim: { color: 0xffffff, intensity: 0.1, pos: [0, -4, 0] },
    });

    const waterGeo = new THREE.PlaneGeometry(240, 240, 140, 140);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2b8ecf,
      roughness: 0.2,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
    });

    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.2;
    this._root.add(water);

    const base = waterGeo.attributes.position.array.slice();
    this._waterState = { mesh: water, base };

    this._updaters.push((_, elapsed) => {
      const attr = this._waterState.mesh.geometry.attributes.position;
      const arr = attr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = baseValue(this._waterState.base, i);
        const z = baseValue(this._waterState.base, i + 2);
        arr[i + 1] = Math.sin(x * 0.07 + elapsed * 1.4) * 0.35 + Math.cos(z * 0.09 + elapsed * 1.1) * 0.24;
      }
      attr.needsUpdate = true;
      this._waterState.mesh.geometry.computeVertexNormals();
    });

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 10, 3.5, 20),
      new THREE.MeshStandardMaterial({ color: 0xa68c62, roughness: 0.95, metalness: 0.0 })
    );
    island.position.set(0, 1.1, 0);
    this._root.add(island);
  }

  _buildSpace() {
    if (this.grid) this.grid.setVisible(false);

    this.scene.background = new THREE.Color(0x070812);
    this.scene.fog = new THREE.Fog(0x070812, 90, 500);

    this._setLights({
      ambient: { color: 0x8fa2ff, intensity: 0.24 },
      key: { color: 0xbec9ff, intensity: 0.9, pos: [20, 8, 12] },
      fill: { color: 0x5967a8, intensity: 0.3, pos: [-12, 5, -10] },
      rim: { color: 0xe8ecff, intensity: 0.1, pos: [0, -3, 0] },
    });

    const starCount = 2200;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 100 + Math.random() * 260;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = radius * Math.cos(phi);
      starPos[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd8dcff, size: 0.6, sizeAttenuation: true });
    const stars = new THREE.Points(starGeo, starMat);
    this._root.add(stars);

    const asteroidGeo = new THREE.DodecahedronGeometry(0.8, 0);
    const asteroidMat = new THREE.MeshStandardMaterial({ color: 0x6c7288, roughness: 0.95, metalness: 0.08 });
    const belt = new THREE.InstancedMesh(asteroidGeo, asteroidMat, 120);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();

    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 28;
      const x = Math.cos(angle) * radius;
      const y = (Math.random() - 0.5) * 5;
      const z = Math.sin(angle) * radius;
      q.setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random()));
      s.setScalar(0.2 + Math.random() * 1.7);
      m.compose(new THREE.Vector3(x, y, z), q, s);
      belt.setMatrixAt(i, m);
    }
    belt.instanceMatrix.needsUpdate = true;
    this._root.add(belt);

    this._updaters.push((delta) => {
      stars.rotation.y += delta * 0.01;
      belt.rotation.y += delta * 0.07;
      belt.rotation.x += delta * 0.015;
    });
  }
}

function baseValue(arr, idx) {
  return arr[idx] || 0;
}
