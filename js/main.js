import { Input } from './core/Input.js';
import { GameLoop } from './core/GameLoop.js';
import { AssetManager } from './core/AssetManager.js';
import { AudioManager } from './core/AudioManager.js';
import { SceneManager } from './core/SceneManager.js';

import { Game } from './Game.js';

import { api } from './systems/ApiClient.js';

import {
  DEFAULT_MAP,
  renderMap
} from './utils/MapLoader.js';


// ============================================================
// UTILIDADES DEL DOM
// ============================================================

const $ = selector => document.querySelector(selector);

const show = id => {
  document
    .querySelectorAll('.panel, .screen')
    .forEach(element => {
      element.classList.add('hidden');
    });

  $(id).classList.remove('hidden');
};


// ============================================================
// SISTEMAS PRINCIPALES
// ============================================================

const input = new Input();
const audio = new AudioManager();
const assets = new AssetManager();

const canvas = $('#gameCanvas');

const game = new Game(
  canvas,
  input,
  audio,
  assets
);

const scenes = new SceneManager();


// ============================================================
// ESCENAS
// ============================================================

scenes.add('menu', {});

scenes.add('game', {
  update: dt => game.update(dt),
  draw: () => game.draw()
});

scenes.go('menu');


// ============================================================
// CARGA DE RECURSOS
// ============================================================

await game.load();


// ============================================================
// GAME LOOP
// ============================================================

const loop = new GameLoop(
  dt => {
    if (!$('#game').classList.contains('hidden')) {
      scenes.update(dt);
    }

    input.endFrame();
  },

  () => {
    if (!$('#game').classList.contains('hidden')) {
      scenes.draw();
    }
  }
);

game.loop = loop;

loop.start();


// ============================================================
// RANKING
// ============================================================

async function ranking() {
  show('#ranking');

  const list = $('#rankingList');

  list.innerHTML = 'Cargando...';

  try {
    const scores = await api.scores();

    list.innerHTML =
      scores
        .map(
          score =>
            `<li>${score.name} — ${score.score} pts — nivel ${score.level}</li>`
        )
        .join('') ||
      '<li>Sin puntuaciones</li>';

  } catch {
    list.innerHTML = '<li>No disponible</li>';
  }
}


// ============================================================
// INICIAR PARTIDA
// ============================================================

function start() {
  $('#gameover').classList.add('hidden');
  $('#pause').classList.add('hidden');

  show('#game');

  // Reiniciar estadísticas
  game.lives = 3;
  game.score = 0;
  game.level = 1;

  // Reiniciar mapa
  game.map = DEFAULT_MAP.map(row => [...row]);

  // Iniciar ronda
  game.startRound();

  // Iniciar música
  audio.startMusic();
}


// ============================================================
// REINICIAR PARTIDA
// ============================================================

function restart() {
  $('#gameover').classList.add('hidden');
  $('#pause').classList.add('hidden');

  show('#game');

  // Reiniciar estadísticas
  game.lives = 3;
  game.score = 0;
  game.level = 1;

  // Reiniciar mapa
  game.map = DEFAULT_MAP.map(row => [...row]);

  // Iniciar ronda
  game.startRound();
}


// ============================================================
// EVENTOS DE BOTONES
// ============================================================

document.addEventListener('click', event => {
  const action = event.target.dataset.action;

  if (action === 'start') {
    start();
  }

  if (action === 'restart') {
    restart();
  }

  if (action === 'resume') {
    game.togglePause();
  }

  if (action === 'menu') {
    game.ended = true;

    show('#menu');

    audio.stopMusic();
  }

  if (action === 'ranking') {
    ranking();
  }

  if (action === 'credits') {
    show('#credits');
  }

  if (action === 'editor') {
    initEditor();
  }
});


// ============================================================
// EDITOR DE MAPAS
// ============================================================

let editorMap = DEFAULT_MAP.map(row => [...row]);

let tool = 1;


// ============================================================
// INICIALIZAR EDITOR
// ============================================================

function initEditor() {
  show('#editor');

  const canvas = $('#editorCanvas');
  const context = canvas.getContext('2d');


  // ----------------------------------------------------------
  // DIBUJAR MAPA
  // ----------------------------------------------------------

  const draw = () => {
    renderMap(
      context,
      editorMap
    );


    // Cuadrícula
    context.strokeStyle = '#ffffff44';


    // Líneas verticales
    for (
      let i = 0;
      i <= editorMap[0].length;
      i++
    ) {
      context.beginPath();

      context.moveTo(
        i * 32,
        0
      );

      context.lineTo(
        i * 32,
        editorMap.length * 32
      );

      context.stroke();
    }


    // Líneas horizontales
    for (
      let j = 0;
      j <= editorMap.length;
      j++
    ) {
      context.beginPath();

      context.moveTo(
        0,
        j * 32
      );

      context.lineTo(
        editorMap[0].length * 32,
        j * 32
      );

      context.stroke();
    }
  };


  // ----------------------------------------------------------
  // COLOCAR BLOQUES EN EL MAPA
  // ----------------------------------------------------------

  canvas.onmousedown = event => {
    const rect = canvas.getBoundingClientRect();

    const cellWidth =
      rect.width / 25;

    const cellHeight =
      rect.height / 15;

    const cx = Math.floor(
      (event.clientX - rect.left) /
      cellWidth
    );

    const cy = Math.floor(
      (event.clientY - rect.top) /
      cellHeight
    );


    if (editorMap[cy]) {
      editorMap[cy][cx] = tool;
    }

    draw();
  };


  // ----------------------------------------------------------
  // SELECCIÓN DE HERRAMIENTA
  // ----------------------------------------------------------

  document
    .querySelectorAll('[data-tile]')
    .forEach(button => {

      button.onclick = () => {
        tool = +button.dataset.tile;


        document
          .querySelectorAll('[data-tile]')
          .forEach(element => {
            element.classList.remove('selected');
          });


        button.classList.add('selected');
      };

    });


  // ----------------------------------------------------------
  // GUARDAR NIVEL
  // ----------------------------------------------------------

  $('#saveLevel').onclick = async () => {
    try {
      await api.saveLevel({
        name: `Nivel ${Date.now()}`,
        map: editorMap
      });

      $('#editorInfo').textContent =
        'Nivel guardado en Node.js.';

    } catch {
      $('#editorInfo').textContent =
        'No se pudo guardar.';
    }
  };


  // ----------------------------------------------------------
  // CARGAR NIVEL
  // ----------------------------------------------------------

  $('#loadLevel').onclick = async () => {
    try {
      const levels = await api.levels();

      if (levels[0]) {
        editorMap =
          levels[0].map.map(row => [...row]);

        draw();

        $('#editorInfo').textContent =
          'Nivel cargado.';
      }

    } catch {
      $('#editorInfo').textContent =
        'No se pudo cargar.';
    }
  };


  // Dibujar inicialmente
  draw();
}