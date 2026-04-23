import * as THREE from 'three';

const NOTE_KEYS = {
  'A': 0, 'W': 1, 'S': 2, 'E': 3, 'D': 4,
  'F': 5, 'T': 6, 'G': 7, 'Y': 8, 'H': 9, 'U': 10, 'J': 11
};

const NOTE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

let scene;
let camera;
let renderer;
let animationId;
let galaxyRoot;
let galaxyPoints;
let stars;
let noteLayer;
let trailLayer;
let coreGlow;
let noteAnchors = [];
let mouseX = 0;
let mouseY = 0;

function makeParticleTexture(size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.82)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function makeTextTexture(text, color = '#e0f2fe') {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '800 34px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return new THREE.CanvasTexture(canvas);
}

function makeGalaxyGeometry({ count = 90000, radius = 13, branches = 3, spin = 1.04, randomness = 0.72 }) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const colorInside = new THREE.Color('#f7d794');
  const colorOutside = new THREE.Color('#575fcf');
  const colorPink = new THREE.Color('#ec4899');
  const colorViolet = new THREE.Color('#a855f7');
  const colorCyan = new THREE.Color('#67e8f9');

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = Math.pow(Math.random(), 1.36) * radius;
    const spinAngle = r * spin;
    const branchAngle = ((i % branches) / branches) * Math.PI * 2;
    const randomPower = Math.pow(Math.random(), 2.25);
    const randomSign = Math.random() < 0.5 ? -1 : 1;
    const randomX = randomSign * randomPower * randomness * r * (0.75 + Math.random() * 0.75);
    const randomY = (Math.random() - 0.5) * randomness * r * 0.23;
    const randomZ = (Math.random() - 0.5) * randomness * r * 0.75;

    positions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ;

    const color = colorInside.clone().lerp(colorOutside, r / radius);
    if (Math.random() > 0.48) color.lerp(colorViolet, 0.18 + Math.random() * 0.38);
    if (Math.random() > 0.68) color.lerp(colorPink, 0.2 + Math.random() * 0.48);
    if (Math.random() > 0.86) color.lerp(colorCyan, 0.35 + Math.random() * 0.42);
    color.multiplyScalar(1.05 + (1 - r / radius) * 0.44);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function addPhotorealGalaxy() {
  galaxyRoot = new THREE.Group();
  galaxyRoot.rotation.x = 0.18;
  galaxyRoot.rotation.z = -0.06;
  scene.add(galaxyRoot);

  const particleTexture = makeParticleTexture();
  galaxyPoints = new THREE.Points(
    makeGalaxyGeometry({ count: 90000, radius: 13.4, branches: 3, spin: 1.03, randomness: 0.66 }),
    new THREE.PointsMaterial({
      size: 0.038,
      map: particleTexture,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      transparent: true,
      opacity: 1
    })
  );
  galaxyRoot.add(galaxyPoints);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeParticleTexture(192),
    color: new THREE.Color('#f7d794'),
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  glow.scale.set(7.5, 7.5, 1);
  coreGlow = glow;
  galaxyRoot.add(coreGlow);
}

function addBackgroundStars() {
  const count = 5200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const cool = new THREE.Color('#e0f2fe');
  const violet = new THREE.Color('#c4b5fd');
  const warm = new THREE.Color('#fde68a');

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const radius = 38 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi) * 0.6;
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = cool.clone();
    if (Math.random() > 0.66) color.lerp(violet, 0.6);
    if (Math.random() > 0.9) color.lerp(warm, 0.7);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.055,
    map: makeParticleTexture(),
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.76
  }));
  scene.add(stars);
}

function addNoteConstellation(rootNote, scaleType) {
  const allowedOffsets = scaleType === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const allowed = allowedOffsets.map(note => (note + rootNote) % 12);
  const glowTexture = makeParticleTexture(128);
  noteLayer = new THREE.Group();
  trailLayer = new THREE.Group();
  noteAnchors = [];

  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const arm = i % 3;
    const radius = 2.8 + t * 10.4;
    const angle = t * Math.PI * 6.15 + arm * (Math.PI * 2 / 3) + 0.4;
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      (Math.sin(i * 1.7) * 0.22),
      Math.sin(angle) * radius * 0.74
    );

    const isAllowed = allowed.includes(i);
    const hue = isAllowed ? '#67e8f9' : '#64748b';
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(hue),
      transparent: true,
      opacity: isAllowed ? 0.72 : 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    marker.scale.set(isAllowed ? 0.72 : 0.34, isAllowed ? 0.72 : 0.34, 1);
    marker.position.copy(position);
    noteLayer.add(marker);

    if (isAllowed) {
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeTextTexture(NOTE_NAMES[i], '#cffafe'),
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      label.position.copy(position.clone().add(new THREE.Vector3(0, 0.72, 0)));
      label.scale.set(1.3, 0.65, 1);
      noteLayer.add(label);
    }

    noteAnchors.push({ noteIndex: i, position, marker, isAllowed });
  }

  galaxyRoot.add(noteLayer);
  galaxyRoot.add(trailLayer);
}

