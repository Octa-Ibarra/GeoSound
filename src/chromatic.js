/**
 * chromatic.js — Modo 2: El Círculo de las Formas
 * 
 * Muestra las 12 notas de la escala temperada en un círculo.
 * Al activar notas, dibuja polígonos y revela su nombre geométrico.
 */

import { playNote, NOTE_NAMES, NOTE_COLORS, playChord, playArpeggio } from './audio.js';
import { registerModeHandlers } from './makey.js';

const canvas = document.getElementById('chromatic-canvas');
const ctx = canvas.getContext('2d');

// Estado: set de notas activas (índices 0-11)
let activeNotes = new Set();
let animFrame = null;
let pulsePhase = 0;
let ripples = []; // efectos de onda al activar nota

// Botones de Makey Makey mapeados a notas
const MAKEY_NOTES = { Space: 0, ArrowUp: 4, ArrowRight: 7, ArrowDown: 9, ArrowLeft: 11 };

// Datos de formas geométricas según cantidad y combinación de notas
const SHAPE_DATA = {
  1: { name: 'Punto', desc: 'Una sola nota. El origen de toda melodía.' },
  2: { name: 'Intervalo', desc: 'Dos notas crean una línea, el intervalo musical más simple.' },
  3: {
    major: { name: 'Triángulo (Acorde Mayor)', desc: 'Do-Mi-Sol forman un triángulo. 3 notas que suenan juntas crean el acorde más usado en la música occidental.' },
    aug:   { name: 'Triángulo Equilátero', desc: '¡Perfección geométrica! El acorde aumentado (Do-Mi-Sol#) forma un triángulo con tres lados exactamente iguales.' },
    dim:   { name: 'Triángulo Menor', desc: 'El acorde disminuido: tres notas separadas exactamente lo mismo, tirando en diferentes direcciones.' },
    other: { name: 'Triángulo', desc: 'Tres notas, un triángulo. Cada combinación tiene su propia forma y sonido.' },
  },
  4: { name: 'Cuadrilátero', desc: 'Cuatro notas dibujan un cuadrilátero en el círculo. El acorde de séptima.' },
  5: { name: 'Pentágono', desc: 'La escala pentatónica tiene 5 notas. Aparece en músicas de todo el mundo: jazz, blues, música china, andina.' },
  6: { name: 'Hexágono', desc: 'El acorde de novena. Seis puntos en el círculo forman un hexágono, como un copo de nieve musical.' },
  7: { name: 'Heptágono', desc: 'La escala diatónica (Do Re Mi Fa Sol La Si) tiene 7 notas. Un heptágono casi regular, ¡la base de la música occidental!' },
  8: { name: 'Octágono', desc: 'Ocho notas en el círculo. Las escalas modernas usan a veces 8 sonidos.' },
  12: { name: 'Dodecágono', desc: '¡Las 12 notas! La escala cromática completa dibuja un círculo perfecto de 12 puntos.' },
};

export function initChromatic() {
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); });

  // Botones de notas del sidebar
  const noteButtons = document.querySelectorAll('#note-buttons .note-btn');
  noteButtons.forEach(btn => {
    if (btn.dataset.note === 'clear') {
      btn.addEventListener('click', clearAllNotes);
      btn.addEventListener('touchend', (e) => { e.preventDefault(); clearAllNotes(); });
    } else {
      const noteIdx = parseInt(btn.dataset.note);
      btn.addEventListener('click', () => toggleNote(noteIdx, btn));
      btn.addEventListener('touchend', (e) => { e.preventDefault(); toggleNote(noteIdx, btn); });
    }
  });

  // Acordes preset
  document.getElementById('chord-major').addEventListener('click', () => loadPreset([0, 4, 7]));
  document.getElementById('chord-pent').addEventListener('click', () => loadPreset([0, 2, 4, 7, 9]));
  document.getElementById('chord-dim').addEventListener('click', () => loadPreset([0, 4, 8]));

  // Botones Makey Makey mapeados a notas
  registerModeHandlers('mode2', {
    Space:      (phase) => { if (phase === 'down') toggleNoteByIndex(0); },
    ArrowUp:    (phase) => { if (phase === 'down') toggleNoteByIndex(4); },
    ArrowRight: (phase) => { if (phase === 'down') toggleNoteByIndex(7); },
    ArrowDown:  (phase) => { if (phase === 'down') toggleNoteByIndex(9); },
    ArrowLeft:  (phase) => { if (phase === 'down') toggleNoteByIndex(11); },
    Click:      (phase) => { if (phase === 'down') clearAllNotes(); },
  });

  // Guardar figura
  const btnSave = document.getElementById('btn-save-shape');
  if (btnSave) {
    btnSave.addEventListener('click', saveCurrentShape);
  }
  
  // Modal de geometría
  const btnCloseGeometry = document.getElementById('btn-close-geometry');
  if (btnCloseGeometry) {
    btnCloseGeometry.addEventListener('click', closeGeometryModal);
  }

  // Click en el canvas para activar notas del círculo
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    onCanvasClickAt(touch.clientX - rect.left, touch.clientY - rect.top);
  });

  startAnimation();
}

