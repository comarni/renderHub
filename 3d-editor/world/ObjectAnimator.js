import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EventBus } from '../core/EventBus.js';

export class ObjectAnimator {
  constructor(scene, objectManager, materialManager, selectionManager, cameraManager) {
    this.scene = scene;
    this.objs = objectManager;
    this.mats = materialManager;
    this.sel = selectionManager;
    this.cam = cameraManager;

    this._effects = new Map();
    this._shaderBindings = new Map();
    this._timeline = null;
    this._timelineExecuted = new Set();
  }

  get presets() {
    return [
      'hover',
      'tremor',
      'shiver',
      'breathe',
      'reactive',
      'alive',
      'liquid',
      'magnetic',
      'glitch',
      'breathing-architecture',
      'clear',
    ];
  }

  get timelines() {
    return ['cinematic', 'portfolio', 'pulse', 'stop'];
  }

  update(delta, elapsed) {
    for (const [id, effect] of this._effects.entries()) {
      const record = this.objs.getById(id);
      if (!record?.mesh) {
        this._effects.delete(id);
        continue;
      }
      effect.update(record.mesh, delta, elapsed);
    }

    for (const [uuid, binding] of this._shaderBindings.entries()) {
      if (!binding.mesh?.parent) {
        this._shaderBindings.delete(uuid);
        continue;
      }
      binding.uniforms.uTime.value = elapsed;
    }

    if (this._timeline) {
      this._updateTimeline(elapsed);
    }
  }

  clear(records = null) {
    const targets = records?.length ? records : this.objs.list();
    targets.forEach(record => {
      this._effects.delete(record.id);
      record.mesh.position.copy(record.mesh.userData.animBasePosition || record.mesh.position);
      record.mesh.rotation.copy(record.mesh.userData.animBaseRotation || record.mesh.rotation);
      record.mesh.scale.copy(record.mesh.userData.animBaseScale || record.mesh.scale);
    });
    EventBus.emit('state:changed', { type: 'transform' });
    return { success: true, message: 'Animaciones limpiadas.' };
  }

  stopTimeline() {
    this._timeline = null;
    this._timelineExecuted.clear();
    return { success: true, message: 'Timeline detenida.' };
  }

  applyPresetToSelection(preset) {
    const records = this.sel.getAll();
    if (!records.length) {
      return { success: false, message: 'Selecciona uno o más objetos antes de animar.' };
    }
    return this.applyPresetToRecords(records, preset);
  }

  applyPresetToRecords(records, preset) {
    const key = this._normalizePreset(preset);
    if (!this.presets.includes(key)) {
      return { success: false, message: `Preset desconocido: "${preset}". Usa: ${this.presets.join(', ')}` };
    }
    if (key === 'clear') return this.clear(records);

    records.forEach((record, index) => {
      this._storeBaseTransform(record.mesh);
      this._effects.set(record.id, this._makeEffect(key, index));
      if (['reactive', 'alive', 'liquid', 'magnetic'].includes(key)) {
        this._applyReactiveShader(record.mesh, this._shaderOptionsForPreset(key));
      }
    });

    EventBus.emit('state:changed', { type: 'transform' });
    return {
      success: true,
      message: `✓ Preset "${key}" aplicado a ${records.length} objeto(s).`,
    };
  }

  createDemoPack(name = 'reactive') {
    const preset = String(name || 'reactive').toLowerCase();
    this.stopTimeline();
    this.clear();
    this.objs.reset();

    switch (preset) {
      case 'cinematic':
        return this._createCinematicPack();
      case 'portfolio':
        return this._createPortfolioPack();
      case 'reactive':
      default:
        return this._createReactivePack();
    }
  }