export function initGalaxy(containerId, rootNote, scaleType) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (renderer) destroyGalaxy();

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0085);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 9.7, 16.4);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.52;
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '1';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.className = 'galaxy-three-bg';
  document.body.appendChild(renderer.domElement);

  addBackgroundStars();
  addPhotorealGalaxy();
  addNoteConstellation(rootNote, scaleType);

  window.addEventListener('keydown', handleGalaxyKeydown);
  document.addEventListener('mousemove', handleGalaxyMousemove);
  window.addEventListener('resize', onWindowResize);
  renderLoop();
}

function handleGalaxyMousemove(event) {
  mouseX = (event.clientX / window.innerWidth) - 0.5;
  mouseY = (event.clientY / window.innerHeight) - 0.5;
}

function handleGalaxyKeydown(event) {
  const key = event.key.toUpperCase();
  if (NOTE_KEYS[key] !== undefined && window.touchGalaxyPlanet) {
    window.touchGalaxyPlanet(NOTE_KEYS[key]);
    pulseNote(NOTE_KEYS[key]);
  }
}

function pulseNote(noteIndex) {
  const anchor = noteAnchors.find(note => note.noteIndex === noteIndex);
  if (!anchor) return;
  anchor.marker.scale.set(1.35, 1.35, 1);
  anchor.marker.material.opacity = 1;
}

function renderLoop() {
  animationId = requestAnimationFrame(renderLoop);

  if (galaxyRoot) {
    galaxyRoot.rotation.y += 0.0019;
    galaxyRoot.rotation.x += (0.18 + mouseY * 0.05 - galaxyRoot.rotation.x) * 0.035;
  }
  if (stars) stars.rotation.y += 0.00024;
  if (coreGlow) {
    const pulse = 1 + Math.sin(performance.now() * 0.0014) * 0.045;
    coreGlow.scale.set(7.5 * pulse, 7.5 * pulse, 1);
  }
  noteAnchors.forEach(anchor => {
    const base = anchor.isAllowed ? 0.72 : 0.18;
    anchor.marker.material.opacity += (base - anchor.marker.material.opacity) * 0.04;
    const targetSize = anchor.isAllowed ? 0.72 : 0.34;
    anchor.marker.scale.x += (targetSize - anchor.marker.scale.x) * 0.04;
    anchor.marker.scale.y += (targetSize - anchor.marker.scale.y) * 0.04;
  });

  camera.position.x += (mouseX * 3.6 - camera.position.x) * 0.045;
  camera.position.y += (9.7 + mouseY * 1.5 - camera.position.y) * 0.045;
  camera.position.z += (16.4 + mouseY * 1.8 - camera.position.z) * 0.045;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

export function drawCometTrails(melodyArray) {
  if (!trailLayer) return;
  while (trailLayer.children.length > 0) {
    const child = trailLayer.children[0];
    trailLayer.remove(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }

  const anchors = melodyArray
    .map(note => noteAnchors.find(anchor => anchor.noteIndex === note.noteIndex % 12))
    .filter(Boolean);

  anchors.forEach(anchor => pulseNote(anchor.noteIndex));
  if (anchors.length < 2) return;

  const points = anchors.map(anchor => anchor.position.clone());
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(120));
  const material = new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.86,
    blending: THREE.AdditiveBlending
  });
  const line = new THREE.Line(geometry, material);
  trailLayer.add(line);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

export function destroyGalaxy() {
  if (animationId) cancelAnimationFrame(animationId);
  window.removeEventListener('keydown', handleGalaxyKeydown);
  document.removeEventListener('mousemove', handleGalaxyMousemove);
  window.removeEventListener('resize', onWindowResize);

  if (scene) {
    scene.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
      else object.material?.dispose?.();
    });
  }

  if (renderer?.domElement && document.body.contains(renderer.domElement)) {
    document.body.removeChild(renderer.domElement);
  }
  renderer?.dispose?.();

  scene = null;
  camera = null;
  renderer = null;
  galaxyRoot = null;
  galaxyPoints = null;
  stars = null;
  noteLayer = null;
  trailLayer = null;
  coreGlow = null;
  noteAnchors = [];
  mouseX = 0;
  mouseY = 0;
}