function resizeCanvas() {
  const parent = canvas.parentElement;
  const size = Math.min(parent.clientWidth - 48, parent.clientHeight - 48, 500);
  canvas.width = size;
  canvas.height = size;
}

function toggleNoteByIndex(noteIdx) {
  const btn = document.querySelector(`#note-btn-${noteIdx}`);
  toggleNote(noteIdx, btn);
}

function toggleNote(noteIdx, btn) {
  if (activeNotes.has(noteIdx)) {
    activeNotes.delete(noteIdx);
    if (btn) btn.classList.remove('active');
  } else {
    activeNotes.add(noteIdx);
    if (btn) btn.classList.add('active');
    playNote(noteIdx, 1.0, 0.4);
    addRipple(noteIdx);
  }
  updateChipDisplay();
  updateShapeReveal();
}

function clearAllNotes() {
  activeNotes.clear();
  document.querySelectorAll('.note-btn').forEach(b => b.classList.remove('active'));
  updateChipDisplay();
  updateShapeReveal();
}

function loadPreset(notes) {
  clearAllNotes();
  notes.forEach(n => {
    activeNotes.add(n);
    const btn = document.querySelector(`#note-btn-${n}`);
    if (btn) btn.classList.add('active');
  });
  playArpeggio(notes);
  setTimeout(() => playChord(notes), notes.length * 200 + 200);
  updateChipDisplay();
  updateShapeReveal();
}

function onCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  onCanvasClickAt(e.clientX - rect.left, e.clientY - rect.top);
}

function onCanvasClickAt(cx, cy) {
  const size = canvas.width;
  const center = size / 2;
  const radius = size * 0.38;

  // Verificar si el click está cerca de algún nodo
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const nx = center + radius * Math.cos(angle);
    const ny = center + radius * Math.sin(angle);
    const dist = Math.hypot(cx - nx, cy - ny);
    if (dist < 28) {
      toggleNoteByIndex(i);
      return;
    }
  }
}

function addRipple(noteIdx) {
  ripples.push({ note: noteIdx, progress: 0, alpha: 1 });
}

function updateChipDisplay() {
  const container = document.getElementById('active-notes-display');
  if (activeNotes.size === 0) {
    container.innerHTML = '<p class="no-notes-hint">Toca una nota para comenzar</p>';
    return;
  }
  const sorted = [...activeNotes].sort((a, b) => a - b);
  container.innerHTML = sorted.map(n =>
    `<span class="active-note-chip" style="background:${NOTE_COLORS[n]}22;color:${NOTE_COLORS[n]};border:1px solid ${NOTE_COLORS[n]}55">
      ${NOTE_NAMES[n]}
    </span>`
  ).join('');
}

function updateShapeReveal() {
  const shapeDiv = document.getElementById('shape-reveal');
  const nameEl = document.getElementById('shape-name');
  const descEl = document.getElementById('shape-desc');

  const n = activeNotes.size;
  if (n === 0) {
    nameEl.textContent = '';
    descEl.textContent = 'Activa notas para ver qué figura aparece';
    return;
  }

  let shape;
  let isShapeFormed = false;

  if (n === 3) {
    const sorted = [...activeNotes].sort((a, b) => a - b);
    const intervals = [sorted[1] - sorted[0], sorted[2] - sorted[1]];
    if (intervals[0] === 4 && intervals[1] === 4) {
      shape = SHAPE_DATA[3].aug;
    } else if (intervals[0] === 3 && intervals[1] === 4) {
      shape = SHAPE_DATA[3].dim;
    } else if (intervals[0] === 4 && intervals[1] === 3) {
      shape = SHAPE_DATA[3].major;
    } else {
      shape = SHAPE_DATA[3].other;
    }
    isShapeFormed = true;
  } else if (n === 12) {
    shape = SHAPE_DATA[12];
    isShapeFormed = true;
  } else if (SHAPE_DATA[n]) {
    shape = SHAPE_DATA[n];
    if (n >= 2) isShapeFormed = true;
  } else {
    shape = { name: `Polígono de ${n} lados`, desc: `${n} notas activas forman una figura de ${n} vértices en el círculo.` };
    isShapeFormed = true;
  }

  nameEl.textContent = shape.name;
  descEl.textContent = shape.desc;

  const btnSave = document.getElementById('btn-save-shape');
  if (btnSave) {
    if (isShapeFormed) btnSave.classList.remove('hidden');
    else btnSave.classList.add('hidden');
  }
}

