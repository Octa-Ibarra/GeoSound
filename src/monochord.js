/**
 * monochord.js — Modo 1: El Monocordio de Pitágoras
 * 
 * Permite al niño dividir una cuerda virtual en proporciones
 * pitagóricas (1:2, 2:3, 3:4, 4:5) y escuchar los intervalos.
 */

import { playMonochordRatio, playFrequency, NOTE_FREQUENCIES } from './audio.js';
import { registerModeHandlers } from './makey.js';

const canvas = document.getElementById('monochord-canvas');
const ctx = canvas.getContext('2d');

let currentRatio = 1.0;  // posición del divisor (0..1)
let isDragging = false;
let animFrame = null;
let wavePhase = 0;
let waveAmplitude = 0;
let waveDecay = 0;

// Datos de proporciones pitagóricas
const RATIOS = [
  { ratio: 1.0,   frac: '1:1', name: 'Unísono', fact: 'La cuerda entera suena su nota completa. La más simple: el número 1.' },
  { ratio: 0.5,   frac: '1:2', name: 'Octava', fact: 'Pitágoras fue el primero en entender que al dividir la cuerda a la mitad, el sonido sube exactamente una octava. La razón 1:2 es la más "perfecta" para el oído.' },
  { ratio: 0.667, frac: '2:3', name: 'Quinta Perfecta (Sol)', fact: 'La razón 2:3 produce el intervalo más consonante después de la octava. En Do mayor, es la nota Sol. Los pitagóricos la consideraban sagrada.' },
  { ratio: 0.75,  frac: '3:4', name: 'Cuarta Justa (Fa)', fact: 'La razón 3:4 es la cuarta. En el sistema pitagórico, cuarta + quinta = octava: 3/4 × 2/3 = 1/2. ¡Las fracciones también suenan!' },
  { ratio: 0.8,   frac: '4:5', name: 'Tercera Mayor (Mi)', fact: 'La razón 4:5 nos da la tercera mayor. Es la que hace que un acorde "mayor" suene alegre. Do + Mi + Sol = ¡el acorde más usado en la música!' },
];

export function initMonochord() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Interacción mouse/touch
  canvas.addEventListener('mousedown', onDragStart);
  canvas.addEventListener('mousemove', onDragMove);
  canvas.addEventListener('mouseup', onDragEnd);
  canvas.addEventListener('mouseleave', onDragEnd);

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onDragEnd);

  // Botones de proporción en el sidebar
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = parseFloat(btn.dataset.ratio);
      setRatio(r);
      triggerWave();
      playMonochordRatio(r, 'right');
      highlightRatioBtn(btn);
    });
  });

  // Botones de play
  document.getElementById('btn-play-left').addEventListener('click', () => {
    triggerWave();
    playMonochordRatio(currentRatio, 'left');
  });
  document.getElementById('btn-play-right').addEventListener('click', () => {
    triggerWave();
    playMonochordRatio(currentRatio, 'right');
  });
  document.getElementById('btn-play-full').addEventListener('click', () => {
    triggerWave();
    playMonochordRatio(1.0, 'full');
  });

  // Handlers del Makey Makey para Modo 1
  registerModeHandlers('mode1', {
    ArrowUp: (phase) => { if (phase === 'down') { setRatio(0.5); triggerWave(); playMonochordRatio(0.5, 'right'); highlightRatioByValue(0.5); } },
    ArrowRight: (phase) => { if (phase === 'down') { setRatio(0.667); triggerWave(); playMonochordRatio(0.667, 'right'); highlightRatioByValue(0.667); } },
    ArrowDown: (phase) => { if (phase === 'down') { setRatio(0.75); triggerWave(); playMonochordRatio(0.75, 'right'); highlightRatioByValue(0.75); } },
    ArrowLeft: (phase) => { if (phase === 'down') { setRatio(0.8); triggerWave(); playMonochordRatio(0.8, 'right'); highlightRatioByValue(0.8); } },
    Space: (phase) => { if (phase === 'down') { setRatio(1.0); triggerWave(); playMonochordRatio(1.0, 'full'); highlightRatioByValue(1.0); } },
  });

  setRatio(1.0);
  startAnimation();
}

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = 200;
}

function setRatio(ratio) {
  currentRatio = ratio;
  updateUI(ratio);
}

function updateUI(ratio) {
  const data = RATIOS.find(r => Math.abs(r.ratio - ratio) < 0.01) || RATIOS[0];
  const [num, den] = data.frac.split(':');

  document.getElementById('ratio-num').textContent = num;
  document.getElementById('ratio-den').textContent = den;
  document.getElementById('interval-name').textContent = data.name;
  document.getElementById('pyth-fact').querySelector('.fact-text').textContent = data.fact;
}

function highlightRatioBtn(activeBtn) {
  document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');
}

