import { registerModeHandlers } from './makey.js';
import { playKick, playHihat, playPerc, playSnare, playFrequency, playWrong } from './audio.js';
import { initGalaxy, destroyGalaxy, drawCometTrails } from './galaxy.js';
import { initBassScene, destroyBassScene, triggerBassImpact } from './bassScene.js';

const STATE = {
  currentStep: 0, // Inicia en 0: Selección de Nivel y Tonalidad
  difficulty: 'basico',
  rootNote: 0,
  scale: 'major',
  bpm: 120,
  rhythm: [[], [], [], []], // 4 Pistas ahora (Kick, Snare, Hihat, Perc)
  harmony: [], // Progresión a usar (por ahora simple array)
  bass: [],
  melody: []   
};

const NOTE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const RHYTHM_LABELS = { 0.5: '1/2', 0.25: '1/4', 0.125: '1/8', 0.0625: '1/16' };
const TOTAL_PROD_STEPS = 6;
const TRACKS = [
  { name: 'Bombo', short: 'Kick', player: playKick, color: '#67e8f9' },
  { name: 'Caja', short: 'Snare', player: playSnare, color: '#fb7185' },
  { name: 'HiHat', short: 'Hat', player: playHihat, color: '#facc15' },
  { name: 'Percusion', short: 'Perc', player: playPerc, color: '#a7f3d0' }
];
const GALAXY_KEYS = [
  { id: 'andromeda', name: 'Andromeda', note: 0, noteName: 'Do', tagline: 'centro estable', a: '#67e8f9', b: '#facc15' },
  { id: 'milky-way', name: 'Via Lactea', note: 2, noteName: 'Re', tagline: 'expansion clara', a: '#93c5fd', b: '#34d399' },
  { id: 'triangulum', name: 'Triangulum', note: 4, noteName: 'Mi', tagline: 'brillo angular', a: '#fbbf24', b: '#38bdf8' },
  { id: 'sombrero', name: 'Sombrero', note: 5, noteName: 'Fa', tagline: 'orbita profunda', a: '#f97316', b: '#fde68a' },
  { id: 'centaurus', name: 'Centaurus A', note: 7, noteName: 'Sol', tagline: 'gravedad heroica', a: '#22c55e', b: '#7dd3fc' },
  { id: 'messier', name: 'Messier 87', note: 9, noteName: 'La', tagline: 'pulso gigante', a: '#f472b6', b: '#facc15' }
];

function normalizeRhythmBlock(block) {
  if (typeof block === 'number') return { duration: block, rest: false };
  return {
    duration: Number(block?.duration || 0),
    rest: Boolean(block?.rest)
  };
}

function getRhythmDuration(block) {
  return normalizeRhythmBlock(block).duration;
}

function getTrackSum(track) {
  return track.reduce((sum, block) => sum + getRhythmDuration(block), 0);
}

function getFractionLabel(duration) {
  return RHYTHM_LABELS[duration] || duration;
}

function getRootLabel(rootNote = STATE.rootNote) {
  return NOTE_NAMES[rootNote % 12] || 'Do';
}

function getCurrentGalaxy() {
  return GALAXY_KEYS.find(galaxy => galaxy.note === STATE.rootNote) || GALAXY_KEYS[0];
}

function getScaleLabel() {
  return STATE.scale === 'minor' ? 'Menor' : 'Mayor';
}

function getBeatMs() {
  return 60000 / STATE.bpm;
}

function getMeasureMs() {
  return getBeatMs() * 4;
}

function getSongMs() {
  return getMeasureMs() * 8;
}

function getAbsoluteFreq(noteIndex, octave = 0) {
  return 261.63 * Math.pow(2, ((noteIndex % 12) + octave * 12) / 12);
}

function getBassSum() {
  return STATE.bass.reduce((sum, block) => sum + Number(block?.duration || 0), 0);
}

// Referencias del DOM
let prodScreen, stepContainer, btnNext, btnPrev, progressTitle, breadcrumbs;

// Variables y Estado para Step 1
let tapTimestamps = [];
let tapTimeout = null;
let melodyRecordTimeout = null;
let melodyRecordInterval = null;
let melodyPreviewTimeouts = [];
let melodyRecording = { active: false, startedAt: 0 };
let bassPreviewInterval = null;
let activeBassNote = null;

export function initProduction() {
  prodScreen = document.getElementById('screen-production');
  stepContainer = document.getElementById('prod-step-container');
  btnNext = document.getElementById('btn-prod-next');
  btnPrev = document.getElementById('btn-prod-prev');
  progressTitle = document.getElementById('prod-progress');
  breadcrumbs = document.querySelectorAll('.step-crumb');

  // Listeners de navegación de pasos
  if (btnNext) btnNext.addEventListener('click', goNextStep);
  if (btnPrev) btnPrev.addEventListener('click', goPrevStep);

  // Handlers Globales de Producción via Makey Makey
  registerModeHandlers('production', {
    Space: (phase) => {
      if (phase === 'down') handleProdAction('Space');
    },
    ArrowUp: (phase) => {
      if (phase === 'down') handleProdAction('ArrowUp');
    },
    ArrowRight: (phase) => {
      if (phase === 'down') handleProdAction('ArrowRight');
    },
    ArrowDown: (phase) => {
      if (phase === 'down') handleProdAction('ArrowDown');
    },
    ArrowLeft: (phase) => {
      if (phase === 'down') handleProdAction('ArrowLeft');
    },
  });

  // Inicializar Paso 0
  loadStep(0);
}

let activeHarmony = [];

function handleProdAction(key) {
  if (STATE.currentStep === 1 && key === 'Space') {
    handleTapPulse();
  } else if (STATE.currentStep === 2) {
    if (key === 'Space') {
      STATE.rhythm[activeTrack] = [];
      updateRhythmUI();
    } else if (key === 'ArrowUp') addFraction(0.5);
    else if (key === 'ArrowRight') addFraction(0.25);
    else if (key === 'ArrowDown') addFraction(0.125);
    else if (key === 'ArrowLeft') addFraction(0.0625);
  } else if (STATE.currentStep === 3) {
    if (key === 'Space') {
      activeHarmony = [];
      drawConstellationHarmony();
      updateProdHarmonyMath();
    } else if (key === 'ArrowUp') toggleProdHarmonyNote(0); // Do
    else if (key === 'ArrowRight') toggleProdHarmonyNote(4); // Mi
    else if (key === 'ArrowDown') toggleProdHarmonyNote(7); // Sol
    else if (key === 'ArrowLeft') toggleProdHarmonyNote(9); // La
  } else if (STATE.currentStep === 4) {
    if (key === 'Space') {
      if (melodyRecording.active) stopMelodyRecording(true);
      else startMelodyRecording();
    }
    // En galaxy.js ya está escuchando AWS... para las teclas de piano. 
    // Para makey makey (flechas):
    else {
      if (key === 'ArrowUp') window.touchGalaxyPlanet(0);
      else if (key === 'ArrowRight') window.touchGalaxyPlanet(4);
      else if (key === 'ArrowDown') window.touchGalaxyPlanet(7);
      else if (key === 'ArrowLeft') window.touchGalaxyPlanet(11);
    }
  } else if (STATE.currentStep === 5) {
    if (key === 'Space') {
      STATE.bass = [];
      updateBassUI();
    }
  }
}

function loadStep(stepNumber) {
  if (stepNumber !== 6 && isPlayingSong) stopProducerSong();
  STATE.currentStep = stepNumber;
  document.body.dataset.prodStep = String(stepNumber);
  
  // Update UI headers and crumbs
  progressTitle.textContent = stepNumber === 0 ? 'Preparacion orbital' : `Paso ${stepNumber} / ${TOTAL_PROD_STEPS}`;
  
  breadcrumbs.forEach(crumb => {
    const s = parseInt(crumb.dataset.step);
    if (s < stepNumber) {
      crumb.className = 'step-crumb completed';
    } else if (s === stepNumber) {
      crumb.className = 'step-crumb active';
    } else {
      crumb.className = 'step-crumb';
    }
  });

  // Controls visibility
  btnPrev.classList.toggle('hidden', stepNumber <= 1);
  if (stepNumber === 6) {
    btnNext.textContent = '🎶 Tocar Canción Final';
    btnNext.classList.add('primary-action');
    btnNext.disabled = false;
  } else if (stepNumber === 0) {
    btnNext.textContent = 'Comenzar Producción →';
    btnNext.classList.add('primary-action');
    btnNext.disabled = false;
  } else {
    btnNext.textContent = 'Siguiente →';
    btnNext.classList.remove('primary-action');
    btnNext.disabled = true; // Wait for step validation to enable
  }

  // Clear container
  stepContainer.innerHTML = '';
  
  // Limpieza de estado local de pasos (como Timeouts)
  if (tapTimeout) clearTimeout(tapTimeout);
  if (metronomeInterval) clearInterval(metronomeInterval);
  if (rhythmPreviewInterval) clearInterval(rhythmPreviewInterval);
  if (bassPreviewInterval) clearInterval(bassPreviewInterval);
  melodyPreviewTimeouts.forEach(clearTimeout);
  melodyPreviewTimeouts = [];
  if (melodyRecordInterval) clearInterval(melodyRecordInterval);
  if (melodyRecordTimeout) clearTimeout(melodyRecordTimeout);
  melodyRecording.active = false;
  if (typeof stopHarmonyAnim === 'function') stopHarmonyAnim();
  if (typeof destroyGalaxy === 'function') destroyGalaxy();
  if (typeof destroyBassScene === 'function') destroyBassScene();
  
  // Lógica per-step
  switch (stepNumber) {
    case 0: renderStep0(); break;
    case 1: renderStep1(); break;
    case 2: renderStep2(); break;
    case 3: renderStep3(); break;
    case 4: renderStep4(); break;
    case 5: renderStep5(); break;
    case 6: renderStep6(); break;
  }
}