// Colors for shapes to be unique
const SAVED_SHAPE_COLORS = ['#FFD250', '#7EB8FF', '#A8FFB0', '#FFB0D0', '#FFB86A', '#C4A8FF'];

// -------- FLOATING SHAPES Y GEOMETRÍA ----------
function saveCurrentShape() {
  if (activeNotes.size < 2) return;
  const container = document.getElementById('floating-shapes-container');
  if (!container) return;

  const shapeNotes = [...activeNotes].sort((a, b) => a - b);
  const div = document.createElement('div');
  div.className = 'floating-shape';
  
  const panelW = container.clientWidth;
  const panelH = container.clientHeight;
  const size = 50;
  
  // Try to prevent overlap with the main circle which is in the center
  const centerW = panelW / 2;
  const centerH = panelH / 2;
  const mainCircleR = Math.min(panelW, panelH, 500) / 2;
  
  let rx, ry, dist;
  for (let iter = 0; iter < 50; iter++) {
    rx = 20 + Math.random() * (panelW - size - 40);
    ry = 20 + Math.random() * (panelH - size - 40);
    const dx = (rx + size/2) - centerW;
    const dy = (ry + size/2) - centerH;
    dist = Math.hypot(dx, dy);
    // If it's outside the main circle + padding, break
    if (dist > mainCircleR - 10) break;
  }
  
  div.style.left = rx + 'px';
  div.style.top = ry + 'px';
  div.style.animationDelay = (Math.random() * 2) + 's';
  
  // Pick random color
  const colorHex = SAVED_SHAPE_COLORS[Math.floor(Math.random() * SAVED_SHAPE_COLORS.length)];
  // Apply a custom custom property to the div for hover glow
  div.style.setProperty('--shape-col', colorHex);
  div.style.borderColor = colorHex + '66';

  const sCanvas = document.createElement('canvas');
  sCanvas.width = size; sCanvas.height = size;
  const sCtx = sCanvas.getContext('2d');
  
  const ctxCenter = size/2;
  const ctxR = size * 0.42;
  
  // Dibujar el polígono miniatura
  sCtx.beginPath();
  shapeNotes.forEach((n, idx) => {
    const angle = (n * 30 - 90) * Math.PI / 180;
    const x = ctxCenter + ctxR * Math.cos(angle);
    const y = ctxCenter + ctxR * Math.sin(angle);
    if(idx === 0) sCtx.moveTo(x,y);
    else sCtx.lineTo(x,y);
  });
  sCtx.closePath();
  sCtx.fillStyle = colorHex + '40';
  sCtx.fill();
  sCtx.strokeStyle = colorHex;
  sCtx.lineWidth = 1.8;
  sCtx.stroke();
  
  // Dibujar los nodos miniatura
  shapeNotes.forEach((n) => {
    const angle = (n * 30 - 90) * Math.PI / 180;
    const x = ctxCenter + ctxR * Math.cos(angle);
    const y = ctxCenter + ctxR * Math.sin(angle);
    sCtx.beginPath();
    sCtx.arc(x, y, 2.5, 0, Math.PI * 2);
    sCtx.fillStyle = NOTE_COLORS[n];
    sCtx.fill();
  });

  div.appendChild(sCanvas);
  container.appendChild(div);

  // Hover feedback via JS to allow dynamic shadow color
  div.addEventListener('mouseenter', () => {
    div.style.boxShadow = `0 8px 25px ${colorHex}55`;
    div.style.borderColor = colorHex;
  });
  div.addEventListener('mouseleave', () => {
    div.style.boxShadow = `0 4px 15px rgba(0,0,0,0.3)`;
    div.style.borderColor = colorHex + '66';
  });

  // Eventos de la figura flotante
  div.addEventListener('click', (e) => {
    e.stopPropagation();
    playChord(shapeNotes);
    
    // Feedback visual al reproducir
    div.style.transform = 'scale(1.3)';
    div.style.boxShadow = `0 0 30px ${colorHex}99`;
    setTimeout(() => {
      div.style.transform = '';
      div.style.boxShadow = `0 4px 15px rgba(0,0,0,0.3)`;
      div.style.borderColor = colorHex + '66';
    }, 400);
  });

  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGeometryModal(shapeNotes, colorHex);
  });
}

