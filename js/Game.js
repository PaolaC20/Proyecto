import { TILE } from './utils/Constants.js';
import {
  cloneMap,
  DEFAULT_MAP,
  renderMap
} from './utils/MapLoader.js';

import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { Fragment } from './entities/Fragment.js';
import { Portal } from './entities/Portal.js';

import { Pathfinding } from './systems/Pathfinding.js';
import { AISystem } from './systems/AISystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { PowerUpSystem } from './systems/PowerUpSystem.js';
import { DebugSystem } from './systems/DebugSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { api } from './systems/ApiClient.js';


export class Game {
  constructor(canvas, input, audio, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.input = input;
    this.audio = audio;
    this.assets = assets;

    // Mapa y sistemas
    this.map = cloneMap(DEFAULT_MAP);

    this.pathfinder = new Pathfinding();
    this.ai = new AISystem();
    this.collision = new CollisionSystem();
    this.power = new PowerUpSystem();
    this.debug = new DebugSystem();
    this.scoreSystem = new ScoreSystem();
    this.levelSystem = new LevelSystem();

    // Estado del juego
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.combo = 200;
    this.powerTimer = 0;

    this.paused = false;
    this.ended = false;
    this.time = 0;

    this.loop = {
      fps: 60
    };

    // Jugador
    this.player = new Player(1, 1);

    // Enemigos
    this.enemies = [
      new Enemy('Alpha', 12, 7, '#ff4d6d'),
      new Enemy('Beta', 13, 7, '#5aa9ff'),
      new Enemy('Gamma', 11, 7, '#55e37a'),
      new Enemy('Delta', 14, 7, '#ffd166')
    ];

    // Fragmentos y portal
    this.fragments = [];

    this.portal = new Portal(
      { x: 23, y: 1 },
      { x: 1, y: 13 }
    );

    // Sprites
    this.spritePaths = {
      player: 'assets/sprites/prepared/player_new_sheet.png',
      enemies: 'assets/sprites/prepared/enemies_new_sheet.png'
    };
  }


  async load() {
    for (const path of Object.values(this.spritePaths)) {
      await this.assets.load(path);
    }
  }


  startRound() {
    this.ended = false;
    this.paused = false;

    this.resetRound();
  }


  resetRound() {
    const starts = [];

    // Buscar fragmentos y posiciones iniciales
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        if (this.map[y][x] === 2) {
          this.fragments.push(new Fragment(x, y));
        }

        if (this.map[y][x] === 4) {
          starts.push({ x, y });
        }
      }
    }

    // Reiniciar fragmentos correctamente
    this.fragments = [];

    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        if (this.map[y][x] === 2) {
          this.fragments.push(new Fragment(x, y));
        }
      }
    }

    // Posición inicial del jugador
    const start = starts[0] || {
      x: 1,
      y: 1
    };

    this.player.setStart(start.x, start.y);

    // Reiniciar enemigos
    this.enemies.forEach(enemy => {
      enemy.reset();
    });

    this.powerTimer = 0;
    this.combo = 200;
  }


  update(dt) {
    if (this.paused || this.ended) {
      return;
    }

    this.time += dt;

    // Controles de depuración
    if (this.input.pressed('F2')) {
      this.debug.toggle();
    }

    // Pausa
    if (this.input.pressed('p', 'P')) {
      this.togglePause();
    }

    // Reiniciar ronda
    if (this.input.pressed('r', 'R')) {
      this.resetRound();
    }

    // Música
    if (this.input.pressed('m', 'M')) {
      this.audio.toggle();
    }

    // Actualizar jugador
    this.player.update(
      dt,
      this.input,
      this.map
    );

    // Actualizar IA
    this.ai.update(this, dt);

    // Actualizar poderes
    this.power.update(this, dt);

    // Colisiones
    this.collision.update(this);

    // Recoger fragmentos
    this.collectPowerIfAny();

    // Comprobar nivel
    if (this.fragments.every(fragment => fragment.collected)) {
      this.completeLevel();
    }

    // HUD
    this.updateHUD();
  }


  collectPowerIfAny() {
    const playerTileX = Math.floor(this.player.x / TILE);
    const playerTileY = Math.floor(this.player.y / TILE);

    if (this.map[playerTileY]?.[playerTileX] === 2) {
      const fragment = this.fragments.find(
        item =>
          Math.floor(item.x / TILE) === playerTileX &&
          Math.floor(item.y / TILE) === playerTileY
      );

      if (fragment && !fragment.collected) {
        fragment.collected = true;
        this.power.activate(this);
      }
    }
  }


  completeLevel() {
    this.level++;
    this.score += 500;

    this.audio.beep(990, 0.25);

    // Reiniciar mapa
    this.map = cloneMap(DEFAULT_MAP);

    // Agregar fragmentos aleatoriamente
    for (let y = 1; y < this.map.length - 1; y++) {
      for (let x = 1; x < this.map[0].length - 1; x++) {
        if (
          this.map[y][x] === 0 &&
          Math.random() < 0.08
        ) {
          this.map[y][x] = 2;
        }
      }
    }

    this.resetRound();
  }


  gameOver() {
    this.ended = true;

    document
      .getElementById('gameover')
      .classList.remove('hidden');

    document.getElementById('finalScore').textContent =
      `Puntuación: ${this.score}`;

    api.saveScore({
      name: 'Jugador',
      score: this.score,
      level: this.level,
      date: new Date().toISOString()
    }).catch(() => {});
  }


  togglePause() {
    this.paused = !this.paused;

    document
      .getElementById('pause')
      .classList.toggle(
        'hidden',
        !this.paused
      );
  }


  updateHUD() {
    document.getElementById('hudScore').textContent =
      `PUNTOS: ${this.score}`;

    document.getElementById('hudLives').textContent =
      `VIDAS: ${this.lives}`;

    document.getElementById('hudLevel').textContent =
      `NIVEL: ${this.level}`;

    document.getElementById('hudState').textContent =
      this.paused
        ? 'PAUSED'
        : 'PLAYING';
  }


  draw() {
    // Mapa
    renderMap(
      this.ctx,
      this.map
    );

    // Portal
    this.portal.draw(this.ctx);

    // Fragmentos
    this.fragments.forEach(fragment => {
      fragment.draw(
        this.ctx,
        this.time
      );
    });

    // Jugador
    this.player.draw(
      this.ctx,
      this.assets.get(
        this.spritePaths.player
      ),
      this.time
    );

    // Enemigos
    this.enemies.forEach(enemy => {
      enemy.draw(
        this.ctx,
        this.assets.get(
          this.spritePaths.enemies
        ),
        this.time
      );
    });

    // Debug
    this.debug.draw(
      this.ctx,
      this
    );
  }


  async loadLevel(level) {
    if (!level) {
      return;
    }

    this.map = level.map.map(row => [...row]);

    this.resetRound();
  }
}