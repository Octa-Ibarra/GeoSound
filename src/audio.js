/**
 * audio.js — Motor de síntesis de sonido con Web Audio API
 * Genera frecuencias pitagóricas exactas sin archivos externos
 */

let audioCtx = null;

function ensureCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Frecuencias de las 12 notas (C4 = Do4 = 261.63 Hz, temperamento igual)
export const NOTE_FREQUENCIES = [
  261.63, // 0  Do  (C4)
  277.18, // 1  Do# (C#4)
  293.66, // 2  Re  (D4)
  311.13, // 3  Re# (D#4)
  329.63, // 4  Mi  (E4)
  349.23, // 5  Fa  (F4)
  369.99, // 6  Fa# (F#4)
  392.00, // 7  Sol (G4)
  415.30, // 8  Sol#(G#4)
  440.00, // 9  La  (A4)
  466.16, // 10 La# (A#4)
  493.88, // 11 Si  (B4)
];

// Nombres de las notas en español
export const NOTE_NAMES = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];

// Colores de las notas
export const NOTE_COLORS = [
  '#FF6B9D', // Do  - rosa
  '#FF8A9D', // Do#
  '#FF9E64', // Re  - naranja
  '#FFB77A', // Re#
  '#FFD250', // Mi  - dorado
  '#A8FFB0', // Fa  - verde menta
  '#80FFCC', // Fa#
  '#7EB8FF', // Sol - azul cielo
  '#9AAEFF', // Sol#
  '#C4A8FF', // La  - violeta
  '#DDA8FF', // La#
  '#FF9ECA', // Si  - lila
];

/**
 * Toca una nota musical usando osciladores
 * @param {number} noteIndex - índice de 0 a 11
 * @param {number} duration  - duración en segundos
 * @param {number} volume    - 0.0 a 1.0
 * @param {string} type      - tipo de oscilador ('sine', 'triangle', 'sawtooth')
 */
export function playNote(noteIndex, duration = 1.2, volume = 0.5, type = 'sine') {
  const ctx = ensureCtx();
  const freq = NOTE_FREQUENCIES[noteIndex % 12];
  playFrequency(freq, duration, volume, type);
}

/**
 * Toca una frecuencia exacta (para el monocordio)
 */
export function playFrequency(freq, duration = 1.2, volume = 0.5, type = 'sine') {
  const ctx = ensureCtx();
  const now = ctx.currentTime;

  // Oscilador principal
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Añade un poco de armónico para riqueza de timbre
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc.connect(gain); gain.connect(ctx.destination);
  osc2.connect(gain2); gain2.connect(ctx.destination);

  osc.type = type;
  osc2.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  osc2.frequency.setValueAtTime(freq * 2, now); // octava arriba, más suave

  // Envolvente ADSR suave (tipo marimba/campana)
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(volume * 0.5, now + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(volume * 0.15, now + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);

  osc.start(now); osc.stop(now + duration + 0.05);
  osc2.start(now); osc2.stop(now + duration * 0.5 + 0.05);
}

/**
 * Toca un acorde (varias notas simultáneas)
 * @param {number[]} noteIndices
 */
export function playChord(noteIndices, duration = 1.8) {
  noteIndices.forEach((n, i) => {
    playNote(n, duration, 0.38);
  });
}

/**
 * Toca la proporción pitagórica del monocordio
 * @param {number} ratio - fracción de la cuerda (0.5 = octava, etc.)
 * @param {boolean} bothSegments - toca ambos segmentos en secuencia
 */
export function playMonochordRatio(ratio, segment = 'full') {
  const baseFreq = NOTE_FREQUENCIES[0]; // Do4

  if (segment === 'full') {
    playFrequency(baseFreq, 1.5, 0.5);
  } else if (segment === 'left') {
    // Segmento izquierdo = frecuencia de la nota base
    playFrequency(baseFreq, 1.5, 0.5);
  } else if (segment === 'right') {
    // Segmento derecho = frecuencia dividida (más aguda)
    playFrequency(baseFreq / ratio, 1.5, 0.5);
  } else if (segment === 'both') {
    // Ambos en secuencia para comparar
    playFrequency(baseFreq, 0.8, 0.5);
    setTimeout(() => playFrequency(baseFreq / ratio, 0.8, 0.5), 900);
  }
}

/**
 * Toca un arpegio de notas activas
 */
export function playArpeggio(noteIndices) {
  noteIndices.forEach((n, i) => {
    setTimeout(() => playNote(n, 0.8, 0.45), i * 200);
  });
}

/**
 * Efecto de éxito (celebración)
 */
export function playSuccess() {
  const ctx = ensureCtx();
  [0, 4, 7, 12].forEach((semitones, i) => {
    const freq = NOTE_FREQUENCIES[0] * Math.pow(2, semitones / 12);
    setTimeout(() => playFrequency(freq, 0.5, 0.35), i * 100);
  });
}

/**
 * Efecto de intento fallido
 */
export function playWrong() {
  const ctx = ensureCtx();
  playFrequency(150, 0.4, 0.25, 'sawtooth');
}

/**
 * Sintetizador de percusión básica para Modo Producción
 */
export function playKick(volume = 0.8) {
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Pitch envelope for kick
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);

  // Amp envelope for kick
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  osc.start(now);
  osc.stop(now + 0.5);
}

export function playSnare(volume = 0.7) {
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  
  // Tonal part of snare
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  
  osc.frequency.setValueAtTime(250, now);
  oscGain.gain.setValueAtTime(volume, now);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  
  osc.start(now);
  osc.stop(now + 0.2);

  // Noise part of snare
  const bufferSize = ctx.sampleRate * 0.2; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;
  
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noise.start(now);
}

export function playPerc(volume = 0.6) {
  // Woodblock / Clave synth
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Higher pitched envelope
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);

  // Fast decay
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  osc.start(now);
  osc.stop(now + 0.1);
}

export function playHihat(volume = 0.5) {
  const ctx = ensureCtx();
  const now = ctx.currentTime;
  
  // simple noise buffer for hihat
  const bufferSize = ctx.sampleRate * 0.1; // 100ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  
  // Bandpass filter to make it sound thin
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 10000;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
  
  noise.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);
  
  noise.start(now);
}