function openGeometryModal(notes, shapeColor = '#FFD250') {
  const modal = document.getElementById('geometry-modal');
  modal.classList.remove('hidden');
  
  const gCanvas = document.getElementById('geometry-canvas');
  // Ajuste HDPI
  const dpr = window.devicePixelRatio || 1;
  const rect = gCanvas.parentElement.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height) - 20;
  
  gCanvas.width = size * dpr;
  gCanvas.height = size * dpr;
  gCanvas.style.width = size + 'px';
  gCanvas.style.height = size + 'px';
  
  const ctx = gCanvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  drawGeometricAnalysis(ctx, size, notes, shapeColor);
}

function closeGeometryModal() {
  document.getElementById('geometry-modal').classList.add('hidden');
}

function getAngleType(deg) {
  if (Math.abs(deg - 90) < 0.1) return 'Recto';
  if (Math.abs(deg - 180) < 0.1) return 'Llano';
  if (deg < 90) return 'Agudo';
  if (deg < 180) return 'Obtuso';
  return 'Reflejo';
}

function drawGeometricAnalysis(ctx, size, notes, shapeColor) {
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;
  // Use a smaller radius to allow room for text and arcs without clipping!
  const radius = size * 0.28;
  
  // Dibujar círculo guía
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (notes.length < 2) return;

  const points = notes.map(n => {
    const angle = (n * 30 - 90) * Math.PI / 180;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle), note: n, angleRad: angle };
  });

  // Dibujar polígono
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = shapeColor + '15'; // 15% opacity hex
  ctx.fill();
  ctx.strokeStyle = shapeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Calcular y dibujar ángulos si hay 3 o más ptos
  let sumAngles = 0;
  
  if (notes.length >= 3) {
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const pt = points[i];
      const next = points[(i + 1) % points.length];

      // Ángulo inscrito = arco interceptado / 2
      const arcSteps = (prev.note - next.note + 12) % 12;
      const angleDeg = arcSteps * 15;
      sumAngles += angleDeg;

      // Ángulos para dibujar el interior
      let a1 = Math.atan2(next.y - pt.y, next.x - pt.x);
      let a2 = Math.atan2(prev.y - pt.y, prev.x - pt.x);
      
      let diff = a2 - a1;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      // Arc de dibujo: diff < 0 indicates the CCW sweep draws the short interior arc
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 22, a1, a2, diff < 0); 
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Relleno suave para el ángulo
      ctx.lineTo(pt.x, pt.y);
      ctx.fillStyle = shapeColor + '35';
      ctx.fill();

      // Texto: se coloca en la dirección de la bisectriz interior
      const textAngleRad = a1 + diff / 2;
      const tx = pt.x + 36 * Math.cos(textAngleRad);
      const ty = pt.y + 36 * Math.sin(textAngleRad);
      
      ctx.font = '600 12px "Outfit", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const type = getAngleType(angleDeg);
      ctx.fillText(`${angleDeg}°`, tx, ty - 5);
      ctx.font = '400 9px "Outfit", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(type, tx, ty + 7);
    }
  }

  // Dibujar Nodos
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = NOTE_COLORS[p.note];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  
  // Info text
  const infoEl = document.getElementById('geometry-info');
  if (notes.length === 2) {
    infoEl.innerHTML = `Dos puntos forman una <b>línea</b>.<br>Representa un único intervalo musical en el campo geométrico.`;
  } else {
    // Si todos los lados son iguales, es regular
    const distances = [];
    for(let i=0; i<notes.length; i++) {
        distances.push((notes[(i+1)%notes.length] - notes[i] + 12) % 12);
    }
    const isRegular = distances.every(d => d === distances[0]);
    infoEl.innerHTML = `Polígono de <b>${notes.length} lados</b>.<br>
      La suma de sus ángulos internos teóricos es <b>${sumAngles}°</b>.<br>
      Esta figura geométrica es <b>${isRegular ? 'REGULAR' : 'IRREGULAR'}</b>, al igual que los intervalos musicales que la componen.`;
  }
}