  startTimeline(name = 'cinematic') {
    const preset = String(name || 'cinematic').toLowerCase();
    if (preset === 'stop' || preset === 'clear') return this.stopTimeline();

    const builders = {
      cinematic: () => ({
        name: 'cinematic',
        duration: 9,
        loop: true,
        steps: [
          { at: 0.0, action: () => this._applyPresetIfFound('NeoPillar', 'reactive') },
          { at: 1.6, action: () => this._applyPresetIfFound('RibbonArc', 'liquid') },
          { at: 3.2, action: () => this._applyPresetIfFound('HaloActor.A', 'hover') },
          { at: 4.2, action: () => this._applyPresetIfFound('HaloActor.B', 'hover') },
          { at: 6.0, action: () => this._applyPresetIfFound('RibbonArc', 'glitch') },
          { at: 7.2, action: () => this._focusIfFound('NeoPillar') },
        ],
      }),
      portfolio: () => ({
        name: 'portfolio',
        duration: 10,
        loop: true,
        steps: [
          { at: 0.0, action: () => this._applyPresetIfFound('HeroCard', 'breathing-architecture') },
          { at: 1.5, action: () => this._applyPresetIfFound('FeatureBlob', 'liquid') },
          { at: 3.0, action: () => this._applyPresetIfFound('SignalArc', 'magnetic') },
          { at: 4.5, action: () => this._applyPresetIfFound('SoftPedestal', 'alive') },
          { at: 6.0, action: () => this._focusIfFound('HeroCard') },
          { at: 8.2, action: () => this._applyPresetIfFound('FeatureBlob', 'glitch') },
        ],
      }),
      pulse: () => ({
        name: 'pulse',
        duration: 6,
        loop: true,
        steps: [
          { at: 0.0, action: () => this.applyPresetToRecords(this.objs.list(), 'breathe') },
          { at: 2.0, action: () => this.applyPresetToRecords(this.objs.list(), 'alive') },
          { at: 4.0, action: () => this.applyPresetToRecords(this.objs.list(), 'reactive') },
        ],
      }),
    };

    const build = builders[preset];
    if (!build) {
      return { success: false, message: `Timeline desconocida: "${name}". Usa: ${this.timelines.join(', ')}` };
    }

    this._timeline = {
      ...build(),
      startedAt: null,
    };
    this._timelineExecuted.clear();
    return { success: true, message: `✓ Timeline "${preset}" iniciada.` };
  }

  _updateTimeline(elapsed) {
    if (!this._timeline) return;
    if (this._timeline.startedAt === null) this._timeline.startedAt = elapsed;

    const localTime = elapsed - this._timeline.startedAt;
    const progress = this._timeline.loop
      ? (localTime % this._timeline.duration)
      : Math.min(localTime, this._timeline.duration);

    if (this._timeline.loop && progress < 0.1 && this._timelineExecuted.size === this._timeline.steps.length) {
      this._timelineExecuted.clear();
    }

    this._timeline.steps.forEach((step, index) => {
      if (progress >= step.at && !this._timelineExecuted.has(index)) {
        step.action();
        this._timelineExecuted.add(index);
      }
    });

    if (!this._timeline.loop && localTime >= this._timeline.duration) {
      this.stopTimeline();
    }
  }

  _createReactivePack() {
    const hero = this._addRoundedMonolith('AuraCore', '#74d3ff', new THREE.Vector3(0, 1.15, 0), { x: 1.3, y: 1.3, z: 1.3 });
    const orb = this._addCapsule('SoftPulse', '#ff9f9f', new THREE.Vector3(-2.5, 1.1, 0.5), { radius: 0.45, length: 0.9 });
    const knot = this._addTorusKnot('SignalLoop', '#b6ff8a', new THREE.Vector3(2.5, 1.35, -0.35), 0.5, 0.18);
    const floor = this.objs.add('plane', 'SoftStage');
    floor.mesh.rotation.x = -Math.PI / 2;
    floor.mesh.position.set(0, -0.05, 0);
    floor.mesh.scale.set(7.5, 7.5, 1);
    this.mats.applyColor(floor.mesh, '#121722');
    this.mats.applyPreset(floor.mesh, 'matte');

    this.applyPresetToRecords([hero], 'alive');
    this.applyPresetToRecords([orb], 'breathe');
    this.applyPresetToRecords([knot], 'reactive');

    this.sel.selectByIds([hero.id, orb.id, knot.id], false);
    this.cam.focusOn(hero.mesh);

    return {
      success: true,
      message: '✓ Demo reactive creada: AuraCore, SoftPulse, SignalLoop.',
    };
  }