function goNextStep() {
  if (STATE.currentStep === 4 && melodyRecording.active) return;
  if (STATE.currentStep === 4 && STATE.melody.some(note => note && note.valid === false)) {
    const ok = window.confirm('Hay notas fuera de la escala. El viaje espacial puede fallar. ¿Quieres seguir de todas formas?');
    if (!ok) return;
  }
  if (STATE.currentStep < 6) {
    // Si estamos en el paso 0, inicializar variables y ocultar UI breadcrumbs si no estaban
    loadStep(STATE.currentStep + 1);
  } else {
    playProducerSong();
  }
}

function goPrevStep() {
  if (STATE.currentStep > 1) loadStep(STATE.currentStep - 1);
  else if (STATE.currentStep === 1) loadStep(0);
}

// ----------------------------------------------------
// ---- PASO 0: CONFIGURACIÓN INICIAL
// ----------------------------------------------------
function renderStep0() {
  const currentGalaxy = getCurrentGalaxy();
  stepContainer.innerHTML = `
    <div class="prod-step-card studio-config-card slide-in">
      <div class="studio-config-center">
        <p class="eyebrow">Estudio orbital</p>
        <h3>Elige tu galaxia tonal</h3>
        <p>Cada galaxia fija una nota raiz. Despues puedes escoger si la orbita sonora sera mayor o menor.</p>
      </div>

      <div class="galaxy-selector" id="galaxy-selector">
        ${GALAXY_KEYS.map(galaxy => `
          <button class="galaxy-choice ${galaxy.note === STATE.rootNote ? 'active' : ''}" data-note="${galaxy.note}" style="--galaxy-a:${galaxy.a}; --galaxy-b:${galaxy.b};">
            <span class="galaxy-orb" aria-hidden="true"></span>
            <span class="galaxy-name">${galaxy.name}</span>
            <span class="galaxy-note">${galaxy.noteName}</span>
            <span class="galaxy-tagline">${galaxy.tagline}</span>
          </button>
        `).join('')}
      </div>

      <div class="studio-config-grid">
        <section class="glass-panel">
          <h4>Nivel academico</h4>
          <div class="pill-switch" id="difficulty-switch">
            <button class="${STATE.difficulty === 'basico' ? 'active' : ''}" data-difficulty="basico">Basico</button>
            <button class="${STATE.difficulty === 'avanzado' ? 'active' : ''}" data-difficulty="avanzado">Avanzado</button>
          </div>
          <p>Basico trabaja geometria y fracciones. Avanzado suma escalas, orbitas y relaciones exponenciales.</p>
        </section>

        <section class="glass-panel">
          <h4>Modo de escala</h4>
          <div class="pill-switch" id="scale-switch">
            <button class="${STATE.scale === 'major' ? 'active' : ''}" data-scale="major">Mayor</button>
            <button class="${STATE.scale === 'minor' ? 'active' : ''}" data-scale="minor">Menor</button>
          </div>
          <p><b>${currentGalaxy.name}</b> esta afinada en <b>${getRootLabel()}</b> ${getScaleLabel()}.</p>
        </section>
      </div>
    </div>
  `;

  document.querySelectorAll('#galaxy-selector .galaxy-choice').forEach(button => {
    button.addEventListener('click', () => {
      STATE.rootNote = Number(button.dataset.note);
      renderStep0();
    });
  });

  document.querySelectorAll('#difficulty-switch button').forEach(button => {
    button.addEventListener('click', () => {
      STATE.difficulty = button.dataset.difficulty;
      renderStep0();
    });
  });

  document.querySelectorAll('#scale-switch button').forEach(button => {
    button.addEventListener('click', () => {
      STATE.scale = button.dataset.scale;
      renderStep0();
    });
  });

  btnNext.disabled = false;
}

function renderStep0Legacy() {
  stepContainer.innerHTML = `
    <div class="prod-step-card slide-in">
      <h3>Configuración del Estudio</h3>
      <p>Bienvenido al Modo GUIADO. Antes de empezar, debemos configurar tu lienzo matemático.</p>
      
      <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
        <div style="flex: 1; min-width: 200px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
          <h4 style="color: var(--gold); margin-bottom: 10px;">🧠 Nivel de Dificultad Académica</h4>
          <label style="display: block; margin-bottom: 5px;">
            <input type="radio" name="prod-diff" value="basico" ${STATE.difficulty==='basico'?'checked':''} onchange="window.updateProdState('difficulty', this.value)"> 
            <b>Básico (7mo-8vo)</b> - Geometría, Fracciones
          </label>
          <label style="display: block;">
            <input type="radio" name="prod-diff" value="avanzado" ${STATE.difficulty==='avanzado'?'checked':''} onchange="window.updateProdState('difficulty', this.value)"> 
            <b>Avanzado (9no-11vo)</b> - Exponenciales, Trigonometría
          </label>
        </div>

        <div style="flex: 1; min-width: 200px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
          <h4 style="color: var(--gold); margin-bottom: 10px;">🎵 Tonalidad Principal</h4>
          <select style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px;" onchange="window.updateProdState('rootNote', parseInt(this.value))">
            <option value="0" ${STATE.rootNote===0?'selected':''}>Do (C)</option>
            <option value="2" ${STATE.rootNote===2?'selected':''}>Re (D)</option>
            <option value="4" ${STATE.rootNote===4?'selected':''}>Mi (E)</option>
            <option value="5" ${STATE.rootNote===5?'selected':''}>Fa (F)</option>
            <option value="7" ${STATE.rootNote===7?'selected':''}>Sol (G)</option>
            <option value="9" ${STATE.rootNote===9?'selected':''}>La (A)</option>
          </select>
          <select style="width: 100%; padding: 8px; border-radius: 4px;" onchange="window.updateProdState('scale', this.value)">
            <option value="major" ${STATE.scale==='major'?'selected':''}>Mayor (Luminoso)</option>
            <option value="minor" ${STATE.scale==='minor'?'selected':''}>Menor (Oscuro)</option>
          </select>
        </div>
      </div>
    </div>
  `;
  window.updateProdState = (key, val) => STATE[key] = val;
  btnNext.disabled = false;
}

// ----------------------------------------------------
// ---- PASO 1: EL CORAZÓN (TEMPO Y TASA)
// ----------------------------------------------------

// Variables locales para Metrónomo
let metronomeInterval = null;
let currentBeat = 0;

function renderStep1() {
  tapTimestamps = []; // Reiniciar tiempo
  if (metronomeInterval) clearInterval(metronomeInterval);

  stepContainer.innerHTML = `
    <div class="prod-step-card slide-in">
      <h3>El Corazón (Tempo)</h3>
      <p>Toda canción necesita un ritmo cardíaco constante. Presiona la <kbd>BARRA ESPACIADORA</kbd> de tu teclado o Makey Makey varias veces seguidas para establecer la velocidad en <i>Latidos Por Minuto (BPM)</i>.</p>
      
      <div class="tempo-display" id="tempo-display">
        <span class="bpm-value" id="bpm-value">${STATE.bpm}</span>
        <span class="bpm-label">BPM</span>
      </div>
      
      <p style="font-size: 0.9rem; margin-top: 10px; color: var(--text-dim)">(Mantén un pulso constante. Cuando te detengas, el metrónomo seguirá latiendo.)</p>
    </div>
  `;
  
  // Iniciar metrónomo por defecto
  startMetronome();
}

function startMetronome() {
  if (metronomeInterval) clearInterval(metronomeInterval);
  const msPerBeat = 60000 / STATE.bpm;
  
  currentBeat = 0;
  metronomeInterval = setInterval(() => {
    // Si el usuario está tocando (ha tocado en último segundo), no sonar para no estorbar
    const now = performance.now();
    if (tapTimestamps.length > 0 && now - tapTimestamps[tapTimestamps.length - 1] < 1500) {
      return; 
    }

    // Tocar Metrónomo
    if (currentBeat % 4 === 0) {
      playKick(0.7); // Fuerte en beat 1
    } else {
      playPerc(0.4); // Suave en beat 2, 3, 4
    }
    
    // Animate UI
    const display = document.getElementById('tempo-display');
    if (display) {
      display.style.transform = (currentBeat % 4 === 0) ? 'scale(1.1)' : 'scale(1.05)';
      display.style.borderColor = (currentBeat % 4 === 0) ? '#A8FFB0' : 'var(--gold)';
      setTimeout(() => {
        if (display) {
          display.style.transform = 'scale(1)';
          display.style.borderColor = 'var(--gold)';
        }
      }, 100);
    }
    
    currentBeat++;
  }, msPerBeat);
}

function handleTapPulse() {
  const now = performance.now();
  
  // Si han pasado más de 2 segundos desde el último tap, considerar esto un nuevo inicio
  if (tapTimestamps.length > 0 && now - tapTimestamps[tapTimestamps.length - 1] > 2000) {
    tapTimestamps = [];
  }
  
  tapTimestamps.push(now);

  // UI Feedback visual del Tap manual
  const display = document.getElementById('tempo-display');
  if (display) {
    display.classList.add('pulse');
    setTimeout(() => display.classList.remove('pulse'), 100);
  }

  if (tapTimestamps.length > 1) {
    // Calcular promedio de intervalos (en ms)
    let totalDx = 0;
    for (let i = 1; i < tapTimestamps.length; i++) {
        totalDx += (tapTimestamps[i] - tapTimestamps[i - 1]);
    }
    const avgDx = totalDx / (tapTimestamps.length - 1);
    
    // Tasa = 1 latido / avgDx ms. Convertir a latidos / minuto (60000 ms).
    const bpm = Math.round(60000 / avgDx);
    
    // Suavizar posibles resultados extremos
    const clampedBpm = Math.max(50, Math.min(220, bpm));
    
    document.getElementById('bpm-value').textContent = clampedBpm;
    STATE.bpm = clampedBpm;
    
    // Actualizar metrónomo instantáneamente
    startMetronome();
    
    // Aprobar paso 1 cuando tengamos 4 o más muestras estables
    if (tapTimestamps.length >= 4) {
      btnNext.disabled = false;
    }
  }
}