// -------- ANIMACIÓN PRINCIPAL ----------
function startAnimation() {
  if (animFrame) cancelAnimationFrame(animFrame);
  function loop() {
    drawChromatic();
    pulsePhase += 0.04;
    ripples = ripples.filter(r => r.alpha > 0.01);
    ripples.forEach(r => { r.progress += 0.025; r.alpha *= 0.96; });
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function drawChromatic() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const center = W / 2;
  const outerR = W * 0.44;
  const nodeR  = W * 0.38;
  const dotR   = W * 0.04;

  // ---- Fondos concéntricos ----
  const bgGrad = ctx.createRadialGradient(center, center, 0, center, center, outerR);
  bgGrad.addColorStop(0, 'rgba(20,35,70,0.95)');
  bgGrad.addColorStop(1, 'rgba(8,13,26,0.95)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath(); ctx.arc(center, center, outerR, 0, Math.PI * 2); ctx.fill();

  // Círculo guía exterior
  ctx.beginPath(); ctx.arc(center, center, nodeR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

  // ---- Ripples (efectos de onda) ----
  ripples.forEach(r => {
    const angle = (r.note * 30 - 90) * Math.PI / 180;
    const nx = center + nodeR * Math.cos(angle);
    const ny = center + nodeR * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(nx, ny, dotR + r.progress * nodeR * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = `${NOTE_COLORS[r.note]}${Math.floor(r.alpha * 255).toString(16).padStart(2,'0')}`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // ---- Polígono (líneas entre notas activas) ----
  const sorted = [...activeNotes].sort((a, b) => a - b);
  if (sorted.length >= 2) {
    const points = sorted.map(n => {
      const a = (n * 30 - 90) * Math.PI / 180;
      return { x: center + nodeR * Math.cos(a), y: center + nodeR * Math.sin(a) };
    });

    // Relleno translúcido
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,210,80,0.06)';
    ctx.fill();

    // Borde del polígono con gradiente dorado
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = `rgba(255,210,80,${0.5 + 0.15 * Math.sin(pulsePhase)})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,210,80,0.4)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ---- Nodos (12 notas) ----
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const nx = center + nodeR * Math.cos(angle);
    const ny = center + nodeR * Math.sin(angle);
    const isActive = activeNotes.has(i);
    const color = NOTE_COLORS[i];
    const pulse = isActive ? (1 + 0.12 * Math.sin(pulsePhase * 2 + i)) : 1;
    const r = dotR * pulse * (isActive ? 1.3 : 1);

    // Glow
    if (isActive) {
      ctx.beginPath(); ctx.arc(nx, ny, r * 2.5, 0, Math.PI * 2);
      const glowGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 2.5);
      glowGrad.addColorStop(0, `${color}44`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    // Nodo
    ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2);
    const nodeGrad = ctx.createRadialGradient(nx - r * 0.3, ny - r * 0.3, 0, nx, ny, r);
    nodeGrad.addColorStop(0, isActive ? color : `${color}80`);
    nodeGrad.addColorStop(1, isActive ? `${color}CC` : `${color}30`);
    ctx.fillStyle = nodeGrad;
    if (isActive) {
      ctx.shadowColor = color; ctx.shadowBlur = 18;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Borde
    ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2);
    ctx.strokeStyle = isActive ? `${color}FF` : `${color}40`;
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.stroke();

    // Etiqueta de nota
    const labelR = nodeR + dotR * 2.2;
    const lx = center + labelR * Math.cos(angle);
    const ly = center + labelR * Math.sin(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${isActive ? 700 : 500} ${W * 0.032}px 'Outfit', sans-serif`;
    ctx.fillStyle = isActive ? color : 'rgba(255,255,255,0.35)';
    ctx.fillText(NOTE_NAMES[i], lx, ly);
  }

  // ---- Centro ----
  const pStr = [...activeNotes].sort((a,b)=>a-b).map(n => NOTE_NAMES[n]).join('-') || '● ';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${W * 0.06}px 'Outfit', sans-serif`;
  ctx.fillStyle = activeNotes.size > 0 ? 'rgba(255,210,80,0.9)' : 'rgba(255,255,255,0.1)';
  ctx.fillText(pStr, center, center);
}
