import * as THREE from 'three';
import { ProceduralGenerator } from '../ai/ProceduralGenerator.js';

const SCENARIO_ALIASES = {
  city: 'cityTraffic',
  ciudad: 'cityTraffic',
  metropolis: 'cityTraffic',
  metropoli: 'cityTraffic',
  urbano: 'cityTraffic',
  urban: 'cityTraffic',
  traffic: 'cityTraffic',
  trafico: 'cityTraffic',
  airplane: 'airplaneSky',
  avion: 'airplaneSky',
  aviones: 'airplaneSky',
  airport: 'airplaneSky',
  aeropuerto: 'airplaneSky',
  boat: 'harborBoat',
  barco: 'harborBoat',
  ship: 'harborBoat',
  harbor: 'harborBoat',
  harbour: 'harborBoat',
  puerto: 'harborBoat',
  forest: 'forestWildlife',
  bosque: 'forestWildlife',
  nature: 'forestWildlife',
  naturaleza: 'forestWildlife',
  factory: 'robotFactory',
  fabrica: 'robotFactory',
  robots: 'robotFactory',
  industrial: 'robotFactory',
  shuffle: 'shuffle',
  aleatorio: 'shuffle',
  random: 'shuffle',
};

const SCENARIO_DESCRIPTIONS = {
  cityTraffic: 'Ciudad densa con avenidas, coches en movimiento, edificios, peatones y nubes.',
  airplaneSky: 'Escena aérea con aviones volando, pista, torre de control, hangares y tráfico visual en el cielo.',
  harborBoat: 'Puerto activo con barcos navegando, muelles, boyas, almacenes y vida costera.',
  forestWildlife: 'Bosque amplio con masas de árboles, animales, cabañas y atmósfera natural dinámica.',
  robotFactory: 'Entorno industrial con robots, líneas de trabajo, torres, vehículos utilitarios y ritmo mecánico.',
};

const RANDOM_ARRAY = (items) => items[Math.floor(Math.random() * items.length)];

export class ScenarioDirector {
  constructor(objectManager, materialManager, selectionManager, environmentManager, cameraManager) {
    this.objs = objectManager;
    this.mats = materialManager;
    this.sel = selectionManager;
    this.environment = environmentManager;
    this.camera = cameraManager;
    this.generator = new ProceduralGenerator();
    this._motions = [];
    this._currentScenario = null;
  }

  get supportedScenarios() {
    return ['cityTraffic', 'airplaneSky', 'harborBoat', 'forestWildlife', 'robotFactory'];
  }

  resolveScenarioName(name) {
    if (!name) return null;
    return SCENARIO_ALIASES[String(name).toLowerCase()] || null;
  }

  clearAnimations() {
    this._motions = [];
    this._currentScenario = null;
  }

  update(delta, elapsed) {
    for (const motion of this._motions) {
      motion(delta, elapsed);
    }
  }

  createScenario(name, options = {}) {
    const requested = name || 'shuffle';
    const shuffle = Boolean(options.shuffle);
    const resolved = requested === 'shuffle'
      ? RANDOM_ARRAY(this.supportedScenarios)
      : (this.resolveScenarioName(requested) || requested);

    if (!this.supportedScenarios.includes(resolved)) {
      return {
        success: false,
        message: `Escenario no reconocido: "${requested}". Usa: ${this.supportedScenarios.join(', ')}`,
      };
    }

    this.clearAnimations();
    this.objs.reset();

    const density = Math.max(1, Math.min(3, parseInt(options.density, 10) || (shuffle ? 2 : 1)));
    const palette = this._makePalette(resolved, shuffle);

    switch (resolved) {
      case 'cityTraffic':
        this._buildCityTraffic({ shuffle, density, palette });
        break;
      case 'airplaneSky':
        this._buildAirplaneSky({ shuffle, density, palette });
        break;
      case 'harborBoat':
        this._buildHarborBoat({ shuffle, density, palette });
        break;
      case 'forestWildlife':
        this._buildForestWildlife({ shuffle, density, palette });
        break;
      case 'robotFactory':
        this._buildRobotFactory({ shuffle, density, palette });
        break;
    }

    const objectsCreated = this.objs.list().length;
    this._currentScenario = resolved;

    const primary = this.objs.list()[0];
    if (primary) this.camera.focusOn(primary.mesh);

    return {
      success: true,
      message: [
        `✓ Escenario generado: ${resolved}`,
        `Descripción: ${SCENARIO_DESCRIPTIONS[resolved]}`,
        `Objetos creados: ${objectsCreated}`,
        `Animaciones activas: ${this._motions.length}`,
        `Modo shuffle: ${shuffle ? 'sí' : 'no'}`,
      ].join('\n'),
    };
  }