// ----------------------------------------------------
// ----  RESTO DE LOS PASOS (Mockups iniciales)
// ----------------------------------------------------

let activeTrack = 0;
let rhythmPreviewInterval = null;

function renderStep2() {
  if (!STATE.rhythm) STATE.rhythm = [[], [], [], []];

  stepContainer.innerHTML = `
    <div class="prod-step-card rhythm-step-card slide-in">
      <p class="eyebrow">Secuenciador de fracciones</p>
      <h3>Construye ritmo con golpes y silencios</h3>
      <p>Completa una unidad por pista. Usa silencios para dejar aire: por ejemplo, agrega un silencio de 1/4 antes de la caja para que entre en el segundo tiempo.</p>

      <div class="fraction-controls rhythm-tools">
        <div class="fraction-group">
          <span>Golpe</span>
          ${[0.5, 0.25, 0.125, 0.0625].map(value => `
            <button class="frac-btn" data-val="${value}" data-rest="false"><b>${getFractionLabel(value)}</b><small>sonido</small></button>
          `).join('')}
        </div>
        <div class="fraction-group rest-group">
          <span>Silencio</span>
          ${[0.5, 0.25, 0.125, 0.0625].map(value => `
            <button class="frac-btn rest" data-val="${value}" data-rest="true"><b>${getFractionLabel(value)}</b><small>silencio</small></button>
          `).join('')}
        </div>
        <button class="frac-btn alert" data-val="clear"><b>Vaciar</b><small>pista activa</small></button>
        <button class="frac-btn" data-val="undo"><b>Deshacer</b><small>ultimo bloque</small></button>
      </div>

      <div class="multitrack-container premium-tracks" id="multitrack-container"></div>

      <div class="producer-actions">
        <button class="btn-prod-nav" id="btn-preview-rhythm">Probar ritmo</button>
        <p>Tip: haz clic sobre un bloque para alternar entre golpe y silencio.</p>
      </div>
    </div>
  `;

  document.querySelectorAll('.frac-btn').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.val;
      if (value === 'clear') {
        STATE.rhythm[activeTrack] = [];
        updateRhythmUI();
        return;
      }
      if (value === 'undo') {
        STATE.rhythm[activeTrack].pop();
        updateRhythmUI();
        return;
      }
      addRhythmBlock(Number(value), button.dataset.rest === 'true');
    });
  });

  const btnPreview = document.getElementById('btn-preview-rhythm');
  if (btnPreview) {
    btnPreview.addEventListener('click', () => toggleRhythmPreview(btnPreview));
  }

  window.selectProdTrack = (idx) => {
    activeTrack = idx;
    updateRhythmUI();
  };
  window.toggleRhythmRest = (trackIdx, blockIdx) => {
    const block = normalizeRhythmBlock(STATE.rhythm[trackIdx][blockIdx]);
    STATE.rhythm[trackIdx][blockIdx] = { ...block, rest: !block.rest };
    if (block.rest) TRACKS[trackIdx].player(0.75);
    updateRhythmUI();
  };
  window.removeRhythmBlock = (trackIdx, blockIdx) => {
    STATE.rhythm[trackIdx].splice(blockIdx, 1);
    updateRhythmUI();
  };

  updateRhythmUI();
}

function renderStep2Legacy() {
  if (!STATE.rhythm) STATE.rhythm = [[], [], [], []];
  
  stepContainer.innerHTML = `
    <div class="prod-step-card slide-in">
      <h3>El Esqueleto (Fracciones Rítmicas)</h3>
      <p>Construye un ritmo usando fracciones matemáticas. Tienes 4 pistas. Selecciona una pista y suma fracciones hasta <b>completar 1 unidad (Un compás)</b> por pista.</p>
      
      <div class="fraction-controls">
        <button class="frac-btn" data-val="0.5"><b>1/2</b> <br>(Blanca)<br><small>↑</small></button>
        <button class="frac-btn" data-val="0.25"><b>1/4</b> <br>(Negra)<br><small>→</small></button>
        <button class="frac-btn" data-val="0.125"><b>1/8</b> <br>(Corchea)<br><small>↓</small></button>
        <button class="frac-btn" data-val="0.0625"><b>1/16</b> <br>(Semi)<br><small>←</small></button>
        <button class="frac-btn alert" data-val="clear"><b>Vaciar pista</b> <br><small>Espacio</small></button>
      </div>

      <div class="multitrack-container" id="multitrack-container" style="display:flex; flex-direction: column; gap:10px;">
        <!-- Tracks will be rendered here via updateRhythmUI -->
      </div>
      
      <div style="margin-top: 20px; text-align: center;">
        <button class="btn-prod-nav" id="btn-preview-rhythm" style="max-width: 300px; padding: 10px;">▶ Probar Ritmo</button>
      </div>
    </div>
  `;

  document.querySelectorAll('.frac-btn').forEach(b => {
    b.addEventListener('click', () => {
      const v = b.dataset.val;
      if (v === 'clear') { STATE.rhythm[activeTrack] = []; updateRhythmUI(); }
      else addFraction(parseFloat(v));
    });
  });

  const btnPreview = document.getElementById('btn-preview-rhythm');
  if (btnPreview) {
    btnPreview.addEventListener('click', () => toggleRhythmPreview(btnPreview));
  }

  // Make globals available
  window.selectProdTrack = (idx) => {
    activeTrack = idx;
    updateRhythmUI();
  };

  updateRhythmUI();
}

function toggleRhythmPreview(btn) {
  if (rhythmPreviewInterval) {
    clearInterval(rhythmPreviewInterval);
    rhythmPreviewInterval = null;
    btn.textContent = 'Probar ritmo';
    btn.classList.remove('primary-action');
    return;
  }

  btn.textContent = 'Detener ritmo';
  btn.classList.add('primary-action');

  const msPerBeat = 60000 / STATE.bpm;
  const msPerMeasure = msPerBeat * 4;

  const playPulse = () => {
    STATE.rhythm.forEach((track, idx) => {
      let currentMs = 0;
      track.forEach(rawBlock => {
        const block = normalizeRhythmBlock(rawBlock);
        if (!block.rest) {
          setTimeout(() => TRACKS[idx].player(1.0), currentMs);
        }
        currentMs += (block.duration * msPerMeasure);
      });
    });
  };

  playPulse();
  rhythmPreviewInterval = setInterval(playPulse, msPerMeasure);
}

function toggleRhythmPreviewLegacy(btn) {
  if (rhythmPreviewInterval) { // Stop
    clearInterval(rhythmPreviewInterval);
    rhythmPreviewInterval = null;
    btn.textContent = '▶ Probar Ritmo';
    btn.classList.remove('primary-action');
    return;
  }
  
  // Start
  btn.textContent = '⏹ Detener Ritmo';
  btn.classList.add('primary-action');
  
  const msPerBeat = 60000 / STATE.bpm;
  const msPerMeasure = msPerBeat * 4;
  let cycle = 0;
  
  const playPulse = () => {
    const playList = [playKick, playSnare, playHihat, playPerc];
    STATE.rhythm.forEach((track, i) => {
      let currentMs = 0;
      track.forEach(frac => {
        setTimeout(() => playList[i](1.0), currentMs);
        currentMs += (frac * msPerMeasure);
      });
    });
    cycle++;
  };
  
  playPulse(); // Play directly
  rhythmPreviewInterval = setInterval(playPulse, msPerMeasure);
}

function addFraction(val) {
  addRhythmBlock(val, false);
}

function addRhythmBlock(val, rest = false) {
  const sum = getTrackSum(STATE.rhythm[activeTrack]);
  if (Math.round((sum + val) * 1000) <= 1000) {
    STATE.rhythm[activeTrack].push({ duration: val, rest });
    if (!rest) TRACKS[activeTrack].player(1.0);
    updateRhythmUI();
  } else {
    const trackEl = document.getElementById('rt-' + activeTrack);
    if (trackEl) {
      trackEl.style.animation = 'shake 0.3s';
      setTimeout(() => trackEl.style.animation = '', 300);
    }
  }
}

function addFractionLegacy(val) {
  const sum = STATE.rhythm[activeTrack].reduce((a, b) => a + b, 0);
  if (Math.round((sum + val) * 1000) <= 1000) {
    STATE.rhythm[activeTrack].push(val);
    
    // Play sound on push
    const playList = [playKick, playSnare, playHihat, playPerc];
    playList[activeTrack](1.0);
    
    updateRhythmUI();
  } else {
    // Feedback visual
    const trackEl = document.getElementById('rt-' + activeTrack);
    if (trackEl) {
      trackEl.style.animation = 'shake 0.3s';
      setTimeout(() => trackEl.style.animation = '', 300);
    }
  }
}

