import * as THREE from 'three';

let scene;
let camera;
let renderer;
let animationId;
let planetGroup;
let planetMesh;
let cloudMesh;
let meteorGroup;
let starField;
let atmosphereSprite;
let activeMeteors = [];
let activeExplosions = [];
let mouseX = 0;
let mouseY = 0;
let mountEl = null;
let resizeObserver = null;

function makeGlowTexture(size = 160, inner = 'rgba(255,255,255,1)', outer = 'rgba(103,232,249,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.34, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function makePlanetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#fef3c7');
  background.addColorStop(0.18, '#f59e0b');
  background.addColorStop(0.52, '#7c3aed');
  background.addColorStop(0.82, '#1d4ed8');
  background.addColorStop(1, '#020617');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 28; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      80 + Math.random() * 240,
      18 + Math.random() * 50,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  for (let i = 0; i < 22; i++) {
    ctx.strokeStyle = `rgba(103,232,249,${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * canvas.height);
    ctx.bezierCurveTo(
      canvas.width * 0.25,
      Math.random() * canvas.height,
      canvas.width * 0.75,
      Math.random() * canvas.height,
      canvas.width,
      Math.random() * canvas.height
    );
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      100 + Math.random() * 220,
      20 + Math.random() * 48,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

function buildStars() {
  const count = 3400;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const cool = new THREE.Color('#dbeafe');
  const violet = new THREE.Color('#c4b5fd');
  const warm = new THREE.Color('#fde68a');

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const radius = 32 + Math.random() * 88;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi) * 0.64;
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const color = cool.clone();
    if (Math.random() > 0.66) color.lerp(violet, 0.55);
    if (Math.random() > 0.88) color.lerp(warm, 0.68);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  starField = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.08,
      map: makeGlowTexture(96, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      sizeAttenuation: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.84
    })
  );
  scene.add(starField);
}

function buildPlanet() {
  const texture = makePlanetTexture();
  const clouds = makeCloudTexture();

  planetGroup = new THREE.Group();
  planetGroup.position.set(2.8, -0.4, -1.5);

  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 96, 96),
    new THREE.MeshStandardMaterial({
      map: texture,
      emissive: new THREE.Color('#f59e0b'),
      emissiveIntensity: 0.18,
      roughness: 0.9,
      metalness: 0.02
    })
  );

  cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3.52, 96, 96),
    new THREE.MeshStandardMaterial({
      map: clouds,
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    })
  );

  const atmosphere = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(240, 'rgba(255,255,255,0.95)', 'rgba(217,70,239,0)'),
      color: new THREE.Color('#67e8f9'),
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  atmosphere.scale.set(10.8, 10.8, 1);
  atmosphereSprite = atmosphere;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.8, 6.6, 160),
    new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = Math.PI / 2.2;
  ring.rotation.z = 0.36;

  planetGroup.add(ring);
  planetGroup.add(planetMesh);
  planetGroup.add(cloudMesh);
  planetGroup.add(atmosphere);
  scene.add(planetGroup);
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0x67e8f9, 0.42));

  const keyLight = new THREE.DirectionalLight(0xfef3c7, 2.8);
  keyLight.position.set(-8, 9, 12);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xc4b5fd, 1.8);
  rimLight.position.set(8, 3, -8);
  scene.add(rimLight);
}

function ensureGroups() {
  meteorGroup = new THREE.Group();
  scene.add(meteorGroup);
}

function makeExplosion(position, colorHex, intensity) {
  const count = 64;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(colorHex);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.2) * 1.4,
      (Math.random() - 0.5) * 2
    ).normalize();
    velocities.push(dir.multiplyScalar((0.04 + Math.random() * 0.08) * intensity));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.18 + intensity * 0.12,
    map: makeGlowTexture(96, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  meteorGroup.add(points);
  activeExplosions.push({ points, velocities, life: 1 });
}

export function triggerBassImpact(noteIndex, duration = 0.25) {
  if (!scene || !meteorGroup || !planetGroup) return;

  const radius = 3.3;
  const theta = (noteIndex / 12) * Math.PI * 2;
  const phi = 0.7 + ((noteIndex % 5) / 5) * 1.1;
  const localTarget = new THREE.Vector3(
    Math.cos(theta) * Math.sin(phi) * radius * 0.92,
    Math.cos(phi) * radius * 0.72,
    Math.sin(theta) * Math.sin(phi) * radius * 0.55
  );

  const target = localTarget.clone().add(planetGroup.position);
  const start = target.clone().add(
    new THREE.Vector3(
      -7.5 - Math.random() * 2.6,
      4.8 + Math.random() * 3.6,
      3.5 + Math.random() * 3.4
    )
  );

  const meteor = new THREE.Mesh(
    new THREE.SphereGeometry(0.12 + duration * 0.55, 18, 18),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: new THREE.Color('#f97316'),
      emissiveIntensity: 1.2,
      roughness: 0.55,
      metalness: 0.12
    })
  );
  meteor.position.copy(start);

  const trail = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(128, 'rgba(255,255,255,0.95)', 'rgba(249,115,22,0)'),
      color: new THREE.Color('#fb923c'),
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  trail.scale.set(1.8 + duration * 1.6, 0.55 + duration * 0.4, 1);
  meteor.add(trail);

  meteorGroup.add(meteor);
  activeMeteors.push({
    mesh: meteor,
    start,
    target,
    progress: 0,
    speed: 0.02 + Math.random() * 0.018 + duration * 0.012,
    color: noteIndex % 2 === 0 ? '#67e8f9' : '#facc15',
    intensity: 0.9 + duration * 1.4
  });
}

function updateMeteors() {
  for (let i = activeMeteors.length - 1; i >= 0; i--) {
    const meteor = activeMeteors[i];
    meteor.progress += meteor.speed;
    meteor.mesh.position.lerpVectors(meteor.start, meteor.target, meteor.progress);
    meteor.mesh.lookAt(meteor.target);
    meteor.mesh.rotation.z += 0.28;

    if (meteor.progress >= 1) {
      makeExplosion(meteor.target, meteor.color, meteor.intensity);
      meteorGroup.remove(meteor.mesh);
      meteor.mesh.geometry.dispose();
      meteor.mesh.material.dispose();
      activeMeteors.splice(i, 1);
    }
  }
}

function updateExplosions() {
  for (let i = activeExplosions.length - 1; i >= 0; i--) {
    const explosion = activeExplosions[i];
    explosion.life -= 0.024;
    const positions = explosion.points.geometry.attributes.position.array;

    for (let p = 0; p < explosion.velocities.length; p++) {
      const i3 = p * 3;
      positions[i3] += explosion.velocities[p].x;
      positions[i3 + 1] += explosion.velocities[p].y;
      positions[i3 + 2] += explosion.velocities[p].z;
      explosion.velocities[p].multiplyScalar(0.98);
    }

    explosion.points.geometry.attributes.position.needsUpdate = true;
    explosion.points.material.opacity = Math.max(0, explosion.life);

    if (explosion.life <= 0) {
      meteorGroup.remove(explosion.points);
      explosion.points.geometry.dispose();
      explosion.points.material.dispose();
      activeExplosions.splice(i, 1);
    }
  }
}

function onMouseMove(event) {
  mouseX = (event.clientX / window.innerWidth) - 0.5;
  mouseY = (event.clientY / window.innerHeight) - 0.5;
}

function resizeRendererToMount() {
  if (!camera || !renderer || !mountEl) return;
  const w = Math.max(1, Math.floor(mountEl.clientWidth));
  const h = Math.max(1, Math.floor(mountEl.clientHeight));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
}

function animate() {
  animationId = requestAnimationFrame(animate);

  if (planetGroup) {
    planetGroup.rotation.y += 0.0034;
    planetGroup.rotation.x = 0.18 + mouseY * 0.08;
    planetGroup.position.x = 2.8 + mouseX * 1.1;
    cloudMesh.rotation.y += 0.0046;
  }
  if (atmosphereSprite) {
    const pulse = 1 + Math.sin(performance.now() * 0.0018) * 0.04;
    atmosphereSprite.scale.set(10.8 * pulse, 10.8 * pulse, 1);
  }
  if (starField) starField.rotation.y += 0.00018;

  camera.position.x += (mouseX * 1.6 - camera.position.x) * 0.035;
  camera.position.y += (0.2 + mouseY * 0.8 - camera.position.y) * 0.035;
  camera.position.z += (12.4 - camera.position.z) * 0.035;
  camera.lookAt(planetGroup ? planetGroup.position : new THREE.Vector3());

  updateMeteors();
  updateExplosions();
  renderer.render(scene, camera);
}

export function initBassScene(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  destroyBassScene();

  mountEl = container;
  container.innerHTML = '';

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.028);

  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
  camera.position.set(0, 0.2, 12.4);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.domElement.className = 'bass-webgl-canvas';
  Object.assign(renderer.domElement.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
    zIndex: '0'
  });
  container.appendChild(renderer.domElement);

  resizeRendererToMount();
  resizeObserver = new ResizeObserver(() => resizeRendererToMount());
  resizeObserver.observe(container);

  buildStars();
  buildLights();
  buildPlanet();
  ensureGroups();

  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('resize', resizeRendererToMount);
  animate();
}

export function destroyBassScene() {
  if (animationId) cancelAnimationFrame(animationId);
  document.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('resize', resizeRendererToMount);

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  mountEl = null;

  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  if (scene) {
    scene.traverse(object => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
      else object.material?.dispose?.();
    });
  }

  renderer?.dispose?.();
  scene = null;
  camera = null;
  renderer = null;
  animationId = null;
  planetGroup = null;
  planetMesh = null;
  cloudMesh = null;
  meteorGroup = null;
  starField = null;
  atmosphereSprite = null;
  activeMeteors = [];
  activeExplosions = [];
  mouseX = 0;
  mouseY = 0;
}