  _makePalette(scenario, shuffle) {
    const base = {
      cityTraffic: {
        building: ['#5d6673', '#737d8c', '#46505b', '#8a96a8'],
        car: ['#ff5d5d', '#ffd166', '#06d6a0', '#4cc9f0', '#ef476f'],
        accent: '#8fd3ff',
      },
      airplaneSky: {
        building: ['#c9d2e3', '#aab7c7', '#d9dee8'],
        car: ['#ff7b7b', '#6ee7ff', '#fff2a8'],
        accent: '#8ed8ff',
      },
      harborBoat: {
        building: ['#c0b29b', '#9d8f7a', '#d2c2a8'],
        car: ['#3fa7d6', '#f4a261', '#e76f51'],
        accent: '#65d6ff',
      },
      forestWildlife: {
        building: ['#8b6f47', '#6d5334', '#b58c59'],
        car: ['#7ccf5b', '#4d9d44', '#d9c27d'],
        accent: '#b9f27c',
      },
      robotFactory: {
        building: ['#4d5563', '#687180', '#8e99a8'],
        car: ['#ff7a59', '#59d7ff', '#ffc857'],
        accent: '#69f0ff',
      },
    }[scenario];

    if (!shuffle) return base;

    return {
      building: [...base.building].sort(() => Math.random() - 0.5),
      car: [...base.car].sort(() => Math.random() - 0.5),
      accent: RANDOM_ARRAY(['#8fd3ff', '#ff8fab', '#b8f2e6', '#ffe66d', '#cdb4db']),
    };
  }

  _applyEnvironment(preset, shufflePool = []) {
    const envName = shufflePool.length ? RANDOM_ARRAY(shufflePool) : preset;
    this.environment.applyPreset(envName);
  }

  _addGenerated(type, options = {}) {
    const group = this.generator.generate(type, {
      color: options.color,
      scale: options.scale,
    });
    if (options.position) {
      group.position.copy(options.position);
    }
    if (options.rotationY !== undefined) {
      group.rotation.y = options.rotationY;
    }
    if (options.rotationX !== undefined) {
      group.rotation.x = options.rotationX;
    }
    if (options.rotationZ !== undefined) {
      group.rotation.z = options.rotationZ;
    }
    return this.objs.addGroup(group, options.name || this.objs._generateName(type), type);
  }

  _addPrimitive(type, options = {}) {
    const record = this.objs.add(type, options.name || null);
    if (options.position) record.mesh.position.copy(options.position);
    if (options.scale) record.mesh.scale.copy(options.scale);
    if (options.rotationX !== undefined) record.mesh.rotation.x = options.rotationX;
    if (options.rotationY !== undefined) record.mesh.rotation.y = options.rotationY;
    if (options.rotationZ !== undefined) record.mesh.rotation.z = options.rotationZ;
    if (options.color) this.mats.applyColor(record.mesh, options.color);
    if (options.preset) this.mats.applyPreset(record.mesh, options.preset);
    if (options.roughness !== undefined) this.mats.setRoughness(record.mesh, options.roughness);
    if (options.metalness !== undefined) this.mats.setMetalness(record.mesh, options.metalness);
    return record;
  }

  _createRoadSegment(position, scale, rotationZ = 0) {
    return this._addPrimitive('plane', {
      position,
      scale,
      rotationX: -Math.PI / 2,
      rotationZ,
      color: '#262b33',
      preset: 'matte',
      roughness: 0.95,
      metalness: 0.02,
    });
  }

  _createCloudMotion(record, speed = 0.4, span = 70) {
    const startX = record.mesh.position.x;
    const baseY = record.mesh.position.y;
    const baseZ = record.mesh.position.z;
    this._motions.push((delta, elapsed) => {
      record.mesh.position.x += delta * speed;
      record.mesh.position.y = baseY + Math.sin(elapsed * 0.35 + startX) * 0.15;
      if (record.mesh.position.x > span) record.mesh.position.x = -span;
      record.mesh.position.z = baseZ + Math.sin(elapsed * 0.18 + startX * 0.1) * 1.5;
    });
  }

