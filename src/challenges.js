/**
 * challenges.js — Modo 3: El Reto Pitagórico
 * 
 * Misiones donde el niño debe encontrar qué notas forman
 * una figura geométrica específica, o identificar un intervalo.
 */

import { playNote, playChord, playArpeggio, playSuccess, playWrong, NOTE_NAMES, NOTE_COLORS } from './audio.js';
import { registerModeHandlers } from './makey.js';

const canvas = document.getElementById('challenge-canvas');
const ctx = canvas.getContext('2d');

let activeNotes = new Set();
let currentChallenge = 0;
let animFrame = null;
let pulsePhase = 0;
let celebrateAnim = 0;
let isCelebrating = false;
let ripples = [];

// ---- Definición de retos ----
// Cada reto tiene: pregunta, pista, notas requeridas, forma esperada, dato curioso
const CHALLENGES = [
  {
    emoji: '🔺',
    question: '¿Qué notas forman un triángulo mayor?',
    hint: 'Pitágoras lo llamaría "la tríada perfecta". Necesitas 3 notas.',
    target: [0, 4, 7],  // Do, Mi, Sol
    shapeName: '¡Triángulo Mayor!',
    fact: 'Do-Mi-Sol forman el acorde de Do Mayor. En el círculo, estas 3 notas dibujan un triángulo. Geométricamente es un triángulo irregular (escaleno), equivalente a sumar fracciones musicales (1:1, 4:5, y 2:3). La asimetría le da su sonido alegre vibrante.',
    availableNotes: [0, 2, 4, 5, 7, 9],
  },
  {
    emoji: '⬡',
    question: '¿Cuál de estos grupos dibuja un polígono de 5 lados casi regular?',
    hint: 'La escala pentatónica tiene 5 notas y no contiene medios tonos.',
    target: [0, 2, 4, 7, 9],  // Pentatónica
    shapeName: '¡Polígono Pentatónico!',
    fact: 'La escala pentatónica (5 notas). Matemáticamente, este pentágono suma 540° en sus ángulos internos teóricos. A pesar de no tener todos sus lados iguales, su increíble equilibrio lo hace sonar armónico en todas las músicas del mundo.',
    availableNotes: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    emoji: '▲',
    question: '¿Cuáles 3 notas forman un triángulo EQUILÁTERO perfecto?',
    hint: 'Las 3 notas deben estar exactamente igual de separadas (120°) en el círculo.',
    target: [0, 4, 8],  // Acorde aumentado
    shapeName: '¡Triángulo Equilátero!',
    fact: 'Do-Mi-Sol# forman un triángulo equilátero perfecto: sus 3 ángulos miden exactamente 60° internamente y tienen 3 ejes de simetría. Al tener proporciones divididas de forma tan exacta y simétrica, el cerebro lo percibe tenso, ¡pareciera que no termina en ninguna parte!',
    availableNotes: [0, 2, 4, 6, 8, 10],
  },
  {
    emoji: '🎵',
    question: 'Escucha este intervalo. ¿Es una Octava (1:2) o una Quinta (2:3)?',
    hint: 'Si lo miras en el círculo, no forma figura, es solo una línea que atraviesa el centro o no.',
    target: [0, 7],  // Sol = quinta
    shapeName: '¡Es una Quinta!',
    fact: 'La quinta perfecta (Do-Sol) tiene una razón fraccionaria de 2:3. Además visualmente genera una línea casi recta que corta el círculo. Probar esto en el monocordio virtual te mostraría una armonía visual.',
    availableNotes: [0, 4, 7, 9, 11],
    cluePlay: [0, 7], // toca esto como pista
  },
  {
    emoji: '⭐',
    question: '¿Qué figura geométrica traza la escala básica completa?',
    hint: 'Activa las 7 notas de la escala occidental clásica: Do Re Mi Fa Sol La Si.',
    target: [0, 2, 4, 5, 7, 9, 11],
    shapeName: '¡Heptágono Diatónico!',
    fact: 'Esta figura de 7 lados, un heptágono, no es geométricamente regular. Matemáticamente hablando tiene ángulos interiores de diferentes grados. Esas variaciones en distancias angulares (tonos y semitonos) ¡son el secreto que permite que existan diferentes emociones musicales en el occidente!',
    availableNotes: [0, 2, 4, 5, 7, 9, 11],
  },
];

let onCelebrate = null;

