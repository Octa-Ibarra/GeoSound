import * as THREE from 'three';

const GALAXY = {
  count: 90000,
  size: 0.035,
  radius: 13.6,
  branches: 4,
  spin: 1.18,
  randomness: 0.82,
  coreColor: '#f7d794',
  armColor: '#575fcf',
  magentaColor: '#d946ef',
  cyanColor: '#67e8f9'
};

const STAR_COUNT = 2200;

let canvas;
let scene;
let camera;
let renderer;
let galaxyGroup;
let galaxyPoints;
let stars;
let animationId;
let mouseX = 0;
let mouseY = 0;
let target = new THREE.Vector3(0, 0, 0);

function makeParticleTexture() {
  const particleCanvas = document.createElement('canvas');
  particleCanvas.width = 96;
  particleCanvas.height = 96;
  const ctx = particleCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.24, 'rgba(255,255,255,0.86)');
  gradient.addColorStop(0.52, 'rgba(255,255,255,0.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(particleCanvas);
}

function buildGalaxy() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(GALAXY.count * 3);
  const colors = new Float32Array(GALAXY.count * 3);

  const colorInside = new THREE.Color(GALAXY.coreColor);
  const colorOutside = new THREE.Color(GALAXY.armColor);
  const colorMagenta = new THREE.Color(GALAXY.magentaColor);
  const colorCyan = new THREE.Color(GALAXY.cyanColor);

  for (let i = 0; i < GALAXY.count; i++) {
    const i3 = i * 3;
    const radius = Math.pow(Math.random(), 1.32) * GALAXY.radius;
    const spinAngle = radius * GALAXY.spin;
    const branchAngle = ((i % GALAXY.branches) / GALAXY.branches) * Math.PI * 2;
    const randomPower = Math.pow(Math.random(), 2.4);
    const randomSign = Math.random() < 0.5 ? -1 : 1;
    const randomX = randomSign * randomPower * GALAXY.randomness * radius * (0.7 + Math.random() * 0.9);
    const randomY = (Math.random() - 0.5) * GALAXY.randomness * radius * 0.18;
    const randomZ = (Math.random() - 0.5) * GALAXY.randomness * radius * 0.7;

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    const color = colorInside.clone().lerp(colorOutside, radius / GALAXY.radius);
    if (Math.random() > 0.72) color.lerp(colorMagenta, 0.35 + Math.random() * 0.5);
    if (Math.random() > 0.82) color.lerp(colorCyan, 0.25 + Math.random() * 0.55);
    color.multiplyScalar(1.06 + (1 - radius / GALAXY.radius) * 0.34);

    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: GALAXY.size,
    map: makeParticleTexture(),
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.96
  });

  galaxyPoints = new THREE.Points(geometry, material);
  galaxyPoints.rotation.x = 0.18;
  galaxyGroup = new THREE.Group();
  galaxyGroup.add(galaxyPoints);
  scene.add(galaxyGroup);
}

function buildStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const cool = new THREE.Color('#dbeafe');
  const violet = new THREE.Color('#c4b5fd');
  const warm = new THREE.Color('#fde68a');

  for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3;
    const radius = 24 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi) * 0.58;
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const color = cool.clone();
    if (Math.random() > 0.68) color.lerp(violet, 0.55);
    if (Math.random() > 0.88) color.lerp(warm, 0.65);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.04,
    map: makeParticleTexture(),
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.78
  }));
  scene.add(stars);
}

function getScreenConfig() {
  const screen = document.body.dataset.screen || 'home';
  if (screen === 'home') {
    return {
      groupX: 5.4,
      groupY: -0.35,
      groupZ: -0.7,
      scale: 1.18,
      cameraY: 7.8,
      cameraZ: 17.8,
      lookX: 3.4,
      lookY: 0.25
    };
  }
  if (screen === 'production') {
    return {
      groupX: 0.8,
      groupY: -0.2,
      groupZ: -0.8,
      scale: 0.9,
      cameraY: 8.6,
      cameraZ: 18.8,
      lookX: 0.25,
      lookY: 0
    };
  }
  return {
    groupX: 1.3,
    groupY: -0.5,
    groupZ: -1.2,
    scale: 0.98,
    cameraY: 8.2,
    cameraZ: 18.8,
    lookX: 0.35,
    lookY: 0
  };
}

function resize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

function animate() {
  animationId = requestAnimationFrame(animate);
  const config = getScreenConfig();

  galaxyGroup.position.x += (config.groupX - galaxyGroup.position.x) * 0.035;
  galaxyGroup.position.y += (config.groupY - galaxyGroup.position.y) * 0.035;
  galaxyGroup.position.z += (config.groupZ - galaxyGroup.position.z) * 0.035;
  galaxyGroup.scale.lerp(new THREE.Vector3(config.scale, config.scale, config.scale), 0.035);
  galaxyGroup.rotation.y += 0.0015;
  galaxyGroup.rotation.z = Math.sin(performance.now() * 0.00015) * 0.035;

  stars.rotation.y += 0.00022;
  target.set(config.lookX + mouseX * 0.7, config.lookY - mouseY * 0.24, 0);
  camera.position.x += (mouseX * 4.5 - camera.position.x) * 0.045;
  camera.position.y += (config.cameraY + mouseY * 1.8 - camera.position.y) * 0.045;
  camera.position.z += (config.cameraZ + mouseY * 2.0 - camera.position.z) * 0.045;
  camera.lookAt(target);

  renderer.render(scene, camera);
}

export function initAmbientGalaxy() {
  canvas = document.getElementById('ambient-galaxy-canvas');
  if (!canvas || renderer) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 8, 18);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;

  buildStars();
  buildGalaxy();
  resize();

  document.addEventListener('mousemove', event => {
    mouseX = (event.clientX / window.innerWidth) - 0.5;
    mouseY = (event.clientY / window.innerHeight) - 0.5;
  });
  window.addEventListener('resize', resize);

  if (animationId) cancelAnimationFrame(animationId);
  animate();
}