function updateRhythmUI() {
  const container = document.getElementById('multitrack-container');
  if (!container) return;

  let allPerfect = true;
  container.innerHTML = '';

  STATE.rhythm.forEach((track, idx) => {
    const sum = getTrackSum(track);
    const formattedSum = parseFloat(sum.toFixed(4));
    if (formattedSum !== 1.0) allPerfect = false;

    const isActive = idx === activeTrack;
    const row = document.createElement('div');
    row.className = `rhythm-row ${isActive ? 'active' : ''}`;
    row.style.setProperty('--track-color', TRACKS[idx].color);

    row.innerHTML = `
      <button class="track-label" onclick="window.selectProdTrack(${idx})">
        <span>${TRACKS[idx].name}</span>
        <small>${TRACKS[idx].short}</small>
      </button>
      <div class="rhythm-track" id="rt-${idx}">
        ${track.map((rawBlock, blockIdx) => {
          const block = normalizeRhythmBlock(rawBlock);
          const label = getFractionLabel(block.duration);
          return `
            <button class="rhythm-block ${block.rest ? 'rest' : ''}" style="width: ${block.duration * 100}%;" onclick="window.toggleRhythmRest(${idx}, ${blockIdx})" title="Alternar golpe/silencio">
              <span>${block.rest ? 'Silencio' : label}</span>
              <small>${block.rest ? label : TRACKS[idx].short}</small>
            </button>
          `;
        }).join('')}
      </div>
      <div class="track-meter ${formattedSum === 1 ? 'complete' : ''}">
        <b>${formattedSum}</b><span>/1</span>
      </div>
    `;

    container.appendChild(row);
  });

  btnNext.disabled = !allPerfect;
}

function updateRhythmUILegacy() {
  const container = document.getElementById('multitrack-container');
  if (!container) return;
  
  const trackNames = ['Bombo (Kick)', 'Caja (Snare)', 'Platillo (Hihat)', 'Percusión'];
  let allPerfect = true;
  container.innerHTML = '';
  
  STATE.rhythm.forEach((track, idx) => {
    const sum = track.reduce((a, b) => a + b, 0);
    const formattedSum = parseFloat(sum.toFixed(4));
    if (formattedSum < 1.0) allPerfect = false;
    
    const isAct = idx === activeTrack;
    
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '15px';
    row.className = isAct ? 'slide-in' : '';
    
    row.innerHTML = `
      <div style="width: 140px; text-align: right;">
        <button style="width:100%; border-radius: 8px; border: 2px solid ${isAct ? 'var(--gold)' : 'rgba(255,255,255,0.2)'}; background: ${isAct ? 'rgba(255,210,80,0.1)' : 'rgba(0,0,0,0.4)'}; color: ${isAct ? 'var(--gold)' : '#fff'}; padding: 8px; cursor: pointer;" onclick="window.selectProdTrack(${idx})">
          ${trackNames[idx]}
        </button>
      </div>
      <div class="rhythm-track" id="rt-${idx}" style="flex:1; border-color: ${formattedSum === 1 ? '#A8FFB0' : (isAct ? 'var(--gold)' : 'var(--border)')}">
        ${track.map(val => `<div class="rhythm-block" style="width: ${val*100}%"><span>${val===0.5?'1/2':val===0.25?'1/4':val===0.125?'1/8':'1/16'}</span></div>`).join('')}
      </div>
      <div style="width: 60px; text-align: left; font-weight: bold; color: ${formattedSum === 1 ? '#A8FFB0' : 'var(--text-dim)'}">
        ${formattedSum}/1
      </div>
    `;
    container.appendChild(row);
  });
  
  btnNext.disabled = !allPerfect;
}

function renderStep3() {
  if (!STATE.harmony) STATE.harmony = [];
  activeHarmony = [];

  stepContainer.innerHTML = `
    <div class="prod-step-card harmony-step-card slide-in">
      <div class="harmony-hero">
        <div>
          <p class="eyebrow">Constelaciones armonicas</p>
          <h3>Disena acordes como geometria orbital</h3>
          <p>Selecciona minimo tres estrellas. El sistema calcula los angulos y convierte cada constelacion en un clip de armonia.</p>
        </div>
        <div class="harmony-meter">
          <span>Linea armonica</span>
          <b id="harmony-sum-text">0 / 8 Compases</b>
        </div>
      </div>

      <div class="harmony-progress-shell">
        <div id="progression-track" class="progression-track"></div>
      </div>

      <div class="harmony-workbench">
        <div class="harmony-canvas-shell">
          <canvas id="prod-chromatic-canvas" width="520" height="520"></canvas>
          <div class="harmony-canvas-caption">
            <b>Cielo cromatico</b>
            <span>Toca las estrellas para activar notas. Barra espaciadora limpia la constelacion actual.</span>
          </div>
        </div>
        <aside class="harmony-inspector glass-panel">
          <h4>Inspector de acorde</h4>
          <ul id="prod-angles-list" class="angle-list"><li>--</li></ul>
          <p id="prod-harmony-msg">Selecciona minimo 3 notas.</p>
          <div id="harmony-fraction-controls" class="harmony-duration-controls">
             <button class="frac-btn" onclick="saveActiveChord(4.0)"><b>4</b><small>compases</small></button>
             <button class="frac-btn" onclick="saveActiveChord(2.0)"><b>2</b><small>compases</small></button>
             <button class="frac-btn" onclick="saveActiveChord(1.0)"><b>1</b><small>compas</small></button>
             <button class="frac-btn" onclick="saveActiveChord(0.5)"><b>0.5</b><small>compas</small></button>
          </div>
          <div id="active-harmony-notes" class="active-harmony-notes"></div>
        </aside>
      </div>
    </div>
  `;

  window.saveActiveChord = (duration) => {
    const sum = STATE.harmony.reduce((total, chord) => total + chord.duration, 0);
    if (activeHarmony.length < 3 || sum + duration > 8) return;
    STATE.harmony.push({ notes: [...activeHarmony].sort((a, b) => a - b), duration });
    activeHarmony = [];
    updateProgressionUI();
    updateProdHarmonyMath();
  };
  window.removeSavedChord = (idx) => {
    STATE.harmony.splice(idx, 1);
    updateProgressionUI();
    updateProdHarmonyMath();
  };

  const canvas = document.getElementById('prod-chromatic-canvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * sx;
      const cy = (e.clientY - rect.top) * sy;
      const center = canvas.width / 2;
      const radius = canvas.width * 0.34;

      for (let i = 0; i < 12; i++) {
        const nx = center + radius * Math.cos((i * 30 - 90) * Math.PI / 180);
        const ny = center + radius * Math.sin((i * 30 - 90) * Math.PI / 180);
        if (Math.hypot(cx - nx, cy - ny) < 28) {
          toggleProdHarmonyNote(i);
          break;
        }
      }
    });

    if (!window.harmonyAnimFrame) {
      const animLoop = () => {
        drawConstellationHarmony();
        window.harmonyAnimFrame = requestAnimationFrame(animLoop);
      };
      window.harmonyAnimFrame = requestAnimationFrame(animLoop);
    }
  }

  updateProgressionUI();
  updateProdHarmonyMath();
}

function renderStep3Legacy() {
  if (!STATE.harmony) STATE.harmony = [];
  activeHarmony = []; // Reset visual
  
  stepContainer.innerHTML = `
    <div class="prod-step-card slide-in">
      <h3>El Espacio (Progresión Armónica)</h3>
      <p><i>Harmonices Mundi (1619)</i>: Kepler unió la geometría con el firmamento. Une estrellas (notas) en el círculo para formar acordes geométricos (Tríadas o Tétradas). Usa los botones para decidir cuánto tiempo quieres que suene en tu lienzo de <b>8 compases</b>.</p>
      
      <!-- Harmony Progression Track -->
      <div style="background: rgba(0,0,0,0.5); border-radius: 8px; padding: 10px; margin: 15px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--gold); margin-bottom: 5px;">
           <span>Duración de Armonía</span>
           <span id="harmony-sum-text">0 / 8 Compases</span>
        </div>
        <div id="progression-track" style="display: flex; height: 30px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; background: rgba(0,0,0,0.4); position: relative;">
          <!-- Bloques here -->
        </div>
      </div>
      
      <div style="display: flex; gap: 20px; align-items: center; margin-top: 10px;">
        <div style="flex: 1; display: flex; justify-content: center; position: relative;">
          <canvas id="prod-chromatic-canvas" width="300" height="300" style="background: radial-gradient(circle at center, #0B0B1A 0%, #000 100%); border-radius: 50%; box-shadow: 0 0 30px rgba(126,184,255,0.2);"></canvas>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
          <h4 style="color: var(--gold); margin-bottom: 10px;">Ángulos del Polígono:</h4>
          <ul id="prod-angles-list" style="list-style: none; padding: 0; font-size: 1.1rem; display: flex; flex-direction: column; gap: 5px;">
            <li class="angle-item">--</li>
          </ul>
          <p id="prod-harmony-msg" style="margin-top: 10px; font-weight: bold; color: var(--text-dim); font-size: 0.9rem;">Faltan notas... (Mínimo 3)</p>
          
          <div id="harmony-fraction-controls" style="display: none; flex-direction: row; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
             <button class="frac-btn" onclick="saveActiveChord(4.0)"><b>4</b><br>Compases</button>
             <button class="frac-btn" onclick="saveActiveChord(2.0)"><b>2</b><br>Compases</button>
             <button class="frac-btn" onclick="saveActiveChord(1.0)"><b>1</b><br>Compás</button>
             <button class="frac-btn" onclick="saveActiveChord(0.5)"><b>0.5</b><br>Compás</button>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 10px; text-align: center;">
        <p style="font-size: 0.85rem; color: var(--text-dim);">Selecciona notas tocando el cielo estrellado. Borra con <kbd>Espacio</kbd>.</p>
      </div>
    </div>
  `;

  window.saveActiveChord = (durFrac) => {
    // durFrac in measures (compases). 
    let measureFrac = durFrac;
    
    const sum = STATE.harmony.reduce((a, b) => a + b.duration, 0);
    if (sum + measureFrac > 8) {
       alert("¡La pista de armonía está completa (Max 8 Compases)!");
       return;
    }
    
    // Save chord object
    STATE.harmony.push({
      notes: [...activeHarmony],
      duration: measureFrac
    });
    
    activeHarmony = [];
    updateProgressionUI();
    updateProdHarmonyMath();
  };



  const canvas = document.getElementById('prod-chromatic-canvas');
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * sx;
      const cy = (e.clientY - rect.top) * sy;

      const center = canvas.width / 2;
      const radius = canvas.width * 0.34;
      for (let i = 0; i < 12; i++) {
        const nx = center + radius * Math.cos((i * 30 - 90) * Math.PI / 180);
        const ny = center + radius * Math.sin((i * 30 - 90) * Math.PI / 180);
        if (Math.hypot(cx - nx, cy - ny) < 25) {
          toggleProdHarmonyNote(i);
          break;
        }
      }
    });

    // Start animation loop for harmony
    if (!window.harmonyAnimFrame) {
      const animLoop = () => {
        drawConstellationHarmony();
        window.harmonyAnimFrame = requestAnimationFrame(animLoop);
      };
      window.harmonyAnimFrame = requestAnimationFrame(animLoop);
    }
    updateProgressionUI();
  }
}

