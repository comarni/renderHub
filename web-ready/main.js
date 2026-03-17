import * as THREE from 'three';

const FACES = [
  { key: 'inicio', label: 'Inicio', euler: [0, 0, 0], hash: '#inicio' },
  { key: 'proyectos', label: 'Proyectos', euler: [0, -Math.PI / 2, 0], hash: '#proyectos' },
  { key: 'habilidades', label: 'Habilidades', euler: [0, -Math.PI, 0], hash: '#habilidades' },
  { key: 'sobre-mi', label: 'Sobre mi', euler: [0, Math.PI / 2, 0], hash: '#sobre-mi' },
  { key: 'testimonios', label: 'Testimonios', euler: [-Math.PI / 2, 0, 0], hash: '#testimonios' },
  { key: 'contacto', label: 'Contacto', euler: [Math.PI / 2, 0, 0], hash: '#contacto' },
];

const canvas = document.getElementById('scene-canvas');
const wrap = document.getElementById('scene-wrap');
const fallback = document.getElementById('fallback');
const panels = new Map(FACES.map((f) => [f.key, document.querySelector(`[data-face="${f.key}"]`)]));

if (!webglAvailable()) {
  wrap.hidden = true;
  fallback.hidden = false;
} else {
  startScene();
}

function startScene() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 8.2);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 6, 4);
  const rim = new THREE.DirectionalLight(0x77aaff, 0.45);
  rim.position.set(-4, -2, -6);
  scene.add(ambient, key, rim);

  const cubeRoot = new THREE.Group();
  scene.add(cubeRoot);

  const geom = new THREE.BoxGeometry(4.8, 4.8, 4.8);
  const mats = [
    makeFaceMat(0x89b8ff),
    makeFaceMat(0x6a95ea),
    makeFaceMat(0x467bcf),
    makeFaceMat(0x5d8be0),
    makeFaceMat(0x80abf5),
    makeFaceMat(0x355ea8),
  ];
  const cube = new THREE.Mesh(geom, mats);
  scene.add(cube);

  const state = {
    faceIndex: 0,
    targetQ: new THREE.Quaternion(),
    isDragging: false,
    dragStart: { x: 0, y: 0 },
  };
  setFace(0, true);

  canvas.addEventListener('pointerdown', (e) => {
    state.isDragging = true;
    state.dragStart.x = e.clientX;
    state.dragStart.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!state.isDragging) return;
    state.isDragging = false;

    const dx = e.clientX - state.dragStart.x;
    const dy = e.clientY - state.dragStart.y;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 24) return;

    if (absX > absY) {
      rotateBy(dx < 0 ? +1 : -1, 0);
    } else {
      rotateBy(0, dy < 0 ? +1 : -1);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') rotateBy(-1, 0);
    if (e.key === 'ArrowRight') rotateBy(+1, 0);
    if (e.key === 'ArrowUp') rotateBy(0, +1);
    if (e.key === 'ArrowDown') rotateBy(0, -1);
  });

  window.addEventListener('hashchange', () => {
    const idx = FACES.findIndex((f) => f.hash === location.hash);
    if (idx >= 0) setFace(idx);
  });

  window.addEventListener('resize', onResize);
  onResize();

  const clock = new THREE.Clock();
  loop();

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    cube.quaternion.slerp(state.targetQ, Math.min(1, dt * 5.8));

    renderer.render(scene, camera);
  }

  function rotateBy(dxFaces, dyFaces) {
    if (dyFaces !== 0) {
      const top = dyFaces > 0 ? 'testimonios' : 'contacto';
      const idx = FACES.findIndex((f) => f.key === top);
      setFace(idx);
      return;
    }

    let next = state.faceIndex + dxFaces;
    if (next < 0) next = FACES.length - 1;
    if (next >= FACES.length) next = 0;
    setFace(next);
  }

  function setFace(index, immediate = false) {
    state.faceIndex = index;

    const face = FACES[index];
    const e = new THREE.Euler(face.euler[0], face.euler[1], face.euler[2], 'YXZ');
    state.targetQ.setFromEuler(e);

    if (immediate) cube.quaternion.copy(state.targetQ);

    const label = document.getElementById('active-face-label');
    const count = document.getElementById('active-face-index');
    label.textContent = face.label;
    count.textContent = `${index + 1} / ${FACES.length}`;

    panels.forEach((el, key) => {
      if (!el) return;
      el.classList.toggle('active', key === face.key);
    });

    history.replaceState(null, '', face.hash);
  }

  function onResize() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function makeFaceMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.04,
    emissive: 0x0b1020,
    emissiveIntensity: 0.12,
  });
}

function webglAvailable() {
  try {
    const test = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (test.getContext('webgl') || test.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}