  _buildCityTraffic({ shuffle, density, palette }) {
    this._applyEnvironment('sky', shuffle ? ['sky', 'studio'] : []);

    this._addPrimitive('plane', {
      name: 'CityGround',
      position: new THREE.Vector3(0, -0.02, 0),
      scale: new THREE.Vector3(35, 35, 1),
      rotationX: -Math.PI / 2,
      color: '#41464d',
      preset: 'concrete',
      roughness: 0.98,
      metalness: 0.02,
    });

    this._createRoadSegment(new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(20, 3.4, 1));
    this._createRoadSegment(new THREE.Vector3(0, 0.011, 0), new THREE.Vector3(3.6, 20, 1));
    this._createRoadSegment(new THREE.Vector3(11.5, 0.012, 0), new THREE.Vector3(10, 2.2, 1));
    this._createRoadSegment(new THREE.Vector3(-11.5, 0.012, 0), new THREE.Vector3(10, 2.2, 1));

    const buildingCount = 24 + density * 8;
    for (let i = 0; i < buildingCount; i++) {
      const side = i % 4;
      const lane = Math.floor(i / 4);
      const offset = -18 + lane * 4.2;
      const height = 1.6 + Math.random() * (2.4 + density * 0.6);
      const position = new THREE.Vector3(
        side === 0 ? -14 : side === 1 ? 14 : offset,
        0,
        side === 2 ? -14 : side === 3 ? 14 : offset
      );
      const record = this._addGenerated('building', {
        color: RANDOM_ARRAY(palette.building),
        scale: 0.9 + Math.random() * 0.6,
        position,
        rotationY: (Math.PI / 2) * side,
      });
      record.mesh.scale.y *= height;
    }

    const streetlightCount = 16 + density * 4;
    for (let i = 0; i < streetlightCount; i++) {
      const alongX = i % 2 === 0;
      const distance = -16 + i * (32 / streetlightCount);
      this._addGenerated('streetlight', {
        color: '#515760',
        position: new THREE.Vector3(alongX ? distance : 3.2, 0, alongX ? 3.2 : distance),
        rotationY: alongX ? 0 : Math.PI / 2,
        scale: 0.95 + Math.random() * 0.15,
      });
      this._addGenerated('streetlight', {
        color: '#515760',
        position: new THREE.Vector3(alongX ? distance : -3.2, 0, alongX ? -3.2 : distance),
        rotationY: alongX ? Math.PI : -Math.PI / 2,
        scale: 0.95 + Math.random() * 0.15,
      });
    }

    const treeCount = 12 + density * 6;
    for (let i = 0; i < treeCount; i++) {
      const ring = 16 + Math.random() * 8;
      const angle = (i / treeCount) * Math.PI * 2;
      this._addGenerated('tree', {
        color: RANDOM_ARRAY(['#4f9d44', '#5bbf4d', '#3f8740']),
        scale: 0.7 + Math.random() * 0.8,
        position: new THREE.Vector3(Math.cos(angle) * ring, 0, Math.sin(angle) * ring),
      });
    }

    const humanCount = 8 + density * 4;
    for (let i = 0; i < humanCount; i++) {
      const sidewalk = i % 2 === 0 ? 5.3 : -5.3;
      this._addGenerated('human', {
        scale: 0.75 + Math.random() * 0.18,
        position: new THREE.Vector3(-14 + Math.random() * 28, 0, sidewalk + (Math.random() - 0.5) * 0.6),
        rotationY: Math.random() * Math.PI * 2,
      });
    }

    const laneConfigs = [
      { axis: 'x', fixed: 1.2, min: -18, max: 18, dir: 1 },
      { axis: 'x', fixed: -1.2, min: -18, max: 18, dir: -1 },
      { axis: 'z', fixed: 1.2, min: -18, max: 18, dir: 1 },
      { axis: 'z', fixed: -1.2, min: -18, max: 18, dir: -1 },
    ];
    const carCount = 16 + density * 8;
    for (let i = 0; i < carCount; i++) {
      const lane = laneConfigs[i % laneConfigs.length];
      const start = lane.min + Math.random() * (lane.max - lane.min);
      const record = this._addGenerated('car', {
        color: RANDOM_ARRAY(palette.car),
        scale: 0.8 + Math.random() * 0.3,
        position: lane.axis === 'x'
          ? new THREE.Vector3(start, 0, lane.fixed)
          : new THREE.Vector3(lane.fixed, 0, start),
        rotationY: lane.axis === 'x' ? (lane.dir > 0 ? 0 : Math.PI) : (lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2),
      });
      const speed = 2.2 + Math.random() * 2.4;
      this._motions.push((delta) => {
        const pos = record.mesh.position;
        pos[lane.axis] += delta * speed * lane.dir;
        if (pos[lane.axis] > lane.max) pos[lane.axis] = lane.min;
        if (pos[lane.axis] < lane.min) pos[lane.axis] = lane.max;
      });
    }

    const cloudCount = 6 + density * 2;
    for (let i = 0; i < cloudCount; i++) {
      const record = this._addGenerated('cloud', {
        scale: 1.5 + Math.random() * 1.2,
        position: new THREE.Vector3(-24 + i * 8, 12 + Math.random() * 4, -20 + Math.random() * 40),
      });
      this._createCloudMotion(record, 0.5 + Math.random() * 0.25);
    }
  }

