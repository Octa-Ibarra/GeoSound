/**
 * main.js — Lógica principal de enrutamiento y estado de la app
 */

import { initMakey, setActiveMode, isMakeyConnected } from './makey.js';
import { initMonochord } from './monochord.js';
import { initChromatic } from './chromatic.js';
import { initChallenges } from './challenges.js';
import { initProduction } from './production.js';
import { initAmbientGalaxy } from './ambientGalaxy.js';

// ---- INICIALIZACIÓN ----
document.addEventListener('DOMContentLoaded', () => {
  initAmbientGalaxy();

  // Configurar botones de volver al inicio
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => switchScreen('home'));
  });

  // Configurar botones de modo
  const btnProd = document.getElementById('btn-produce');
  if (btnProd) btnProd.addEventListener('click', () => switchScreen('production'));
  document.getElementById('btn-mode1').addEventListener('click', () => switchScreen('mode1'));
  document.getElementById('btn-mode2').addEventListener('click', () => switchScreen('mode2'));
  document.getElementById('btn-mode3').addEventListener('click', () => switchScreen('mode3'));
  document.querySelectorAll('[data-target-screen]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.targetScreen));
  });

  // Overlay de celebración
  document.getElementById('btn-celebration-continue').addEventListener('click', hideCelebration);

  // Inicializar el controlador del Makey Makey
  initMakey(updateMakeyStatus);

  // Inicializar cada modo
  initMonochord();
  initChromatic();
  initChallenges(showCelebration);
  initProduction();

  // Mostrar el inicio
  switchScreen('home');
});

// ---- NAVEGACIÓN ----
function switchScreen(screenId) {
  document.body.dataset.screen = screenId;
  // Quitar la clase active de todos
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  
  // Agregar al seleccionado
  const target = document.getElementById(`screen-${screenId}`);
  if (target) {
    target.classList.add('active');
  }

  // Avisar al controlador Makey Makey en qué modo estamos
  setActiveMode(screenId);
}

// ---- UI MAKEY MAKEY ----
function updateMakeyStatus(isConnected) {
  const indicator = document.getElementById('makey-status');
  const label = document.getElementById('makey-label');
  
  if (isConnected) {
    indicator.classList.add('connected');
    label.textContent = 'Makey Makey Detectado ✓';
    
    // Reproducir un sonido de éxito si estamos en el inicio para feedback
    // if (currentMode === 'home') playSuccess(); // Opcional
  }
}

// ---- OVERLAY DE CELEBRACIÓN (Modo 3) ----
function showCelebration({ emoji, title, fact, onContinue }) {
  const overlay = document.getElementById('celebration-overlay');
  document.getElementById('celebration-emoji').textContent = emoji;
  document.getElementById('celebration-title').textContent = title;
  document.getElementById('celebration-fact').textContent = fact;
  
  overlay.classList.remove('hidden');
  
  const btn = document.getElementById('btn-celebration-continue');
  // Reemplazar event listener de continuar
  const newBtn = btn.cloneNode(true);
  btn.replaceWith(newBtn);
  newBtn.addEventListener('click', () => {
    hideCelebration();
    if (onContinue) onContinue();
  });
}

function hideCelebration() {
  const overlay = document.getElementById('celebration-overlay');
  overlay.classList.add('hidden');
}