  _createCinematicPack() {
    const tower = this._addRoundedMonolith('NeoPillar', '#a18bff', new THREE.Vector3(0, 1.6, 0), { x: 1.0, y: 2.2, z: 1.0 });
    const twinA = this._addCapsule('HaloActor.A', '#8fffe4', new THREE.Vector3(-2.2, 1.25, 0), { radius: 0.42, length: 1.0 });
    const twinB = this._addCapsule('HaloActor.B', '#ffd59b', new THREE.Vector3(2.2, 1.25, 0), { radius: 0.42, length: 1.0 });
    const ribbon = this._addTorusKnot('RibbonArc', '#ff86c8', new THREE.Vector3(0, 2.6, -0.9), 0.75, 0.14);
    const floor = this.objs.add('plane', 'CinemaFloor');
    floor.mesh.rotation.x = -Math.PI / 2;
    floor.mesh.position.set(0, -0.05, 0);
    floor.mesh.scale.set(9, 9, 1);
    this.mats.applyColor(floor.mesh, '#0f1218');
    this.mats.applyPreset(floor.mesh, 'matte');

    this.applyPresetToRecords([tower], 'reactive');
    this.applyPresetToRecords([twinA], 'hover');
    this.applyPresetToRecords([twinB], 'hover');
    this.applyPresetToRecords([ribbon], 'alive');

    twinA.mesh.userData.animPhaseOffset = 0;
    twinB.mesh.userData.animPhaseOffset = Math.PI;

    this.sel.selectByIds([tower.id, twinA.id, twinB.id, ribbon.id], false);
    this.cam.focusOn(tower.mesh);
    this.startTimeline('cinematic');

    return {
      success: true,
      message: '✓ Demo cinematic creada con formas suaves y timeline base.',
    };
  }

  _createPortfolioPack() {
    const pedestal = this._addPedestal('SoftPedestal', '#1d2433', new THREE.Vector3(0, 0, 0), { radius: 1.15, height: 0.5 });
    const card = this._addRoundedCard('HeroCard', '#99d7ff', new THREE.Vector3(0, 1.1, 0), { width: 1.65, height: 2.15, depth: 0.14 });
    const blob = this._addBlob('FeatureBlob', '#ffa6d5', new THREE.Vector3(-2.25, 1.25, 0.45), 0.72);
    const arc = this._addArc('SignalArc', '#9effd7', new THREE.Vector3(2.4, 1.6, -0.15), { radius: 1.0, tube: 0.11 });
    const capsule = this._addCapsule('FocusCapsule', '#ffe0a3', new THREE.Vector3(0, 1.15, -1.85), { radius: 0.34, length: 1.1 });
    const floor = this.objs.add('plane', 'PortfolioFloor');
    floor.mesh.rotation.x = -Math.PI / 2;
    floor.mesh.position.set(0, -0.05, 0);
    floor.mesh.scale.set(10.5, 10.5, 1);
    this.mats.applyColor(floor.mesh, '#10151e');
    this.mats.applyPreset(floor.mesh, 'matte');

    this.applyPresetToRecords([card], 'breathing-architecture');
    this.applyPresetToRecords([blob], 'liquid');
    this.applyPresetToRecords([arc], 'magnetic');
    this.applyPresetToRecords([capsule], 'hover');
    this.applyPresetToRecords([pedestal], 'alive');

    this.sel.selectByIds([card.id, blob.id, arc.id, capsule.id], false);
    this.cam.focusOn(card.mesh);
    this.startTimeline('portfolio');

    return {
      success: true,
      message: '✓ Demo portfolio creada con card, blob, pedestal y arc premium.',
    };
  }

  _normalizePreset(preset) {
    const key = String(preset || '').toLowerCase();
    if (key === 'architecture' || key === 'breathing_architecture') return 'breathing-architecture';
    return key;
  }

  _shaderOptionsForPreset(key) {
    switch (key) {
      case 'liquid':
        return { amplitude: 0.16, frequency: 4.4, glowColor: '#7cf4ff', glowStrength: 0.95 };
      case 'magnetic':
        return { amplitude: 0.09, frequency: 2.1, glowColor: '#ffd166', glowStrength: 0.72 };
      case 'alive':
        return { amplitude: 0.08, frequency: 2.4, glowColor: '#85f4ff', glowStrength: 0.75 };
      case 'reactive':
      default:
        return { amplitude: 0.12, frequency: 3.4, glowColor: '#7f7bff', glowStrength: 1.1 };
    }
  }