  _buildAirplaneSky({ shuffle, density, palette }) {
    this._applyEnvironment('sky', shuffle ? ['sky', 'space'] : []);

    this._addPrimitive('plane', {
      name: 'Runway',
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(4.5, 22, 1),
      rotationX: -Math.PI / 2,
      color: '#30343b',
      preset: 'concrete',
      roughness: 0.95,
    });

    for (let i = 0; i < 22 + density * 10; i++) {
      this._addGenerated('building', {
        color: RANDOM_ARRAY(palette.building),
        scale: 0.9 + Math.random() * 0.6,
        position: new THREE.Vector3(-18 + Math.random() * 36, 0, 16 + Math.random() * 10),
      });
    }

    for (let i = 0; i < 12 + density * 8; i++) {
      const record = this._addGenerated('cloud', {
        scale: 1.6 + Math.random() * 1.8,
        position: new THREE.Vector3(-25 + Math.random() * 50, 12 + Math.random() * 10, -30 + Math.random() * 60),
      });
      this._createCloudMotion(record, 0.35 + Math.random() * 0.25, 80);
    }

    for (let i = 0; i < 18 + density * 8; i++) {
      this._addGenerated('tree', {
        scale: 0.9 + Math.random() * 0.8,
        position: new THREE.Vector3(-20 + Math.random() * 40, 0, 10 + Math.random() * 18),
      });
    }

    for (let i = 0; i < 14 + density * 5; i++) {
      this._addGenerated('streetlight', {
        color: '#65707f',
        position: new THREE.Vector3(-16 + i * 2.1, 0, 9.5 + (i % 2 === 0 ? 0 : 3.2)),
        rotationY: i % 2 === 0 ? 0 : Math.PI,
        scale: 0.95 + Math.random() * 0.1,
      });
    }

    for (let i = 0; i < 12 + density * 6; i++) {
      const record = this._addGenerated('car', {
        color: RANDOM_ARRAY(palette.car),
        scale: 0.78 + Math.random() * 0.2,
        position: new THREE.Vector3(-18 + Math.random() * 36, 0, 3.6 + (i % 2 === 0 ? 0.8 : -0.8)),
        rotationY: i % 2 === 0 ? 0 : Math.PI,
      });
      const dir = i % 2 === 0 ? 1 : -1;
      const speed = 2 + Math.random() * 1.5;
      this._motions.push((delta) => {
        record.mesh.position.x += delta * speed * dir;
        if (record.mesh.position.x > 20) record.mesh.position.x = -20;
        if (record.mesh.position.x < -20) record.mesh.position.x = 20;
      });
    }

    const planeCount = 3 + density;
    for (let i = 0; i < planeCount; i++) {
      const radius = 16 + i * 5;
      const phase = i * 1.7;
      const record = this._addGenerated('airplane', {
        color: RANDOM_ARRAY(['#f6f7fb', '#ff6b6b', '#8ecae6', '#ffd166']),
        scale: 1 + Math.random() * 0.4,
        position: new THREE.Vector3(radius, 12 + i * 2.5, 0),
      });
      this._motions.push((_, elapsed) => {
        const t = elapsed * (0.28 + i * 0.03) + phase;
        const x = Math.cos(t) * radius;
        const z = Math.sin(t) * (radius * 0.55);
        const y = 12 + i * 2.5 + Math.sin(t * 2) * 1.4;
        record.mesh.position.set(x, y, z);
        record.mesh.rotation.y = -t + Math.PI / 2;
        record.mesh.rotation.z = Math.sin(t * 2) * 0.08;
      });
    }
  }