export function initChallenges(celebrateCallback) {
  onCelebrate = celebrateCallback;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  loadChallenge(0);

  document.getElementById('btn-challenge-check').addEventListener('click', checkAnswer);
  document.getElementById('btn-challenge-skip').addEventListener('click', nextChallenge);

  // Handlers Makey Makey
  registerModeHandlers('mode3', {
    Space:      (phase) => { if (phase === 'down') toggleNote(0); },
    ArrowUp:    (phase) => { if (phase === 'down') toggleNote(4); },
    ArrowRight: (phase) => { if (phase === 'down') toggleNote(7); },
    ArrowDown:  (phase) => { if (phase === 'down') toggleNote(9); },
    ArrowLeft:  (phase) => { if (phase === 'down') toggleNote(11); },
    Click:      (phase) => { if (phase === 'down') checkAnswer(); },
  });

  startAnimation();
}

function resizeCanvas() {
  const parent = canvas.parentElement;
  const size = Math.min(parent.clientWidth - 32, 380);
  canvas.width = size;
  canvas.height = size;
}

function loadChallenge(idx) {
  currentChallenge = idx;
  activeNotes.clear();
  isCelebrating = false;
  celebrateAnim = 0;

  const ch = CHALLENGES[idx];
  document.getElementById('challenge-emoji').textContent = ch.emoji;
  document.getElementById('challenge-question').textContent = ch.question;
  document.getElementById('challenge-hint').textContent = ch.hint;
  document.getElementById('challenge-num').textContent = idx + 1;
  document.getElementById('challenge-total').textContent = CHALLENGES.length;
  document.getElementById('challenge-feedback').textContent = 'Activa las notas y presiona Comprobar';
  document.getElementById('challenge-feedback').className = 'challenge-feedback';

  // Si el reto tiene pista de audio
  if (ch.cluePlay) {
    setTimeout(() => playArpeggio(ch.cluePlay), 500);
    setTimeout(() => playChord(ch.cluePlay), 900 + ch.cluePlay.length * 200);
  }

  buildNoteButtons(ch.availableNotes);
}

function buildNoteButtons(available) {
  const container = document.getElementById('challenge-note-buttons');
  container.innerHTML = '';
  available.forEach(noteIdx => {
    const btn = document.createElement('button');
    btn.className = 'note-btn';
    btn.dataset.note = noteIdx;
    btn.id = `ch-note-${noteIdx}`;
    btn.setAttribute('aria-label', `Nota ${NOTE_NAMES[noteIdx]}`);
    btn.style.color = NOTE_COLORS[noteIdx];
    btn.innerHTML = `
      <span class="note-label">${NOTE_NAMES[noteIdx]}</span>
    `;
    btn.addEventListener('click', () => toggleNote(noteIdx));
    btn.addEventListener('touchend', (e) => { e.preventDefault(); toggleNote(noteIdx); });
    container.appendChild(btn);
  });
}

function toggleNote(noteIdx) {
  if (isCelebrating) return;
  const ch = CHALLENGES[currentChallenge];
  if (!ch.availableNotes.includes(noteIdx)) return;

  const btn = document.getElementById(`ch-note-${noteIdx}`);
  if (activeNotes.has(noteIdx)) {
    activeNotes.delete(noteIdx);
    if (btn) btn.classList.remove('active');
  } else {
    activeNotes.add(noteIdx);
    if (btn) btn.classList.add('active');
    playNote(noteIdx, 0.9, 0.4);
    ripples.push({ note: noteIdx, progress: 0, alpha: 1 });
  }
}

function checkAnswer() {
  if (isCelebrating) return;
  const ch = CHALLENGES[currentChallenge];
  const feedback = document.getElementById('challenge-feedback');

  const target = new Set(ch.target);
  const correct = target.size === activeNotes.size && [...target].every(n => activeNotes.has(n));

  if (correct) {
    feedback.textContent = `✓ ¡Correcto! ${ch.shapeName}`;
    feedback.className = 'challenge-feedback correct';
    playSuccess();
    isCelebrating = true;
    celebrateAnim = 0;
    setTimeout(() => {
      if (onCelebrate) onCelebrate({
        emoji: ch.emoji,
        title: ch.shapeName,
        fact: ch.fact,
        onContinue: nextChallenge,
      });
    }, 600);
  } else {
    feedback.textContent = '✗ Aún no… sigue intentando. Recuerda la pista.';
    feedback.className = 'challenge-feedback wrong';
    playWrong();
    // Shake animation
    const card = document.getElementById('challenge-card');
    card.style.animation = 'shake 400ms ease';
    card.addEventListener('animationend', () => card.style.animation = '', { once: true });
  }
}

