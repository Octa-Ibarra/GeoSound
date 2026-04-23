/**
 * makey.js — Mapeo de teclas Makey Makey básico
 * 
 * Makey Makey básico emite:
 *   ArrowUp, ArrowDown, ArrowLeft, ArrowRight = 4 flechas
 *   Space = barra espaciadora
 *   MouseButton (click izquierdo) = click de mouse
 * 
 * El modo actual determina cómo se interpretan estas teclas.
 */

// Modo activo: 'home' | 'mode1' | 'mode2' | 'mode3'
let currentMode = 'home';
let makeyConnected = false;
let onMakeyDetected = null;

// Callbacks por modo (se registran desde cada módulo)
const modeHandlers = {
  home: {},
  mode1: {},
  mode2: {},
  mode3: {},
};

/**
 * Mapeo de teclas según el modo
 * Modo 1 (Monocordio):
 *   ↑ = Proporción 1:2 (Octava)
 *   → = Proporción 2:3 (Quinta)
 *   ↓ = Proporción 3:4 (Cuarta)
 *   ← = Proporción 4:5 (Tercera Mayor)
 *   Space = Cuerda completa (Unísono)
 *   Click = Tocar ambos segmentos para comparar
 * 
 * Modo 2 (Círculo):
 *   Space = Do (0)
 *   ↑     = Mi (4)
 *   →     = Sol (7)
 *   ↓     = La (9)
 *   ←     = Si (11)
 *   Click = Limpiar todas las notas
 * 
 * Modo 3 (Retos):
 *   Mismo mapeo que Modo 2, + Click = Verificar
 */
export const KEY_MAP = {
  mode1: {
    ArrowUp:    { action: 'ratio', value: 0.5,   label: '↑ Octava (1:2)' },
    ArrowRight: { action: 'ratio', value: 0.667,  label: '→ Quinta (2:3)' },
    ArrowDown:  { action: 'ratio', value: 0.75,   label: '↓ Cuarta (3:4)' },
    ArrowLeft:  { action: 'ratio', value: 0.8,    label: '← Tercera Mayor (4:5)' },
    Space:      { action: 'ratio', value: 1.0,    label: 'Espacio = Unísono (1:1)' },
  },
  mode2: {
    Space:      { action: 'note', value: 0,  label: 'Espacio = Do' },
    ArrowUp:    { action: 'note', value: 4,  label: '↑ = Mi' },
    ArrowRight: { action: 'note', value: 7,  label: '→ = Sol' },
    ArrowDown:  { action: 'note', value: 9,  label: '↓ = La' },
    ArrowLeft:  { action: 'note', value: 11, label: '← = Si' },
  },
  mode3: {
    Space:      { action: 'note', value: 0,  label: 'Espacio = Do' },
    ArrowUp:    { action: 'note', value: 4,  label: '↑ = Mi' },
    ArrowRight: { action: 'note', value: 7,  label: '→ = Sol' },
    ArrowDown:  { action: 'note', value: 9,  label: '↓ = La' },
    ArrowLeft:  { action: 'note', value: 11, label: '← = Si' },
  },
};

/**
 * Inicializa el listener de teclado global
 */
export function initMakey(onDetected) {
  onMakeyDetected = onDetected;

  // Prevenir scroll con flechas cuando estamos en un modo activo
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);

  // El click del ratón funciona igual que una tecla para Makey Makey
  // (el Makey Makey básico envía un click de mouse izquierdo)
  window.addEventListener('click', handleMakeyClick);
}

function productionShouldCaptureSpace() {
  if (document.body.dataset.screen !== 'production') return true;
  const step = document.body.dataset.prodStep;
  // Pasos 0 y 6 no usan Espacio en el estudio: dejar que el navegador pueda desplazar el panel
  return step !== '0' && step !== '6';
}

function productionShouldCaptureArrows() {
  if (document.body.dataset.screen !== 'production') return true;
  const step = document.body.dataset.prodStep;
  return step === '2' || step === '3' || step === '4' || step === '5';
}

function handleKeyDown(e) {
  const key = e.code === 'Space' ? 'Space' : e.key;
  const handlers = modeHandlers[currentMode];
  const hasKeyHandler = Boolean(handlers && typeof handlers[key] === 'function');

  const makeyKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
  if (makeyKeys.includes(e.key)) {
    if (!makeyConnected) {
      makeyConnected = true;
      if (onMakeyDetected) onMakeyDetected(true);
    }
    let blockScroll = hasKeyHandler;
    if (e.key === ' ' && currentMode === 'production') {
      blockScroll = hasKeyHandler && productionShouldCaptureSpace();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && currentMode === 'production') {
      blockScroll = hasKeyHandler && productionShouldCaptureArrows();
    }
    if (blockScroll) {
      e.preventDefault();
    }
  }

  dispatchKeyAction(key, 'down');
}

function handleKeyUp(e) {
  const key = e.code === 'Space' ? 'Space' : e.key;
  dispatchKeyAction(key, 'up');
}

function handleMakeyClick(e) {
  // Solo si no fue en un botón de la UI (los botones ya tienen handlers propios)
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'CANVAS') return;
  dispatchKeyAction('Click', 'down');
}

function dispatchKeyAction(key, phase) {
  const handlers = modeHandlers[currentMode];
  if (!handlers) return;
  const handler = handlers[key];
  if (handler) handler(phase);
}

/**
 * Registra handlers para un modo específico
 * @param {string} mode - 'mode1' | 'mode2' | 'mode3' | 'home'
 * @param {Object} handlers - { 'ArrowUp': (phase) => {}, ... }
 */
export function registerModeHandlers(mode, handlers) {
  modeHandlers[mode] = { ...modeHandlers[mode], ...handlers };
}

/**
 * Cambia el modo activo
 */
export function setActiveMode(mode) {
  currentMode = mode;
}

/**
 * Retorna si el Makey Makey fue detectado
 */
export function isMakeyConnected() {
  return makeyConnected;
}