  _buildHarborBoat({ shuffle, density, palette }) {
    this._applyEnvironment('ocean', shuffle ? ['ocean', 'sky'] : []);

    for (let i = 0; i < 4; i++) {
      this._addPrimitive('box', {
        name: `Dock.${i + 1}`,
        position: new THREE.Vector3(-16 + i * 10.5, 0.4, 10),
        scale: new THREE.Vector3(5, 0.8, 2.2),
        color: '#8a6a48',
        preset: 'wood',
      });
    }

    for (let i = 0; i < 18 + density * 8; i++) {
      this._addGenerated('building', {
        color: RANDOM_ARRAY(palette.building),
        scale: 0.9 + Math.random() * 0.7,
        position: new THREE.Vector3(-20 + Math.random() * 40, 0, 18 + Math.random() * 14),
      });
    }

    for (let i = 0; i < 18 + density * 6; i++) {
      this._addPrimitive('box', {
        name: `Crate.${i + 1}`,
        position: new THREE.Vector3(-18 + Math.random() * 36, 0.45, 8 + Math.random() * 6),
        scale: new THREE.Vector3(0.8 + Math.random() * 0.8, 0.8 + Math.random() * 1.2, 0.8 + Math.random() * 0.8),
        color: RANDOM_ARRAY(['#b08968', '#ddb892', '#7f5539']),
        preset: 'wood',
      });
    }

    for (let i = 0; i < 8 + density * 4; i++) {
      const record = this._addGenerated('boat', {
        color: RANDOM_ARRAY(['#ff6b6b', '#ffd166', '#118ab2', '#f4a261']),
        scale: 0.9 + Math.random() * 0.5,
        position: new THREE.Vector3(-22 + Math.random() * 44, 0.2, -8 + Math.random() * 14),
        rotationY: Math.random() * Math.PI * 2,
      });
      const phase = Math.random() * Math.PI * 2;
      const amplitude = 8 + Math.random() * 12;
      const baseZ = -10 + Math.random() * 14;
      const baseY = 0.2 + Math.random() * 0.3;
      this._motions.push((_, elapsed) => {
        const t = elapsed * (0.18 + Math.random() * 0.03) + phase;
        record.mesh.position.x = Math.sin(t) * amplitude;
        record.mesh.position.z = baseZ + Math.cos(t * 0.6) * 4.5;
        record.mesh.position.y = baseY + Math.sin(t * 2.2) * 0.22;
        record.mesh.rotation.y = -Math.cos(t) * 0.35;
        record.mesh.rotation.z = Math.sin(t * 1.8) * 0.06;
      });
    }

    for (let i = 0; i < 10 + density * 2; i++) {
      const buoy = this._addPrimitive('cylinder', {
        name: `Buoy.${i + 1}`,
        position: new THREE.Vector3(-18 + Math.random() * 36, 0.4, -16 + Math.random() * 10),
        scale: new THREE.Vector3(0.25, 0.8, 0.25),
        color: RANDOM_ARRAY(['#ff3b30', '#ffcc00', '#ffffff']),
        preset: 'plastic',
      });
      const baseY = buoy.mesh.position.y;
      const phase = Math.random() * Math.PI * 2;
      this._motions.push((_, elapsed) => {
        buoy.mesh.position.y = baseY + Math.sin(elapsed * 1.7 + phase) * 0.18;
      });
    }

    for (let i = 0; i < 14 + density * 5; i++) {
      const record = this._addGenerated('cloud', {
        scale: 1.4 + Math.random() * 1.4,
        position: new THREE.Vector3(-26 + Math.random() * 52, 13 + Math.random() * 6, -24 + Math.random() * 50),
      });
      this._createCloudMotion(record, 0.3 + Math.random() * 0.2, 90);
    }

    for (let i = 0; i < 12 + density * 4; i++) {
      this._addGenerated('tree', {
        scale: 0.85 + Math.random() * 0.7,
        position: new THREE.Vector3(-24 + Math.random() * 48, 0, 18 + Math.random() * 14),
      });
    }

    for (let i = 0; i < 8 + density * 4; i++) {
      this._addGenerated('human', {
        scale: 0.8 + Math.random() * 0.2,
        position: new THREE.Vector3(-18 + Math.random() * 36, 0, 9 + Math.random() * 8),
        rotationY: Math.random() * Math.PI * 2,
      });
    }
  }