function nextChallenge() {
  const next = (currentChallenge + 1) % CHALLENGES.length;
  loadChallenge(next);
}

// -------- ANIMACIÓN ----------
function startAnimation() {
  if (animFrame) cancelAnimationFrame(animFrame);
  function loop() {
    drawChallenge();
    pulsePhase += 0.05;
    if (isCelebrating) celebrateAnim += 0.06;
    ripples = ripples.filter(r => r.alpha > 0.01);
    ripples.forEach(r => { r.progress += 0.03; r.alpha *= 0.95; });
    animFrame = requestAnimationFrame(loop);
  }
  loop();
}

function drawChallenge() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const center = W / 2;
  const nodeR = W * 0.36;
  const dotR  = W * 0.04;

  // Fondo
  const bg = ctx.createRadialGradient(center, center, 0, center, center, nodeR + 20);
  bg.addColorStop(0, 'rgba(20,35,70,0.9)');
  bg.addColorStop(1, 'rgba(8,13,26,0.9)');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(center, center, nodeR + 20, 0, Math.PI * 2); ctx.fill();

  ctx.beginPath(); ctx.arc(center, center, nodeR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();

  const ch = CHALLENGES[currentChallenge];
  const available = ch.availableNotes;

  // Ripples
  ripples.forEach(r => {
    if (!available.includes(r.note)) return;
    const ni = available.indexOf(r.note);
    const angle = (ni * (360 / available.length) - 90) * Math.PI / 180;
    const nx = center + nodeR * Math.cos(angle);
    const ny = center + nodeR * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(nx, ny, dotR + r.progress * nodeR * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `${NOTE_COLORS[r.note]}${Math.floor(r.alpha * 200).toString(16).padStart(2,'0')}`;
    ctx.lineWidth = 2; ctx.stroke();
  });

  // Polígono
  const activeSorted = [...activeNotes].filter(n => available.includes(n)).sort((a, b) =>
    available.indexOf(a) - available.indexOf(b)
  );
  if (activeSorted.length >= 2) {
    const pts = activeSorted.map(n => {
      const ni = available.indexOf(n);
      const a = (ni * (360 / available.length) - 90) * Math.PI / 180;
      return { x: center + nodeR * Math.cos(a), y: center + nodeR * Math.sin(a) };
    });

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = isCelebrating
      ? `rgba(255,210,80,${0.1 + 0.05 * Math.sin(celebrateAnim)})`
      : 'rgba(255,210,80,0.05)';
    ctx.fill();

    ctx.strokeStyle = isCelebrating
      ? `rgba(255,210,80,${0.7 + 0.3 * Math.sin(celebrateAnim * 3)})`
      : `rgba(255,210,80,${0.5 + 0.15 * Math.sin(pulsePhase)})`;
    ctx.lineWidth = isCelebrating ? 3 : 2;
    ctx.shadowColor = 'rgba(255,210,80,0.5)';
    ctx.shadowBlur = isCelebrating ? 20 : 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Nodos (solo notas disponibles para este reto)
  available.forEach((noteIdx, ni) => {
    const angle = (ni * (360 / available.length) - 90) * Math.PI / 180;
    const nx = center + nodeR * Math.cos(angle);
    const ny = center + nodeR * Math.sin(angle);
    const isActive = activeNotes.has(noteIdx);
    const color = NOTE_COLORS[noteIdx];
    const r = dotR * (isActive ? 1.4 : 1) * (isActive && isCelebrating ? 1 + 0.2 * Math.abs(Math.sin(celebrateAnim * 4)) : 1);

    if (isActive) {
      const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 3);
      glow.addColorStop(0, `${color}44`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(nx, ny, r * 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? color : `${color}40`;
    if (isActive) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2);
    ctx.strokeStyle = isActive ? color : `${color}40`;
    ctx.lineWidth = isActive ? 2 : 1; ctx.stroke();

    // Label
    const lR = nodeR + dotR * 2.4;
    const lx = center + lR * Math.cos(angle);
    const ly = center + lR * Math.sin(angle);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${isActive ? 700 : 500} ${W * 0.036}px 'Outfit', sans-serif`;
    ctx.fillStyle = isActive ? color : 'rgba(255,255,255,0.3)';
    ctx.fillText(NOTE_NAMES[noteIdx], lx, ly);
  });
}