function stopHarmonyAnim() {
  if (window.harmonyAnimFrame) {
    cancelAnimationFrame(window.harmonyAnimFrame);
    window.harmonyAnimFrame = null;
  }
}

function updateProgressionUI() {
  const track = document.getElementById('progression-track');
  const sumText = document.getElementById('harmony-sum-text');
  if (!track || !sumText) return;

  track.innerHTML = '';
  const sum = STATE.harmony.reduce((total, chord) => total + chord.duration, 0);
  sumText.textContent = `${sum} / 8 Compases`;

  if (STATE.harmony.length === 0) {
    track.innerHTML = '<div class="empty-progression">Agrega acordes para construir la linea armonica.</div>';
  }

  STATE.harmony.forEach((chordInfo, idx) => {
    const widthPct = (chordInfo.duration / 8) * 100;
    const slot = document.createElement('button');
    slot.className = 'progression-clip';
    slot.style.width = widthPct + '%';
    slot.innerHTML = `
      <span>Acorde ${idx + 1}</span>
      <small>${chordInfo.notes.map(note => NOTE_NAMES[note]).join(' - ')} · ${chordInfo.duration}c</small>
    `;
    slot.addEventListener('click', () => window.removeSavedChord(idx));
    track.appendChild(slot);
  });

  btnNext.disabled = STATE.harmony.length < 2 || sum <= 0;
}

function updateProgressionUILegacy() {
  const track = document.getElementById('progression-track');
  const sumText = document.getElementById('harmony-sum-text');
  if (!track) return;
  track.innerHTML = '';
  
  const sum = STATE.harmony.reduce((a, b) => a + b.duration, 0);
  sumText.textContent = `${sum} / 8 Compases`;
  
  let currentAccum = 0;
  STATE.harmony.forEach((chordInfo, i) => {
    const widthPct = (chordInfo.duration / 8) * 100; // 8 compases is 100% width
    const slot = document.createElement('div');
    slot.style.width = widthPct + '%';
    slot.style.height = '100%';
    slot.style.borderRight = '1px solid rgba(255,255,255,0.2)';
    slot.style.background = `rgba(${Math.sin(i)*50 + 100}, 210, ${Math.cos(i)*100+150}, 0.4)`;
    slot.style.display = 'flex';
    slot.style.alignItems = 'center';
    slot.style.justifyContent = 'center';
    slot.style.fontSize = '0.7rem';
    slot.style.fontWeight = 'bold';
    slot.textContent = `A${i+1}`;
    track.appendChild(slot);
    currentAccum += chordInfo.duration;
  });
  
  // They must place at least 2 chords
  btnNext.disabled = STATE.harmony.length < 2;
}

function toggleProdHarmonyNote(note) {
  const idx = activeHarmony.indexOf(note);
  if (idx > -1) activeHarmony.splice(idx, 1);
  else if (activeHarmony.length < 4) activeHarmony.push(note); // Allow up to 4 note chords
  
  // Toca la nota
  const freq = 261.63 * Math.pow(2, (STATE.rootNote + note) / 12);
  playFrequency(freq, 0.4, 0.4, 'sine');
  
  updateProdHarmonyMath();
}