  _buildForestWildlife({ shuffle, density, palette }) {
    this._applyEnvironment('meadow', shuffle ? ['meadow', 'sky'] : []);

    for (let i = 0; i < 60 + density * 18; i++) {
      const radius = 8 + Math.random() * 28;
      const angle = Math.random() * Math.PI * 2;
      this._addGenerated('tree', {
        color: RANDOM_ARRAY(['#4f8f39', '#5fa14a', '#6cbf52', '#3b7b33']),
        scale: 0.8 + Math.random() * 1.3,
        position: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
      });
    }

    for (let i = 0; i < 8 + density * 2; i++) {
      this._addGenerated('house', {
        color: RANDOM_ARRAY(palette.building),
        scale: 0.9 + Math.random() * 0.5,
        position: new THREE.Vector3(-16 + Math.random() * 32, 0, -8 + Math.random() * 18),
      });
    }

    const animalTypes = ['dog', 'cat', 'human'];
    for (let i = 0; i < 14 + density * 4; i++) {
      const type = animalTypes[i % animalTypes.length];
      const radius = 5 + Math.random() * 18;
      const angle = Math.random() * Math.PI * 2;
      const record = this._addGenerated(type, {
        scale: 0.8 + Math.random() * 0.5,
        position: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        rotationY: Math.random() * Math.PI * 2,
      });
      const baseX = record.mesh.position.x;
      const baseZ = record.mesh.position.z;
      const phase = Math.random() * Math.PI * 2;
      this._motions.push((_, elapsed) => {
        record.mesh.position.x = baseX + Math.sin(elapsed * 0.4 + phase) * 0.6;
        record.mesh.position.z = baseZ + Math.cos(elapsed * 0.35 + phase) * 0.6;
        record.mesh.rotation.y += 0.002;
      });
    }

    for (let i = 0; i < 8 + density * 3; i++) {
      const record = this._addGenerated('cloud', {
        scale: 1.2 + Math.random() * 1.1,
        position: new THREE.Vector3(-24 + Math.random() * 48, 12 + Math.random() * 5, -24 + Math.random() * 48),
      });
      this._createCloudMotion(record, 0.25 + Math.random() * 0.16, 80);
    }
  }

  _buildRobotFactory({ shuffle, density, palette }) {
    this._applyEnvironment('space', shuffle ? ['space', 'studio'] : []);

    this._addPrimitive('plane', {
      name: 'FactoryFloor',
      position: new THREE.Vector3(0, -0.01, 0),
      scale: new THREE.Vector3(34, 34, 1),
      rotationX: -Math.PI / 2,
      color: '#1d2129',
      preset: 'carbon',
      roughness: 0.82,
      metalness: 0.18,
    });

    for (let i = 0; i < 26 + density * 10; i++) {
      this._addGenerated('building', {
        color: RANDOM_ARRAY(palette.building),
        scale: 0.8 + Math.random() * 0.7,
        position: new THREE.Vector3(-16 + Math.random() * 32, 0, -16 + Math.random() * 32),
      });
    }

    for (let i = 0; i < 36 + density * 14; i++) {
      const record = this._addGenerated('robot', {
        scale: 0.85 + Math.random() * 0.35,
        position: new THREE.Vector3(-14 + Math.random() * 28, 0, -14 + Math.random() * 28),
        rotationY: Math.random() * Math.PI * 2,
      });
      const baseY = record.mesh.position.y;
      const phase = Math.random() * Math.PI * 2;
      this._motions.push((_, elapsed) => {
        record.mesh.position.y = baseY + Math.sin(elapsed * 2 + phase) * 0.08;
        record.mesh.rotation.y += 0.008;
      });
    }

    for (let i = 0; i < 16 + density * 6; i++) {
      const laneZ = -12 + i * 3;
      const record = this._addGenerated('car', {
        color: RANDOM_ARRAY(palette.car),
        scale: 0.75 + Math.random() * 0.2,
        position: new THREE.Vector3(-16 + Math.random() * 32, 0, -15 + (i % 10) * 3),
        rotationY: 0,
      });
      const speed = 2.5 + Math.random() * 2;
      this._motions.push((delta) => {
        record.mesh.position.x += delta * speed;
        if (record.mesh.position.x > 18) record.mesh.position.x = -18;
      });
    }

    for (let i = 0; i < 18 + density * 6; i++) {
      this._addGenerated('streetlight', {
        color: '#707b8c',
        position: new THREE.Vector3(-15 + i * 2.6, 0, -16 + (i % 2 === 0 ? 1.8 : 30.2)),
        scale: 1,
      });
    }
  }
}