function highlightRatioByValue(value) {
  document.querySelectorAll('.ratio-btn').forEach(b => {
    if (Math.abs(parseFloat(b.dataset.ratio) - value) < 0.01) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function triggerWave() {
  waveAmplitude = 22;
  waveDecay = 0.96;
}

// -------- DRAG ----------
function getX(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX - rect.left) / rect.width;
}

function onDragStart(e) {
  isDragging = true;
  setRatioFromX(getX(e));
}
function onDragMove(e) {
  if (!isDragging) return;
  setRatioFromX(getX(e));
}
function onDragEnd() { isDragging = false; }

function onTouchStart(e) {
  e.preventDefault(); isDragging = true;
  setRatioFromX(getTouchX(e));
}
function onTouchMove(e) {
  e.preventDefault();
  if (!isDragging) return;
  setRatioFromX(getTouchX(e));
}
function getTouchX(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.touches[0].clientX - rect.left) / rect.width;
}

function setRatioFromX(x) {
  // Mapear x (0..1) a la proporción más cercana
  const r = Math.max(0.05, Math.min(0.99, x));
  currentRatio = r;
  // Actualizar UI con ratio libre
  const fnum = Math.round(r * 10); const fden = 10;
  document.getElementById('ratio-num').textContent = fnum;
  document.getElementById('ratio-den').textContent = fden;
  // Snap al intervalo si está cerca
  const snap = RATIOS.slice(1).find(d => Math.abs(d.ratio - r) < 0.04);
  if (snap) {
    currentRatio = snap.ratio;
    updateUI(snap.ratio);
    highlightRatioByValue(snap.ratio);
  } else {
    document.getElementById('interval-name').textContent = 'Explorado libremente';
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
  }
}

// -------- ANIMACIÓN ----------
function startAnimation() {
  if (animFrame) cancelAnimationFrame(animFrame);
  function loop() {
    drawMonochord();
    wavePhase += 0.12;
    if (waveAmplitude > 0.3) waveAmplitude *= waveDecay;
    else waveAmplitude = 0;
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function drawMonochord() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pad = 40;
  const stringY = H / 2;
  const stringW = W - pad * 2;
  const divX = pad + stringW * currentRatio;

  // Fondo
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, 'rgba(15,25,55,0.9)');
  bgGrad.addColorStop(1, 'rgba(8,13,26,0.9)');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.fill();

  // Cajas de resonancia (extremos)
  const boxW = 30, boxH = 80;
  ctx.fillStyle = 'rgba(255,210,80,0.12)';
  ctx.strokeStyle = 'rgba(255,210,80,0.25)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 5, stringY - boxH / 2, boxW, boxH, 6);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, W - boxW - 5, stringY - boxH / 2, boxW, boxH, 6);
  ctx.fill(); ctx.stroke();

  // Etiquetas de proporción encima de cada segmento
  const leftCenter = pad + (divX - pad) / 2;
  const rightCenter = divX + (W - pad - divX) / 2;

  ctx.textAlign = 'center';
  ctx.font = `600 13px 'Space Grotesk', monospace`;
  ctx.fillStyle = 'rgba(255,210,80,0.6)';
  ctx.fillText(currentRatio < 0.99 ? 'Cuerda completa' : '━━━', leftCenter, stringY - 30);
  if (currentRatio < 0.99) {
    const ratio2 = 1 - currentRatio;
    ctx.fillStyle = 'rgba(126,184,255,0.7)';
    ctx.fillText('Segmento derecho', rightCenter, stringY - 30);
  }

  // === CUERDA IZQUIERDA (base) ===
  const segmentsLeft = 80;
  const leftLen = divX - pad;
  ctx.beginPath();
  for (let i = 0; i <= segmentsLeft; i++) {
    const t = i / segmentsLeft;
    const x = pad + t * leftLen;
    const wave = waveAmplitude * Math.sin(Math.PI * t) * Math.sin(wavePhase * 2 + t * Math.PI * 4);
    const y = stringY + wave;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  const leftGrad = ctx.createLinearGradient(pad, 0, divX, 0);
  leftGrad.addColorStop(0, 'rgba(255,210,80,0.4)');
  leftGrad.addColorStop(1, 'rgba(255,210,80,0.9)');
  ctx.strokeStyle = leftGrad;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(255,210,80,0.5)';
  ctx.shadowBlur = waveAmplitude > 1 ? 12 : 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // === CUERDA DERECHA (segmento) ===
  if (currentRatio < 0.99) {
    const segmentsRight = 80;
    const rightStart = divX;
    const rightLen = W - pad - divX;
    const freqMult = currentRatio < 0.6 ? 3 : currentRatio < 0.8 ? 2 : 1.5;

    ctx.beginPath();
    for (let i = 0; i <= segmentsRight; i++) {
      const t = i / segmentsRight;
      const x = rightStart + t * rightLen;
      const wave = waveAmplitude * 0.6 * Math.sin(Math.PI * t) * Math.sin(wavePhase * freqMult * 2 + t * Math.PI * 4 * freqMult);
      const y = stringY + wave;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    const rightGrad = ctx.createLinearGradient(divX, 0, W - pad, 0);
    rightGrad.addColorStop(0, 'rgba(126,184,255,0.9)');
    rightGrad.addColorStop(1, 'rgba(126,184,255,0.4)');
    ctx.strokeStyle = rightGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(126,184,255,0.4)';
    ctx.shadowBlur = waveAmplitude > 1 ? 8 : 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Punto divisor (arrastrable)
  const dpRadius = 14;
  const dpGrad = ctx.createRadialGradient(divX, stringY, 0, divX, stringY, dpRadius);
  dpGrad.addColorStop(0, '#FFE07A');
  dpGrad.addColorStop(1, '#FF9E00');
  ctx.beginPath();
  ctx.arc(divX, stringY, dpRadius, 0, Math.PI * 2);
  ctx.fillStyle = dpGrad;
  ctx.shadowColor = 'rgba(255,180,0,0.8)';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#FFF5D0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Instrucción de arrastre
  if (currentRatio === 1.0) {
    ctx.textAlign = 'center';
    ctx.font = '400 12px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('← arrastra el punto dorado →', W / 2, stringY + 40);
  }
}

// Utilidad: roundRect compatible
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