function drawConstellationHarmony() {
  const canvas = document.getElementById('prod-chromatic-canvas');
  if (!canvas) { stopHarmonyAnim(); return; }
  const ctx = canvas.getContext('2d');
  const time = performance.now();
  const width = canvas.width;
  const height = canvas.height;
  const center = width / 2;
  const radius = Math.min(width, height) * 0.34;
  const rootGalaxy = getCurrentGalaxy();

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createRadialGradient(center, center, 0, center, center, width * 0.56);
  bg.addColorStop(0, 'rgba(103, 232, 249, 0.16)');
  bg.addColorStop(0.32, 'rgba(15, 23, 42, 0.78)');
  bg.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Nebulosa espiral, más cercana al look de partículas del hero.
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(time / 14000);
  for (let i = 0; i < 520; i++) {
    const arm = i % 4;
    const t = i / 520;
    const angle = t * Math.PI * 7.5 + arm * Math.PI / 2;
    const r = 8 + t * radius * 1.25 + Math.sin(i * 1.7 + time / 900) * 5;
    const spread = Math.sin(i * 12.9898) * 16;
    const x = Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * spread;
    const y = Math.sin(angle) * r * 0.58 + Math.sin(angle + Math.PI / 2) * spread * 0.35;
    const alpha = 0.05 + (1 - t) * 0.22;
    ctx.fillStyle = i % 3 === 0 ? `rgba(250,204,21,${alpha})` : `rgba(103,232,249,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 1.8 : 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (let ring = 1; ring <= 3; ring++) {
    ctx.beginPath();
    ctx.arc(center, center, radius * (ring / 3), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(103, 232, 249, ${0.07 + ring * 0.035})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 10]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const halo = ctx.createRadialGradient(center, center, 0, center, center, 42);
  halo.addColorStop(0, 'rgba(255,255,255,0.9)');
  halo.addColorStop(0.28, rootGalaxy.a);
  halo.addColorStop(1, 'rgba(103,232,249,0)');
  ctx.fillStyle = halo;
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(center, center, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Draw Constellation (Polygon)
  if (activeHarmony.length >= 2) {
    const points = [...activeHarmony].sort((a,b)=>a-b).map(n => ({
      x: center + radius * Math.cos((n * 30 - 90) * Math.PI / 180),
      y: center + radius * Math.sin((n * 30 - 90) * Math.PI / 180)
    }));
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1; i<points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if(activeHarmony.length >= 3) ctx.closePath();
    
    const lineGrad = ctx.createLinearGradient(0, 0, width, height);
    lineGrad.addColorStop(0, 'rgba(103, 232, 249, 0.96)');
    lineGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.9)');
    lineGrad.addColorStop(1, 'rgba(167, 243, 208, 0.96)');
    ctx.strokeStyle = lineGrad;
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 22;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(103, 232, 249, 0.12)';
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  }

  // Overlay Constellation Art if valid
  const isChord = activeHarmony.length >= 3;
  if (isChord) {
     ctx.save();
     ctx.translate(center, center);
     ctx.rotate(time / 8000);
     ctx.beginPath();
     // Determine constellation type roughly by size / edges!
     const angles = calculateActiveHarmonyAngles();
     const isMajor = angles.includes(45); // e.g. major/minor typical
     
     // Procedural Real Constellation Graphic (Abstracted to connected web)
     // Draws lines behind the polygon resembling star maps
     const webPts = isMajor ? [[-30, -50], [10, -20], [-40, 40], [50, 40], [20, 70]] 
                            : [[-50, 0], [-20, 20], [0, 60], [40, 20], [50, -40]];
                            
     ctx.moveTo(webPts[0][0], webPts[0][1]);
     for(let i=1; i<webPts.length; i++) ctx.lineTo(webPts[i][0], webPts[i][1]);
     
     ctx.lineWidth = 1;
     ctx.strokeStyle = 'rgba(126,184,255,0.4)';
     ctx.setLineDash([3,3]);
     ctx.stroke();
     ctx.setLineDash([]);
     
     // Draw mystical text
     ctx.restore();
     ctx.fillStyle = 'rgba(126,184,255,0.8)';
     ctx.font = '12px Outfit';
     ctx.textAlign = 'center';
     const conName = isMajor ? 'Constelación: Osa Mayor' : 'Constelación: Cassiopeia';
     ctx.fillText(conName, center, center + 70 + Math.sin(time/300)*5);
  }

  // Draw Nodes (Main Stars)
  for (let i = 0; i < 12; i++) {
    const nx = center + radius * Math.cos((i * 30 - 90) * Math.PI / 180);
    const ny = center + radius * Math.sin((i * 30 - 90) * Math.PI / 180);
    const isActive = activeHarmony.includes(i);
    
    ctx.beginPath();
    ctx.arc(nx, ny, isActive ? 10 : 5, 0, Math.PI*2);
    
    // Custom star glow
    if (isActive) {
      const grad = ctx.createRadialGradient(nx, ny, 1, nx, ny, 24);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.35, 'rgba(250, 204, 21, 0.9)');
      grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
      ctx.fillStyle = grad;
      ctx.arc(nx, ny, 22, 0, Math.PI*2);
    } else {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.62)';
    }
    
    ctx.fill();

    ctx.shadowBlur = isActive ? 18 : 0;
    ctx.shadowColor = isActive ? '#facc15' : 'transparent';
    ctx.fillStyle = isActive ? '#020617' : 'rgba(248,250,252,0.88)';
    ctx.font = '700 12px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(NOTE_NAMES[i], nx, ny + (isActive ? 0 : 22));
    ctx.shadowBlur = 0;
  }
}

function calculateActiveHarmonyAngles() {
  if (activeHarmony.length < 3) return [];
  const sorted = [...activeHarmony].sort((a,b)=>a-b);
  const angles = [];
  for (let i = 0; i < 3; i++) {
    const prev = sorted[(i - 1 + 3) % 3];
    const next = sorted[(i + 1) % 3];
    const arcSteps = (prev - next + 12) % 12;
    angles.push(arcSteps * 15);
  }
  return angles.sort((a,b)=>a-b);
}

function updateProdHarmonyMath() {
  const list = document.getElementById('prod-angles-list');
  const msg = document.getElementById('prod-harmony-msg');
  const saveControls = document.getElementById('harmony-fraction-controls');
  const noteDisplay = document.getElementById('active-harmony-notes');
  if(!list || !msg || !saveControls) return;
  
  saveControls.style.display = 'none';
  if (noteDisplay) {
    noteDisplay.innerHTML = activeHarmony.map(note => `<span>${NOTE_NAMES[note]}</span>`).join('');
  }

  if (activeHarmony.length < 3) {
    list.innerHTML = '<li class="angle-item">--</li>';
    msg.textContent = 'Selecciona 3 notas en el círculo.';
    msg.style.color = 'var(--text-dim)';
    return;
  }
  
  // Calcular ángulos inscritos para los 3 puntos
  const sorted = [...activeHarmony].sort((a,b)=>a-b);
  const angles = [];
  
  for (let i = 0; i < 3; i++) {
    const prev = sorted[(i - 1 + 3) % 3];
    const next = sorted[(i + 1) % 3];
    const arcSteps = (prev - next + 12) % 12;
    angles.push(arcSteps * 15);
  }
  
  // Sort angles for comparison
  const calculated = calculateActiveHarmonyAngles();
  if (calculated.length < 3) return;
  
  list.innerHTML = calculated.map(a => `<li>${a}°</li>`).join('');
  
  // Target is [45, 60, 75]
  if (calculated[0] === 45 && calculated[1] === 60 && calculated[2] === 75) {
    msg.textContent = '¡CONSONANCIA MÁGICA! Constelación formada ✓';
    msg.style.color = '#A8FFB0';
    saveControls.style.display = 'flex';
  } else {
    msg.textContent = 'Acorde valido. Ajusta su duracion y guardalo en la linea armonica.';
    msg.style.color = '#7EB8FF';
    saveControls.style.display = 'flex';
  }
}

function renderStep4() {
  if (!STATE.melody) STATE.melody = [];
  const galaxy = getCurrentGalaxy();
  const keyLegend = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J']
    .map((key, note) => {
      const active = getScaleNotes().includes(note);
      return `<span class="melody-key ${active ? 'active' : 'muted'}"><b>${key}</b><small>${NOTE_NAMES[note]}</small></span>`;
    })
    .join('');
  document.body.style.background = 'transparent';

  stepContainer.innerHTML = `
    <div id="galaxy-container" class="melody-galaxy-stage" aria-hidden="true"></div>
    <div class="prod-step-card melody-step-card slide-in">
      <div class="melody-panel-copy">
        <p class="eyebrow">Melodia galactica</p>
        <h3>Navega ${galaxy.name}</h3>
        <p>Graba una toma libre de <b>8 compases</b> mientras suenan ritmo y armonia. Puedes tocar cualquier nota; si una estrella cae fuera de la escala, se guarda igual y te avisamos antes del salto.</p>
      </div>

      <div class="melody-dashboard">
        <div>
          <span>Escala activa</span>
          <b>${getRootLabel()} ${getScaleLabel()}</b>
        </div>
        <div>
          <span>Eventos</span>
          <b id="melody-count">${STATE.melody.length}</b>
        </div>
        <button class="frac-btn" id="btn-melody-record"><b>${melodyRecording.active ? 'Detener' : 'Grabar'}</b><small>8 compases</small></button>
        <button class="frac-btn secondary" id="btn-melody-base"><b>Base</b><small>escuchar</small></button>
        <button class="frac-btn alert" id="btn-melody-clear"><b>Borrar</b><small>toma</small></button>
      </div>

      <div class="melody-record-meter"><div id="melody-record-progress"></div></div>
      <div class="melody-record-status" id="melody-record-status">Listo para grabar una toma libre.</div>
      <div class="melody-track premium-melody-track melody-free-track" id="melody-track"></div>
      <div class="melody-keyboard-map">
        ${keyLegend}
      </div>
      <div id="melody-error-msg" class="melody-error-msg">Nota fuera de la escala: se guardo, pero puede desviar el viaje.</div>
    </div>
  `;

  window.touchGalaxyPlanet = touchGalaxyPlanet;
  document.getElementById('btn-melody-record')?.addEventListener('click', () => {
    if (melodyRecording.active) stopMelodyRecording(true);
    else startMelodyRecording();
  });
  document.getElementById('btn-melody-base')?.addEventListener('click', playMelodyBacking);
  document.getElementById('btn-melody-clear')?.addEventListener('click', () => {
    STATE.melody = [];
    updateProdMelodyUI();
  });
  initGalaxy('galaxy-container', STATE.rootNote, STATE.scale);
  updateProdMelodyUI();
}

function playMelodyBacking() {
  melodyPreviewTimeouts.forEach(clearTimeout);
  melodyPreviewTimeouts = [];
  scheduleRhythmLoop(melodyPreviewTimeouts, 8);
  scheduleHarmonyTimeline(melodyPreviewTimeouts);
}

function startMelodyRecording() {
  STATE.melody = [];
  melodyRecording = { active: true, startedAt: performance.now() };
  playMelodyBacking();
  const totalMs = getSongMs();
  const status = document.getElementById('melody-record-status');
  const progress = document.getElementById('melody-record-progress');
  const recordBtn = document.getElementById('btn-melody-record');
  if (recordBtn) recordBtn.innerHTML = '<b>Detener</b><small>grabacion</small>';
  if (status) status.textContent = 'Grabando toma libre sobre la base...';
  if (progress) progress.style.width = '0%';

  melodyRecordInterval = setInterval(() => {
    if (!melodyRecording.active) return;
    const elapsed = performance.now() - melodyRecording.startedAt;
    if (progress) progress.style.width = `${Math.min(100, (elapsed / totalMs) * 100)}%`;
  }, 60);

  melodyRecordTimeout = setTimeout(() => stopMelodyRecording(true), totalMs);
  updateProdMelodyUI();
}

function stopMelodyRecording(finished = false) {
  if (melodyRecordInterval) clearInterval(melodyRecordInterval);
  if (melodyRecordTimeout) clearTimeout(melodyRecordTimeout);
  melodyRecordInterval = null;
  melodyRecordTimeout = null;
  melodyRecording.active = false;
  const recordBtn = document.getElementById('btn-melody-record');
  const status = document.getElementById('melody-record-status');
  const progress = document.getElementById('melody-record-progress');
  if (recordBtn) recordBtn.innerHTML = '<b>Grabar</b><small>8 compases</small>';
  if (status) status.textContent = finished ? `Toma lista: ${STATE.melody.length} eventos.` : 'Grabacion detenida.';
  if (progress && finished) progress.style.width = '100%';
  updateProdMelodyUI();
}

function renderStep4Legacy() {
  if (!STATE.melody) STATE.melody = [];
  
  // Hacemos el fondo general transparente temporalmente
  document.body.style.background = 'transparent';
  
  stepContainer.innerHTML = `
    <div id="galaxy-container" aria-hidden="true"></div>
    <div class="prod-step-card slide-in" style="background: rgba(0,0,0,0.4); backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.1); max-width: 800px;">
      <h3>La Melodía de las Esferas (NASA Eyes mode)</h3>
      <p style="color: #A8FFB0;">Kepler asignó notas a los astros según sus órbitas. Estás flotando en un sistema solar 3D generado en tiempo real. Usa el <b>Teclado (A W S E D F...)</b> como un piano para capturar notas planetarias.</p>
      
      <div style="margin-top: 15px;">
        <div class="melody-track" id="melody-track" style="display: flex; flex-wrap: wrap; gap: 10px; background: rgba(0,0,0,0.6); border-radius: 12px; padding: 15px; min-height: 80px; justify-content: center;">
          <!-- Notas grabadas -->
        </div>
        <div style="text-align: center; margin-top: 15px;">
          <button class="frac-btn alert" onclick="clearProdMelody()" style="display: inline-block; padding: 8px 20px;">Borrar Cometas</button>
        </div>
      </div>
      <div id="melody-error-msg" style="margin-top: 15px; color: #FF6B9D; font-weight: bold; opacity: 0; transition: opacity 0.3s; text-align: center;">¡Nota fuera de la escala armónica!</div>
    </div>
  `;
  
  window.clearProdMelody = () => { STATE.melody = []; updateProdMelodyUI(); };
  
  // Window exposure for galaxy.js to call back
  window.touchGalaxyPlanet = touchGalaxyPlanet;
  
  // Initialize Three.js Fullscreen
  initGalaxy('galaxy-container', STATE.rootNote, STATE.scale, touchGalaxyPlanet);

  updateProdMelodyUI();
}

function getScaleNotes() {
  const scaleOffsets = STATE.scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return scaleOffsets.map(note => (note + STATE.rootNote) % 12);
}

function touchGalaxyPlanet(noteIndex) {
  const allowed = getScaleNotes();
  const octaveShift = STATE.difficulty === 'avanzado' ? 1 : 0;
  const normalizedNote = ((noteIndex % 12) + 12) % 12;
  const inScale = allowed.includes(normalizedNote);
  const freq = getAbsoluteFreq(normalizedNote, octaveShift);

  playFrequency(freq, 0.32, inScale ? 0.5 : 0.26, inScale ? 'sine' : 'square');

  if (!inScale) {
    const msg = document.getElementById('melody-error-msg');
    if (msg) {
      msg.style.opacity = 1;
      setTimeout(() => { msg.style.opacity = 0; }, 1400);
    }
  }

  if (!melodyRecording.active) return;
  const elapsed = performance.now() - melodyRecording.startedAt;
  if (elapsed < 0 || elapsed > getSongMs()) return;

  STATE.melody.push({
    time: elapsed,
    noteIndex: normalizedNote,
    freq,
    name: NOTE_NAMES[normalizedNote],
    valid: inScale,
    duration: Math.max(180, getBeatMs() * 0.42)
  });
  STATE.melody.sort((a, b) => a.time - b.time);
  if (STATE.melody.length > 96) STATE.melody = STATE.melody.slice(-96);
  updateProdMelodyUI();
}

function updateProdMelodyUI() {
  const track = document.getElementById('melody-track');
  if (!track) return;
  const melodyCount = STATE.melody.length;
  const invalidCount = STATE.melody.filter(note => !note.valid).length;
  const counter = document.getElementById('melody-count');
  const progress = document.getElementById('melody-record-progress');
  if (counter) counter.textContent = invalidCount ? `${melodyCount} · ${invalidCount} fuera` : `${melodyCount}`;
  if (progress && !melodyRecording.active && melodyCount === 0) progress.style.width = '0%';

  track.innerHTML = `
    <div class="melody-ruler">
      ${Array.from({ length: 8 }, (_, idx) => `<span>Compas ${idx + 1}</span>`).join('')}
    </div>
    <div class="melody-lane">
      ${STATE.melody.map((note, idx) => `
        <button class="melody-note-chip ${note.valid ? '' : 'invalid'}"
          style="left:${Math.min(96, (note.time / getSongMs()) * 100)}%; top:${10 + ((11 - note.noteIndex) * 4.8)}%;"
          onclick="window.removeMelodyEvent(${idx})">
          <b>${note.name}</b>
        </button>
      `).join('')}
    </div>
  `;

  window.removeMelodyEvent = (idx) => {
    STATE.melody.splice(idx, 1);
    updateProdMelodyUI();
  };

  btnNext.disabled = melodyRecording.active || melodyCount === 0;
  if (typeof drawCometTrails === 'function') {
    drawCometTrails(STATE.melody);
  }
}

function renderDawRhythmBlocks(track, trackIdx) {
  if (!track.length) return '<div class="daw-empty">Sin bloques</div>';
  return track.map((rawBlock, blockIdx) => {
    const block = normalizeRhythmBlock(rawBlock);
    return `
      <button class="daw-clip ${block.rest ? 'rest' : ''}" style="width:${block.duration * 100}%;" onclick="window.toggleDawRhythmBlock(${trackIdx}, ${blockIdx})">
        <b>${block.rest ? 'Silencio' : TRACKS[trackIdx].short}</b>
        <small>${getFractionLabel(block.duration)}</small>
      </button>
    `;
  }).join('');
}

function renderDawHarmonyBlocks() {
  if (!STATE.harmony.length) return '<div class="daw-empty">Sin acordes guardados</div>';
  return STATE.harmony.map((chord, idx) => `
    <button class="daw-clip harmony" style="width:${(chord.duration / 8) * 100}%;" onclick="window.removeDawChord(${idx})">
      <b>Acorde ${idx + 1}</b>
      <small>${chord.notes.map(note => NOTE_NAMES[note]).join('-')} · ${chord.duration}c</small>
    </button>
  `).join('');
}

function renderDawBassBlocks() {
  if (!STATE.bass.length) return '<div class="daw-empty">Sin impactos</div>';
  return STATE.bass.map((block, idx) => `
    <button class="daw-clip bass ${block.rest ? 'rest' : ''}" style="width:${block.duration * 100}%;" onclick="window.toggleDawBassBlock(${idx})">
      <b>${block.rest ? 'Silencio' : NOTE_NAMES[block.noteIndex]}</b>
      <small>${getFractionLabel(block.duration)}</small>
    </button>
  `).join('');
}

function renderDawMelodyClips() {
  if (!STATE.melody.length) return '<div class="daw-empty">Sin toma melodica</div>';
  return `
    <div class="daw-melody-lane">
      ${STATE.melody.map(note => `
        <span class="daw-note-chip ${note.valid ? '' : 'invalid'}" style="left:${Math.min(96, (note.time / getSongMs()) * 100)}%; top:${10 + ((11 - note.noteIndex) * 5)}%;">
          ${note.name}
        </span>
      `).join('')}
    </div>
  `;
}

function playBassImpact(noteIndex, duration = 0.25, volume = 0.48) {
  const seconds = Math.max(0.14, duration * getMeasureMs() / 1000 * 0.92);
  playFrequency(getAbsoluteFreq(noteIndex, -2), seconds, volume, 'triangle');
  setTimeout(() => playFrequency(getAbsoluteFreq(noteIndex, -1), seconds * 0.65, volume * 0.4, 'sine'), 50);
}

function renderStep5() {
  if (!STATE.bass) STATE.bass = [];
  if (!activeBassNote || !getScaleNotes().includes(activeBassNote)) {
    activeBassNote = getScaleNotes()[0];
  }

  stepContainer.innerHTML = `
    <div class="bass-step-layout">
      <aside class="bass-viewport-col" aria-label="Vista del planeta 3D">
        <div id="bass-scene-container" class="bass-scene-mount"></div>
      </aside>
      <div class="prod-step-card bass-panel-card slide-in">
        <div class="bass-copy">
          <p class="eyebrow">Bajo gravitacional</p>
          <h3>Meteoritos sobre el planeta</h3>
          <p>Cada impacto es una nota grave; la duracion es la masa del meteorito. Arma 1 compas para repetir en los 8 compases.</p>
        </div>

        <div class="bass-controls">
          <div class="bass-note-picker" id="bass-note-picker">
            ${getScaleNotes().map(note => `
              <button class="bass-note-btn ${note === activeBassNote ? 'active' : ''}" data-note="${note}">${NOTE_NAMES[note]}</button>
            `).join('')}
          </div>
          <div class="fraction-controls bass-fraction-tools">
            ${[0.5, 0.25, 0.125, 0.0625].map(value => `
              <button class="frac-btn" data-bass-val="${value}" data-bass-rest="false"><b>${getFractionLabel(value)}</b><small>impacto</small></button>
            `).join('')}
            ${[0.5, 0.25, 0.125, 0.0625].map(value => `
              <button class="frac-btn rest" data-bass-val="${value}" data-bass-rest="true"><b>${getFractionLabel(value)}</b><small>silencio</small></button>
            `).join('')}
            <button class="frac-btn" id="btn-bass-undo"><b>Deshacer</b><small>ultimo</small></button>
            <button class="frac-btn alert" id="btn-bass-clear"><b>Vaciar</b><small>patron</small></button>
          </div>
        </div>

        <div class="bass-track-shell">
          <div class="bass-track" id="bass-track"></div>
          <div class="bass-summary" id="bass-summary"></div>
        </div>

        <div class="producer-actions bass-actions">
          <button class="btn-prod-nav" id="btn-preview-bass">Probar bajo</button>
          <p class="bass-actions-hint">Cada bloque dispara un meteorito en la vista 3D. Clic en un bloque para silenciarlo.</p>
        </div>
      </div>
    </div>
  `;

  initBassScene('bass-scene-container');

  document.querySelectorAll('[data-bass-val]').forEach(button => {
    button.addEventListener('click', () => addBassBlock(Number(button.dataset.bassVal), button.dataset.bassRest === 'true'));
  });
  document.querySelectorAll('#bass-note-picker .bass-note-btn').forEach(button => {
    button.addEventListener('click', () => {
      activeBassNote = Number(button.dataset.note);
      renderStep5();
    });
  });
  document.getElementById('btn-bass-undo')?.addEventListener('click', () => {
    STATE.bass.pop();
    updateBassUI();
  });
  document.getElementById('btn-bass-clear')?.addEventListener('click', () => {
    STATE.bass = [];
    updateBassUI();
  });
  document.getElementById('btn-preview-bass')?.addEventListener('click', toggleBassPreview);

  window.toggleBassRest = (idx) => {
    STATE.bass[idx] = { ...STATE.bass[idx], rest: !STATE.bass[idx].rest };
    updateBassUI();
  };

  updateBassUI();
}

function addBassBlock(duration, rest = false) {
  const sum = getBassSum();
  if (Math.round((sum + duration) * 1000) > 1000) {
    const track = document.getElementById('bass-track');
    if (track) {
      track.style.animation = 'shake 0.3s';
      setTimeout(() => { track.style.animation = ''; }, 300);
    }
    return;
  }

  STATE.bass.push({ duration, noteIndex: activeBassNote, rest });
  if (!rest) playBassImpact(activeBassNote, duration, 0.52);
  updateBassUI();
}

function updateBassUI() {
  const track = document.getElementById('bass-track');
  const summary = document.getElementById('bass-summary');
  if (!track || !summary) return;
  const sum = parseFloat(getBassSum().toFixed(4));
  const playable = STATE.bass.some(block => !block.rest);

  track.innerHTML = STATE.bass.map((block, idx) => `
    <button class="bass-block ${block.rest ? 'rest' : ''}" style="width:${block.duration * 100}%;" onclick="window.toggleBassRest(${idx})">
      <b>${block.rest ? 'Silencio' : NOTE_NAMES[block.noteIndex]}</b>
      <small>${getFractionLabel(block.duration)}</small>
    </button>
  `).join('');

  summary.innerHTML = `<b>${sum}</b><span>/1 compas</span><small>${playable ? 'patron listo para orbitar' : 'agrega al menos un impacto'}</small>`;
  btnNext.disabled = !(sum === 1 && playable);
}

function toggleBassPreview() {
  const btn = document.getElementById('btn-preview-bass');
  if (bassPreviewInterval) {
    clearInterval(bassPreviewInterval);
    bassPreviewInterval = null;
    if (btn) {
      btn.textContent = 'Probar bajo';
      btn.classList.remove('primary-action');
    }
    return;
  }

  if (btn) {
    btn.textContent = 'Detener bajo';
    btn.classList.add('primary-action');
  }

  const measureMs = getMeasureMs();
  const playOnce = () => {
    let offsetMs = 0;
    STATE.bass.forEach(block => {
      if (!block.rest) {
        setTimeout(() => playBassImpact(block.noteIndex, block.duration, 0.5), offsetMs);
      }
      offsetMs += block.duration * measureMs;
    });
  };

  playOnce();
  bassPreviewInterval = setInterval(playOnce, measureMs);
}

function renderStep6() {
  const galaxy = getCurrentGalaxy();
  stepContainer.innerHTML = `
    <div class="prod-step-card daw-step-card slide-in">
      <div class="daw-topbar">
        <div>
          <p class="eyebrow">Consola final</p>
          <h3>DAW orbital</h3>
          <p>${galaxy.name} · ${getRootLabel()} ${getScaleLabel()} · ${STATE.bpm} BPM</p>
        </div>
        <div class="transport-panel">
          <button class="btn-prod-nav" id="btn-daw-play">${isPlayingSong ? 'Detener mezcla' : 'Reproducir mezcla'}</button>
          <button class="btn-prod-nav secondary" onclick="window.gotoProductionStep(2)">Editar ritmo</button>
          <button class="btn-prod-nav secondary" onclick="window.gotoProductionStep(3)">Editar acordes</button>
          <button class="btn-prod-nav secondary" onclick="window.gotoProductionStep(4)">Editar melodia</button>
          <button class="btn-prod-nav secondary" onclick="window.gotoProductionStep(5)">Editar bajo</button>
        </div>
      </div>

      <section class="daw-tempo glass-panel">
        <label for="daw-tempo">Tempo</label>
        <input id="daw-tempo" type="range" min="50" max="220" value="${STATE.bpm}">
        <output id="daw-tempo-output">${STATE.bpm} BPM</output>
      </section>

      <section class="daw-console">
        <div class="daw-ruler">
          <span>Pista</span>
          ${Array.from({ length: 8 }, (_, i) => `<span>Compas ${i + 1}</span>`).join('')}
        </div>

        ${TRACKS.map((trackInfo, idx) => `
          <div class="daw-track" style="--track-color:${trackInfo.color};">
            <div class="daw-track-name">
              <b>${trackInfo.name}</b>
              <small>${getTrackSum(STATE.rhythm[idx]).toFixed(2)} / 1</small>
            </div>
            <div class="daw-lane">${renderDawRhythmBlocks(STATE.rhythm[idx], idx)}</div>
            <div class="daw-track-actions">
              <button onclick="window.addDawRhythmBlock(${idx}, 0.25, false)">+ golpe</button>
              <button onclick="window.addDawRhythmBlock(${idx}, 0.25, true)">+ silencio</button>
              <button onclick="window.clearDawTrack(${idx})">limpiar</button>
            </div>
          </div>
        `).join('')}

        <div class="daw-track harmony-track">
          <div class="daw-track-name"><b>Armonia</b><small>${STATE.harmony.length} clips</small></div>
          <div class="daw-lane">${renderDawHarmonyBlocks()}</div>
          <div class="daw-track-actions"><button onclick="window.gotoProductionStep(3)">editar</button></div>
        </div>

        <div class="daw-track bass-track-final">
          <div class="daw-track-name"><b>Bajo</b><small>${STATE.bass.length} impactos</small></div>
          <div class="daw-lane">${renderDawBassBlocks()}</div>
          <div class="daw-track-actions"><button onclick="window.clearDawBass()">limpiar</button></div>
        </div>

        <div class="daw-track melody-track-final">
          <div class="daw-track-name"><b>Melodia</b><small>${STATE.melody.length} eventos</small></div>
          <div class="daw-lane melody-lane-final">${renderDawMelodyClips()}</div>
          <div class="daw-track-actions"><button onclick="window.clearDawMelody()">limpiar</button></div>
        </div>
      </section>
    </div>
  `;

  window.gotoProductionStep = (step) => loadStep(step);
  window.addDawRhythmBlock = (trackIdx, duration, rest) => {
    const sum = getTrackSum(STATE.rhythm[trackIdx]);
    if (Math.round((sum + duration) * 1000) <= 1000) {
      STATE.rhythm[trackIdx].push({ duration, rest });
      if (!rest) TRACKS[trackIdx].player(0.9);
      renderStep6();
    }
  };
  window.toggleDawRhythmBlock = (trackIdx, blockIdx) => {
    const block = normalizeRhythmBlock(STATE.rhythm[trackIdx][blockIdx]);
    STATE.rhythm[trackIdx][blockIdx] = { ...block, rest: !block.rest };
    renderStep6();
  };
  window.clearDawTrack = (trackIdx) => {
    STATE.rhythm[trackIdx] = [];
    renderStep6();
  };
  window.removeDawChord = (idx) => {
    STATE.harmony.splice(idx, 1);
    renderStep6();
  };
  window.clearDawBass = () => {
    STATE.bass = [];
    renderStep6();
  };
  window.toggleDawBassBlock = (idx) => {
    STATE.bass[idx] = { ...STATE.bass[idx], rest: !STATE.bass[idx].rest };
    renderStep6();
  };
  window.clearDawMelody = () => {
    STATE.melody = [];
    renderStep6();
  };

  const tempo = document.getElementById('daw-tempo');
  const tempoOutput = document.getElementById('daw-tempo-output');
  if (tempo && tempoOutput) {
    tempo.addEventListener('input', () => {
      STATE.bpm = Number(tempo.value);
      tempoOutput.textContent = `${STATE.bpm} BPM`;
    });
  }

  const btnPlay = document.getElementById('btn-daw-play');
  if (btnPlay) btnPlay.addEventListener('click', playProducerSong);

  btnNext.textContent = isPlayingSong ? 'Detener mezcla' : 'Tocar mezcla final';
  btnNext.disabled = false;
}

let isPlayingSong = false;
let songPlaybackTimeouts = [];

function scheduleRhythmLoop(targetList, measures = 8) {
  const measureMs = getMeasureMs();
  for (let m = 0; m < measures; m++) {
    const measureStartMs = m * measureMs;
    STATE.rhythm.forEach((track, idx) => {
      let offsetMs = 0;
      track.forEach(rawBlock => {
        const block = normalizeRhythmBlock(rawBlock);
        if (!block.rest) {
          targetList.push(setTimeout(() => TRACKS[idx].player(1.0), measureStartMs + offsetMs));
        }
        offsetMs += block.duration * measureMs;
      });
    });
  }
}

function scheduleHarmonyTimeline(targetList) {
  const measureMs = getMeasureMs();
  let accumMeasures = 0;
  STATE.harmony.forEach(chord => {
    if (accumMeasures >= 8) return;
    const startMs = accumMeasures * measureMs;
    const durationSecs = Math.max(0.22, chord.duration * measureMs / 1000 * 0.9);
    targetList.push(setTimeout(() => {
      chord.notes.forEach(note => {
        playFrequency(getAbsoluteFreq((STATE.rootNote + note) % 12, 0), durationSecs, STATE.scale === 'minor' ? 0.18 : 0.24, 'triangle');
      });
    }, startMs));
    accumMeasures += chord.duration;
  });
}

function scheduleBassLoop(targetList, measures = 8) {
  const measureMs = getMeasureMs();
  for (let m = 0; m < measures; m++) {
    const measureStartMs = m * measureMs;
    let offsetMs = 0;
    STATE.bass.forEach(block => {
      if (!block.rest) {
        targetList.push(setTimeout(() => playBassImpact(block.noteIndex, block.duration, 0.48), measureStartMs + offsetMs));
      }
      offsetMs += block.duration * measureMs;
    });
  }
}

function scheduleMelodyTimeline(targetList) {
  STATE.melody.forEach(note => {
    targetList.push(setTimeout(() => {
      playFrequency(note.freq, Math.max(0.14, note.duration / 1000), note.valid ? 0.42 : 0.22, note.valid ? 'sine' : 'square');
    }, note.time));
  });
}

function stopProducerSong() {
  songPlaybackTimeouts.forEach(clearTimeout);
  songPlaybackTimeouts = [];
  isPlayingSong = false;
  if (STATE.currentStep === 6) {
    btnNext.textContent = 'Tocar mezcla final';
    const btnDaw = document.getElementById('btn-daw-play');
    if (btnDaw) btnDaw.textContent = 'Reproducir mezcla';
  }
}

function playProducerSong() {
  if (isPlayingSong) {
    stopProducerSong();
    return;
  }

  isPlayingSong = true;
  songPlaybackTimeouts.forEach(clearTimeout);
  songPlaybackTimeouts = [];
  if (STATE.currentStep === 6) {
    btnNext.textContent = 'Detener mezcla';
    const btnDaw = document.getElementById('btn-daw-play');
    if (btnDaw) btnDaw.textContent = 'Detener mezcla';
  }

  scheduleRhythmLoop(songPlaybackTimeouts, 8);
  scheduleHarmonyTimeline(songPlaybackTimeouts);
  scheduleBassLoop(songPlaybackTimeouts, 8);
  scheduleMelodyTimeline(songPlaybackTimeouts);

  songPlaybackTimeouts.push(setTimeout(() => {
    isPlayingSong = false;
    if (STATE.currentStep === 6) {
      btnNext.textContent = 'Tocar mezcla final';
      const btnDaw = document.getElementById('btn-daw-play');
      if (btnDaw) btnDaw.textContent = 'Reproducir mezcla';
    }
  }, getSongMs() + 800));
}