  _makeEffect(preset, index) {
    switch (preset) {
      case 'hover':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            const phase = mesh.userData.animPhaseOffset ?? index * 0.8;
            mesh.position.y = p.y + Math.sin(elapsed * 1.8 + phase) * 0.18;
            mesh.rotation.z = r.z + Math.sin(elapsed * 1.1 + phase) * 0.06;
            mesh.rotation.x = r.x + Math.cos(elapsed * 0.9 + phase) * 0.04;
          },
        };
      case 'tremor':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            mesh.position.x = p.x + Math.sin(elapsed * 34.0 + index * 2.0) * 0.035;
            mesh.position.y = p.y + Math.cos(elapsed * 29.0 + index) * 0.018;
            mesh.rotation.z = r.z + Math.sin(elapsed * 28.0 + index) * 0.04;
            mesh.rotation.x = r.x + Math.cos(elapsed * 31.0 + index) * 0.03;
          },
        };
      case 'shiver':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            mesh.position.x = p.x + Math.sin(elapsed * 55.0 + index * 1.7) * 0.012;
            mesh.position.z = p.z + Math.cos(elapsed * 63.0 + index * 0.5) * 0.012;
            mesh.rotation.y = r.y + Math.sin(elapsed * 41.0 + index) * 0.022;
          },
        };
      case 'breathe':
        return {
          update: (mesh, delta, elapsed) => {
            const s = mesh.userData.animBaseScale;
            const p = mesh.userData.animBasePosition;
            const wave = 1.0 + Math.sin(elapsed * 1.9 + index * 0.7) * 0.08;
            mesh.scale.set(s.x * wave, s.y * (1.0 + (wave - 1.0) * 0.55), s.z * wave);
            mesh.position.y = p.y + Math.sin(elapsed * 1.9 + index * 0.7) * 0.06;
          },
        };
      case 'liquid':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            const s = mesh.userData.animBaseScale;
            const wave = Math.sin(elapsed * 2.2 + index * 0.7);
            const wave2 = Math.cos(elapsed * 1.3 + index * 1.3);
            mesh.position.y = p.y + wave * 0.16;
            mesh.rotation.x = r.x + wave2 * 0.12;
            mesh.rotation.z = r.z + wave * 0.1;
            mesh.scale.set(s.x * (1 + wave * 0.05), s.y * (1 + wave2 * 0.08), s.z * (1 + wave * 0.05));
          },
        };
      case 'magnetic':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            const radius = 0.16 + index * 0.02;
            mesh.position.x = p.x + Math.cos(elapsed * 1.4 + index) * radius;
            mesh.position.z = p.z + Math.sin(elapsed * 1.4 + index) * radius;
            mesh.position.y = p.y + Math.sin(elapsed * 2.1 + index * 0.4) * 0.09;
            mesh.rotation.y = r.y + elapsed * 0.4;
          },
        };
      case 'glitch':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            const s = mesh.userData.animBaseScale;
            const tick = Math.sin(elapsed * 24 + index * 11) > 0.6 ? 1 : 0;
            mesh.position.x = p.x + tick * (Math.sin(elapsed * 90 + index) * 0.04);
            mesh.position.y = p.y + Math.sin(elapsed * 4.5 + index) * 0.08;
            mesh.rotation.z = r.z + tick * 0.12;
            const pop = 1 + tick * 0.08;
            mesh.scale.set(s.x * pop, s.y * (1 + tick * 0.05), s.z * pop);
          },
        };
      case 'breathing-architecture':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const s = mesh.userData.animBaseScale;
            const wave = 1.0 + Math.sin(elapsed * 1.2 + index * 0.5) * 0.035;
            mesh.position.y = p.y + Math.sin(elapsed * 1.2 + index * 0.5) * 0.04;
            mesh.scale.set(s.x * wave, s.y * (1 + (wave - 1) * 1.8), s.z * wave);
          },
        };
      case 'reactive':
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            mesh.position.y = p.y + Math.sin(elapsed * 1.45 + index) * 0.11;
            mesh.rotation.y = r.y + elapsed * 0.25;
            mesh.rotation.x = r.x + Math.sin(elapsed * 0.8 + index) * 0.08;
          },
        };
      case 'alive':
      default:
        return {
          update: (mesh, delta, elapsed) => {
            const p = mesh.userData.animBasePosition;
            const r = mesh.userData.animBaseRotation;
            const s = mesh.userData.animBaseScale;
            const wave = Math.sin(elapsed * 1.6 + index * 0.75);
            const wobble = Math.cos(elapsed * 2.2 + index * 0.4);
            mesh.position.y = p.y + wave * 0.13;
            mesh.rotation.y = r.y + elapsed * 0.16;
            mesh.rotation.z = r.z + wobble * 0.08;
            mesh.scale.set(s.x * (1 + wave * 0.04), s.y * (1 + wobble * 0.05), s.z * (1 + wave * 0.04));
          },
        };
    }
  }

  _storeBaseTransform(mesh) {
    mesh.userData.animBasePosition = mesh.position.clone();
    mesh.userData.animBaseRotation = mesh.rotation.clone();
    mesh.userData.animBaseScale = mesh.scale.clone();
  }

  _applyReactiveShader(target, options = {}) {
    const amplitude = options.amplitude ?? 0.08;
    const frequency = options.frequency ?? 3.0;
    const glowColor = new THREE.Color(options.glowColor || '#85f4ff');
    const glowStrength = options.glowStrength ?? 0.8;

    target.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      if (!material || material.userData.motionShaderPatched) return;

      const uniforms = {
        uTime: { value: 0 },
        uWaveAmp: { value: amplitude },
        uWaveFreq: { value: frequency },
        uGlowColor: { value: glowColor },
        uGlowStrength: { value: glowStrength },
      };

      material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.uniforms.uWaveAmp = uniforms.uWaveAmp;
        shader.uniforms.uWaveFreq = uniforms.uWaveFreq;
        shader.uniforms.uGlowColor = uniforms.uGlowColor;
        shader.uniforms.uGlowStrength = uniforms.uGlowStrength;

        shader.vertexShader = `uniform float uTime;\nuniform float uWaveAmp;\nuniform float uWaveFreq;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          vec3 transformed = vec3(position);
          float waveA = sin((position.y + position.x * 0.65) * uWaveFreq + uTime * 2.0) * uWaveAmp;
          float waveB = cos((position.z + position.y * 0.45) * (uWaveFreq * 0.8) + uTime * 1.45) * (uWaveAmp * 0.55);
          transformed += normal * (waveA + waveB);
          `
        );

        shader.fragmentShader = `uniform float uTime;\nuniform vec3 uGlowColor;\nuniform float uGlowStrength;\n` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          float viewFresnel = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.2);
          float pulse = 0.45 + 0.55 * sin(uTime * 2.4);
          totalEmissiveRadiance += uGlowColor * (0.12 + viewFresnel * uGlowStrength * pulse);
          `
        );
      };

      material.userData.motionShaderPatched = true;
      material.customProgramCacheKey = () => `motion-shader-${amplitude}-${frequency}-${glowStrength}`;
      material.needsUpdate = true;
      this._shaderBindings.set(child.uuid, { mesh: child, uniforms });
    });
  }

  _findRecordByName(name) {
    return this.objs.list().find(record => record.name === name) || null;
  }

  _applyPresetIfFound(name, preset) {
    const record = this._findRecordByName(name);
    if (record) this.applyPresetToRecords([record], preset);
  }

  _focusIfFound(name) {
    const record = this._findRecordByName(name);
    if (record) this.cam.focusOn(record.mesh);
  }

  _addRoundedMonolith(name, color, position, size) {
    const group = new THREE.Group();
    const geo = new RoundedBoxGeometry(size.x, size.y, size.z, 8, 0.18);
    const mat = this.mats.createMaterial(color, 'glass');
    mat.transparent = true;
    mat.opacity = 0.82;
    mat.roughness = 0.16;
    mat.metalness = 0.14;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = size.y * 0.5;
    group.add(mesh);
    group.position.copy(position.clone().setY(0));
    return this.objs.addGroup(group, name, 'motion-demo');
  }

  _addRoundedCard(name, color, position, { width = 1.4, height = 1.9, depth = 0.14 } = {}) {
    const group = new THREE.Group();
    const geo = new RoundedBoxGeometry(width, height, depth, 10, 0.12);
    const mat = this.mats.createMaterial(color, 'glass');
    mat.transparent = true;
    mat.opacity = 0.88;
    mat.roughness = 0.1;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = height * 0.5;
    group.add(mesh);

    const accent = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.78, height * 0.10, depth * 0.45, 8, 0.05),
      this.mats.createMaterial('#ffffff', 'plastic')
    );
    accent.position.set(0, height * 0.76, depth * 0.32);
    group.add(accent);

    group.position.copy(position.clone().setY(0));
    return this.objs.addGroup(group, name, 'motion-demo');
  }

  _addCapsule(name, color, position, { radius = 0.4, length = 0.8 } = {}) {
    const group = new THREE.Group();
    const geo = new THREE.CapsuleGeometry(radius, length, 8, 18);
    const mat = this.mats.createMaterial(color, 'ceramic');
    mat.roughness = 0.22;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = radius + length * 0.5;
    group.add(mesh);
    group.position.copy(position.clone().setY(0));
    return this.objs.addGroup(group, name, 'motion-demo');
  }

  _addBlob(name, color, position, radius = 0.75) {
    const group = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(radius, 4);
    const pos = geo.attributes.position;
    const vec = new THREE.Vector3();
    for (let index = 0; index < pos.count; index++) {
      vec.fromBufferAttribute(pos, index);
      const noise = 1 + Math.sin(vec.x * 4.0) * 0.08 + Math.cos(vec.y * 5.0) * 0.05 + Math.sin(vec.z * 6.0) * 0.06;
      vec.multiplyScalar(noise);
      pos.setXYZ(index, vec.x, vec.y, vec.z);
    }
    geo.computeVertexNormals();

    const mat = this.mats.createMaterial(color, 'ceramic');
    mat.roughness = 0.16;
    mat.metalness = 0.08;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = radius + 0.1;
    group.add(mesh);
    group.position.copy(position.clone().setY(0));
    return this.objs.addGroup(group, name, 'motion-demo');
  }

  _addPedestal(name, color, position, { radius = 1.0, height = 0.45 } = {}) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.05, height, 28),
      this.mats.createMaterial(color, 'concrete')
    );
    body.position.y = height * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.92, radius * 0.96, height * 0.18, 28),
      this.mats.createMaterial('#2f3a4a', 'ceramic')
    );
    cap.position.y = height * 0.96;
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);

    group.position.copy(position.clone().setY(0));
    return this.objs.addGroup(group, name, 'motion-demo');
  }

  _addArc(name, color, position, { radius = 1.0, tube = 0.12 } = {}) {
    const group = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-radius, 0.1, 0),
      new THREE.Vector3(-radius * 0.5, radius * 0.9, 0),
      new THREE.Vector3(radius * 0.5, radius * 0.9, 0),
      new THREE.Vector3(radius, 0.1, 0),
    ]);
    const geo = new THREE.TubeGeometry(curve, 80, tube, 16, false);
    const mat = this.mats.createMaterial(color, 'metal');
    mat.roughness = 0.18;
    mat.metalness = 0.68;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    group.position.copy(position);
    return this.objs.addGroup(group, name, 'motion-demo');
  }

  _addTorusKnot(name, color, position, radius = 0.55, tube = 0.18) {
    const group = new THREE.Group();
    const geo = new THREE.TorusKnotGeometry(radius, tube, 180, 20, 2, 3);
    const mat = this.mats.createMaterial(color, 'metal');
    mat.roughness = 0.2;
    mat.metalness = 0.72;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = radius + tube + 0.2;
    group.add(mesh);
    group.position.copy(position.clone().setY(0));
    return this.objs.addGroup(group, name, 'motion-demo');
  }
}
