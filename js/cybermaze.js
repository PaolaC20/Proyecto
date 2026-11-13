(() => {
  'use strict';

  // ============================================================
  // CYBER MAZE: PURSUIT PROTOCOL
  // Versión local: funciona con doble clic sobre index.html.
  // No usa ES Modules ni fetch para iniciar el juego.
  // ============================================================

  const TILE = 32;
  const COLS = 25;
  const ROWS = 15;
  const WIDTH = COLS * TILE;
  const HEIGHT = ROWS * TILE;
  const STATE = {
    SPAWN:'SPAWN',
    SCATTER:'SCATTER',
    CHASE:'CHASE',
    FRIGHTENED:'FRIGHTENED',
    RETURN:'RETURN',
    RESPAWN:'RESPAWN',
    APPEARING:'APPEARING'
  };
  const DIRS = {
    up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0}, none:{x:0,y:0}
  };

  // ------------------------------------------------------------
  // GENERADOR DE 8 LABERINTOS PROGRESIVOS
  // Cada nivel se genera de forma determinista a partir de su número.
  // Así el laberinto cambia sin depender de archivos externos.
  // ------------------------------------------------------------
  function seededRandom(seed){
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function generateLevel(level){
    const map = Array.from({length:ROWS},()=>Array(COLS).fill(1));
    const rand = seededRandom(0xC0FFEE + level * 7919);

    const carve = (x,y)=>{
      map[y][x]=0;
      const dirs=[[2,0],[-2,0],[0,2],[0,-2]];
      for(let i=dirs.length-1;i>0;i--){
        const j=Math.floor(rand()*(i+1));
        [dirs[i],dirs[j]]=[dirs[j],dirs[i]];
      }
      for(const [dx,dy] of dirs){
        const nx=x+dx, ny=y+dy;
        if(nx>0&&nx<COLS-1&&ny>0&&ny<ROWS-1&&map[ny][nx]===1){
          map[y+dy/2][x+dx/2]=0;
          carve(nx,ny);
        }
      }
    };
    carve(1,1);

    // Abrimos conexiones extra. Los primeros niveles tienen rutas más
    // abiertas; los últimos conservan más pasillos y exigen más navegación.
    const extraOpenings = Math.max(4, 14 - level);
    const candidates=[];
    for(let y=1;y<ROWS-1;y++){
      for(let x=1;x<COLS-1;x++){
        if(map[y][x]!==1) continue;
        const horizontal = map[y][x-1]===0 && map[y][x+1]===0;
        const vertical = map[y-1]?.[x]===0 && map[y+1]?.[x]===0;
        if(horizontal||vertical)candidates.push({x,y});
      }
    }
    for(let i=candidates.length-1;i>0;i--){
      const j=Math.floor(rand()*(i+1));
      [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
    }
    candidates.slice(0,extraOpenings).forEach(p=>map[p.y][p.x]=0);

    const open=[];
    for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){
      if(map[y][x]===0)open.push({x,y});
    }

    // Cada nivel tiene una zona inicial distinta. Elegimos la casilla abierta
    // más cercana al punto objetivo para que el cambio sea visible aunque el
    // laberinto generado tenga paredes diferentes.
    const startTargets=[
      {x:1,y:1},{x:23,y:13},{x:12,y:1},{x:1,y:13},
      {x:23,y:1},{x:12,y:13},{x:5,y:7},{x:19,y:7}
    ];
    const startTarget=startTargets[(level-1)%startTargets.length];
    const nearestOpen=(target, list=open)=>list.reduce((best,p)=>
      !best || (Math.abs(p.x-target.x)+Math.abs(p.y-target.y)) <
      (Math.abs(best.x-target.x)+Math.abs(best.y-target.y)) ? p : best, null);
    const start=nearestOpen(startTarget);
    if(start)map[start.y][start.x]=4;

    // Portales alejados entre sí y de la nueva posición inicial.
    const distanceFrom=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
    const degree=p=>[[1,0],[-1,0],[0,1],[0,-1]]
      .filter(([dx,dy])=>map[p.y+dy]?.[p.x+dx]===0).length;
    const portalPool=open.filter(p=>
      !(p.x===start.x&&p.y===start.y) &&
      distanceFrom(p,start)>=6 &&
      degree(p)>=1
    );
    const pp=portalPool.length>=2?portalPool:open.filter(p=>!(p.x===1&&p.y===1));
    let portalA=pp.reduce((best,p)=>distanceFrom(p,{x:1,y:1})>distanceFrom(best,{x:1,y:1})?p:best,pp[0]);
    let portalB=pp.reduce((best,p)=>distanceFrom(p,portalA)>distanceFrom(best,portalA)?p:best,pp[0]);
    if(!portalA || (portalA.x===start.x&&portalA.y===start.y))portalA=pp[Math.floor(pp.length*.75)]||{x:COLS-2,y:ROWS-2};
    if(!portalB || (portalB.x===portalA.x&&portalB.y===portalA.y))portalB=pp[Math.floor(pp.length*.25)]||{x:COLS-2,y:1};

    map[portalA.y][portalA.x]=3;
    map[portalB.y][portalB.x]=3;
    return map;
  }

  const LEVELS = Array.from({length:8},(_,i)=>generateLevel(i+1));

  function parseLevel(source){
    if(Array.isArray(source)) return cloneMap(source);
    return String(source).trim().split('\n').slice(0,ROWS).map(row=>{
      const r=row.padEnd(COLS,'#').slice(0,COLS);
      return [...r].map(ch=>({'#':1,'.':0,'S':4,'P':3,'F':2}[ch] ?? 0));
    });
  }

  const $ = s => document.querySelector(s);
  const cloneMap = m => m.map(r => r.slice());
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const tileOf = o => ({x:Math.floor(o.x/TILE),y:Math.floor(o.y/TILE)});
  const center = p => ({x:p.x*TILE+16,y:p.y*TILE+16});
  const key = (x,y) => `${x},${y}`;
  const isWall = (map,x,y) => !map[y] || map[y][x] === 1;
  const openTile = (map,x,y) => map[y] && map[y][x] !== 1;

  // ------------------------------------------------------------
  // FONDO ILUSTRADO
  // ------------------------------------------------------------
  // Imagen proporcionada para usar como ambientación visual detrás del
  // laberinto. Se mantiene local para que el juego siga funcionando con
  // doble clic sobre index.html, sin servidor ni fetch.
  const levelBackground = new Image();
  let levelBackgroundReady = false;
  levelBackground.onload = () => { levelBackgroundReady = true; };
  levelBackground.onerror = () => {
    console.warn('No se pudo cargar el fondo: assets/backgrounds/cyber-lab-bg.png');
  };
  levelBackground.src = 'assets/backgrounds/cyber-lab-bg.png';

  // Tira de muros proporcionada por el usuario. La imagen tiene fondo
  // transparente y varios paneles repetidos; se recorta un panel por
  // celda para conservar el aspecto pixel-art del laberinto.
  const wallTexture = new Image();
  let wallTextureReady = false;
  wallTexture.onload = () => { wallTextureReady = true; };
  wallTexture.onerror = () => {
    console.warn('No se pudo cargar la textura de muros: assets/backgrounds/cyber-wall-panels.png');
  };
  wallTexture.src = 'assets/backgrounds/cyber-wall-panels.png';

  // Power Up personalizado proporcionado por el usuario. El PNG se prepara
  // con fondo transparente para que solo aparezca el objeto dentro del mapa.
  const powerUpTexture = new Image();
  let powerUpTextureReady = false;
  powerUpTexture.onload = () => { powerUpTextureReady = true; };
  powerUpTexture.onerror = () => {
    console.warn('No se pudo cargar el Power Up: assets/backgrounds/power-up.png');
  };
  powerUpTexture.src = 'assets/backgrounds/power-up.png';

  // Portal personalizado proporcionado por el usuario. El PNG ya contiene
  // transparencia, por lo que se puede dibujar directamente sobre el laberinto.
  const portalTexture = new Image();
  let portalTextureReady = false;
  portalTexture.onload = () => { portalTextureReady = true; };
  portalTexture.onerror = () => {
    console.warn('No se pudo cargar el portal: assets/backgrounds/portal.png');
  };
  portalTexture.src = 'assets/backgrounds/portal.png';

  // Fragmento de datos personalizado proporcionado por el usuario.
  // Se muestra como el objeto normal que hay que recoger.
  const fragmentTexture = new Image();
  let fragmentTextureReady = false;
  fragmentTexture.onload = () => { fragmentTextureReady = true; };
  fragmentTexture.onerror = () => {
    console.warn('No se pudo cargar el fragmento: assets/backgrounds/data-fragment.png');
  };
  fragmentTexture.src = 'assets/backgrounds/data-fragment.png';

  // Posiciones aproximadas de los paneles visibles dentro de la tira.
  // Se alternan para evitar que todas las paredes sean idénticas.
  const wallPanelX = [0, 74, 148, 226, 304, 383, 457, 535, 614, 693, 769, 848, 923, 997, 1071, 1145];

  function drawWallTile(ctx, px, py, tileX, tileY, themeData){
    ctx.fillStyle = themeData.wall;
    ctx.fillRect(px, py, TILE, TILE);

    if(wallTextureReady && wallTexture.naturalWidth){
      const panel = wallPanelX[(tileX + tileY * 3) % wallPanelX.length];
      const sourceY = 167;
      const sourceW = Math.min(64, wallTexture.naturalWidth - panel);
      const sourceH = 140;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        wallTexture,
        panel, sourceY, sourceW, sourceH,
        px, py, TILE, TILE
      );

      // Tinte ligero según el sector, manteniendo visible el sprite del muro.
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = themeData.edge;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.restore();
    } else {
      ctx.strokeStyle = themeData.edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#ffffff18';
      ctx.fillRect(px + 5, py + 5, TILE - 10, 3);
    }
  }

  function drawLevelBackground(ctx){
    if(!levelBackgroundReady || !levelBackground.naturalWidth) return false;

    const scale = Math.max(
      WIDTH / levelBackground.naturalWidth,
      HEIGHT / levelBackground.naturalHeight
    );
    const w = levelBackground.naturalWidth * scale;
    const h = levelBackground.naturalHeight * scale;
    const x = (WIDTH - w) * 0.5;
    const y = (HEIGHT - h) * 0.5;

    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(levelBackground, x, y, w, h);
    ctx.restore();
    return true;
  }

  // ------------------------------------------------------------
  // SPRITES
  // ------------------------------------------------------------
  class SpriteManager {
    constructor() {
      this.ready = { player:false, enemies:false };
      this.player = new Image();
      this.enemies = {};

      // Hojas EXACTAS proporcionadas por el usuario.
      this.player.src = 'assets/sprites/user/player_sheet.png';
      this.player.onload = () => { this.ready.player = true; };

      this._enemyImage = new Image();
      this._enemyImage.src = 'assets/sprites/user/enemies_sheet.png';
      this._enemyImage.onload = () => {
        ['Alpha','Beta','Gamma','Delta'].forEach(n => this.enemies[n] = this._enemyImage);
        this.ready.enemies = true;
      };

      // Las hojas no son una cuadrícula uniforme. Estas son las posiciones
      // reales de cada sprite dentro de las imágenes originales.
      this.playerX = [159,254,353,445,536,630];
      this.playerY = [63,186,312,433,560,706];
      this.enemyX  = [78,139,203,270,336,400,465,525,579,639];
      this.enemyY  = [87,163,257,333,422,488,578,650];
    }

    cropCentered(ctx, img, cx, cy, sw, sh, dx, dy, dw, dh, flip=false) {
      ctx.save();
      ctx.translate(dx, dy);
      if (flip) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, cx-sw/2, cy-sh/2, sw, sh, -dw/2, -dh/2, dw, dh);
      ctx.restore();
    }

    drawPlayer(ctx, x, y, frame, direction, action='idle') {
      if (!this.ready.player || !this.player?.naturalWidth) return false;

      // Filas reales del sprite del jugador:
      // 0 = frente, 1 = espalda, 2 = lateral, 3 = ataque.
      let row;
      let flip = false;
      let frames = 6;

      if (action === 'attack') {
        row = 3;
        flip = direction === DIRS.left;
      } else if (action === 'death' || action === 'hurt') {
        row = 5;
        flip = direction === DIRS.left;
      } else if (direction === DIRS.up) {
        row = 1;
      } else if (direction === DIRS.down || direction === DIRS.none) {
        row = 0;
      } else {
        row = 2;
        flip = direction === DIRS.left;
      }

      const f = Math.floor(frame) % frames;
      const cx = this.playerX[f];
      const cy = this.playerY[row];

      // El personaje original es alto; mantener proporción evita que al
      // caminar se vea aplastado o que aparezcan partes de otros frames.
      this.cropCentered(ctx, this.player, cx, cy, 90, 116, x, y-1, 32, 41, flip);
      return true;
    }

    drawEnemy(ctx, x, y, frame, colorRow, direction=DIRS.right) {
      const img = this._enemyImage;
      if (!this.ready.enemies || !img?.naturalWidth) return false;

      const color = Math.max(0, Math.min(3, colorRow|0));
      let sourceRow;
      let col;
      let flip = false;

      if (direction === DIRS.up) {
        // Primera fila de cada color = frente.
        sourceRow = color * 2;
        col = Math.floor(frame) % 6;
      } else if (direction === DIRS.down) {
        // Segunda fila de cada color = espalda.
        sourceRow = color * 2 + 1;
        col = Math.floor(frame) % 6;
      } else {
        // Los últimos 4 cuadros de cada fila son las poses laterales.
        sourceRow = color * 2;
        col = 6 + (Math.floor(frame) % 4);
        flip = direction === DIRS.left;
      }

      const cx = this.enemyX[col];
      const cy = this.enemyY[sourceRow];

      // Tamaño fijo y proporción vertical para que no se deformen al andar.
      this.cropCentered(ctx, img, cx, cy, 64, 72, x, y+1, 32, 37, flip);
      return true;
    }
  }

  // ------------------------------------------------------------
  // PERSISTENCIA LOCAL
  // ------------------------------------------------------------
  const Store = {
    read(k,f){ try { const v=localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
    write(k,v){ try { localStorage.setItem(k,JSON.stringify(v)); return true; } catch { return false; } },
    levels(){ return this.read('cyberMazeLevels',[]); },
    saveLevel(level){ const a=this.levels(); a.unshift(level); return this.write('cyberMazeLevels',a.slice(0,20)); },
    scores(){ return this.read('cyberMazeScores',[]).sort((a,b)=>b.score-a.score); },
    saveScore(s){ const a=this.scores(); a.push(s); a.sort((x,y)=>y.score-x.score); return this.write('cyberMazeScores',a.slice(0,10)); }
  };

  // ------------------------------------------------------------
  // INPUT
  // ------------------------------------------------------------
  class Input {
    constructor(){
      this.keys=new Set(); this.pressedKeys=new Set();
      window.addEventListener('keydown',e=>{
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','F2'].includes(e.key)) e.preventDefault();
        if(!this.keys.has(e.key)) this.pressedKeys.add(e.key);
        this.keys.add(e.key);
      });
      window.addEventListener('keyup',e=>this.keys.delete(e.key));
    }
    down(...keys){ return keys.some(k=>this.keys.has(k)); }
    pressed(...keys){ return keys.some(k=>this.pressedKeys.has(k)); }
    end(){ this.pressedKeys.clear(); }
  }

  // ------------------------------------------------------------
  // AUDIO LOCAL
  // ------------------------------------------------------------
  class AudioManager {
    constructor(){
      this.enabled=true;
      this.ctx=null;
      this.musicAudio=document.getElementById('bgMusic');
    }
    ensure(){
      if(!this.ctx){
        try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();}catch{}
      }
      if(this.ctx?.state==='suspended')this.ctx.resume();
    }
    beep(freq=440,duration=.07){
      if(!this.enabled)return;
      this.ensure();
      if(!this.ctx)return;
      const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type='square';
      o.frequency.value=freq;
      g.gain.setValueAtTime(.025,this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+duration);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime+duration);
    }
    startMusic(){
      if(!this.enabled||!this.musicAudio)return false;
      const audio=this.musicAudio;
      audio.volume=.15;
      audio.loop=true;
      // No esperamos a canplay: play() se llama directamente desde el clic
      // de INICIAR/REINTENTAR para conservar la autorización del navegador.
      if(audio.readyState===0) audio.load();
      const promise=audio.play();
      if(promise) promise.catch(err=>console.warn('No se pudo iniciar la música:',err));
      return true;
    }
    stopMusic(){
      if(!this.musicAudio)return;
      this.musicAudio.pause();
      this.musicAudio.currentTime=0;
    }
    toggle(){
      this.enabled=!this.enabled;
      if(this.enabled)this.startMusic();
      else this.stopMusic();
    }
  }

  // ------------------------------------------------------------
  // PATHFINDING BFS
  // ------------------------------------------------------------
  function bfs(start,goal,map){
    let g={x:clamp(goal.x,1,COLS-2),y:clamp(goal.y,1,ROWS-2)};
    if(isWall(map,g.x,g.y)){
      outer: for(let r=1;r<8;r++) for(let y=g.y-r;y<=g.y+r;y++) for(let x=g.x-r;x<=g.x+r;x++)
        if(openTile(map,x,y)){g={x,y};break outer;}
    }
    const q=[start],prev=new Map([[key(start.x,start.y),null]]),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){
      const c=q.shift();
      if(c.x===g.x&&c.y===g.y)break;
      for(const [dx,dy] of dirs){
        const n={x:c.x+dx,y:c.y+dy},k=key(n.x,n.y);
        if(openTile(map,n.x,n.y)&&!prev.has(k)){prev.set(k,c);q.push(n);}
      }
    }
    if(!prev.has(key(g.x,g.y)))return [];
    const path=[];let c=g;while(c){path.unshift(c);c=prev.get(key(c.x,c.y));}path.shift();return path;
  }

  // ------------------------------------------------------------
  // PLAYER
  // ------------------------------------------------------------
  class Player {
    constructor(sprites){
      this.sprites=sprites; this.x=48; this.y=48; this.speed=132;
      this.dir=DIRS.down; this.lastDir=DIRS.down; this.inv=0;
      this.anim=0; this.action='idle'; this.attackTimer=0; this.hurtTimer=0;
    }
    setStart(p){
      const c=center(p); this.x=c.x; this.y=c.y;
      this.dir=DIRS.down; this.lastDir=DIRS.down; this.anim=0;
      this.action='idle'; this.attackTimer=0; this.hurtTimer=0;
    }
    hitWall(x,y,map){
      const r=9;
      return [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].some(([px,py])=>
        isWall(map,Math.floor(px/TILE),Math.floor(py/TILE))
      );
    }
    update(dt,input,map){
      if((input.pressed(' ','Enter')||touchKeys.attack)&&this.attackTimer<=0){
        this.attackTimer=.42; this.anim=0;
      }
      this.attackTimer=Math.max(0,this.attackTimer-dt);
      this.hurtTimer=Math.max(0,this.hurtTimer-dt);

      let d=DIRS.none;
      if(input.down('ArrowUp','w','W')||touchKeys.up)d=DIRS.up;
      else if(input.down('ArrowDown','s','S')||touchKeys.down)d=DIRS.down;
      else if(input.down('ArrowLeft','a','A')||touchKeys.left)d=DIRS.left;
      else if(input.down('ArrowRight','d','D')||touchKeys.right)d=DIRS.right;

      const moving=d!==DIRS.none;
      const speed=this.speed;
      const nx=this.x+d.x*speed*dt, ny=this.y+d.y*speed*dt;
      let moved=false;
      if(!this.hitWall(nx,this.y,map)){this.x=nx;moved=true;}
      if(!this.hitWall(this.x,ny,map)){this.y=ny;moved=true;}

      if(moved){this.dir=d;this.lastDir=d;this.anim+=dt*(speed>160?14:10);}
      else {this.dir=DIRS.none; if(!moving)this.anim=0;}

      if(this.attackTimer>0)this.action='attack';
      else if(this.hurtTimer>0)this.action='hurt';
      else if(moved)this.action=speed>160?'run':'walk';
      else this.action='idle';

      this.x=clamp(this.x,16,map[0].length*TILE-16);
      this.y=clamp(this.y,16,map.length*TILE-16);
      this.inv=Math.max(0,this.inv-dt);
    }
    setHurt(){this.hurtTimer=.5;this.anim=0;}
    draw(ctx,t){
      if(this.inv>0&&Math.floor(t*16)%2===0)return;
      const frame=this.action==='idle'?Math.floor(t*2):Math.floor(this.anim);
      const dir=this.dir===DIRS.none?this.lastDir:this.dir;
      if(!this.sprites.drawPlayer(ctx,this.x,this.y,frame,dir,this.action,40)){
        ctx.fillStyle='#b9f5ff';ctx.fillRect(this.x-10,this.y-10,20,20);
      }
    }
  }

  // ------------------------------------------------------------
  // ENEMIGOS
  // ------------------------------------------------------------
  class Enemy {
    constructor(name,x,y,row,sprites){
      this.name=name;this.spawn={x,y};this.row=row;this.sprites=sprites;
      this.respawnDelay=3.2;
      this.reset();this.phase=Math.random()*2;
    }
    reset(){
      const p=center(this.spawn);
      this.x=p.x;this.y=p.y;
      this.state=STATE.CHASE;this.stateTime=0;
      this.respawnTimer=0;this.appearTimer=0;this.path=[];this.target={...this.spawn};
      this.anim=Math.random()*6;this.dir=DIRS.right;
    }
    setState(s){
      if(this.state!==s)this.stateTime=0;
      this.state=s;
      if(s===STATE.RESPAWN){
        this.respawnTimer=this.respawnDelay;
        this.appearTimer=0;
        this.path=[];
      }
      if(s===STATE.APPEARING){
        this.appearTimer=1.25;
        this.respawnTimer=0;
        this.path=[];
      }
    }
    findRandomRespawn(game){
      const candidates=[];
      for(let y=1;y<ROWS-1;y++){
        for(let x=1;x<COLS-1;x++){
          if(game.map[y]?.[x]!==0)continue;
          const p={x,y};
          const playerTile=tileOf(game.player);
          if(Math.abs(p.x-playerTile.x)+Math.abs(p.y-playerTile.y)<6)continue;
          if(game.portal && ((p.x===game.portal.a.x&&p.y===game.portal.a.y)||(p.x===game.portal.b.x&&p.y===game.portal.b.y)))continue;
          if(game.enemies.some(other=>other!==this&&other.state!==STATE.RESPAWN&&other.state!==STATE.APPEARING&&Math.abs(p.x-tileOf(other).x)+Math.abs(p.y-tileOf(other).y)<2))continue;
          candidates.push(p);
        }
      }
      if(!candidates.length){
        for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(game.map[y]?.[x]===0)candidates.push({x,y});
      }
      return candidates[Math.floor(Math.random()*candidates.length)] || {x:1,y:1};
    }
    chooseTarget(game){
      const p=tileOf(game.player);
      const a=tileOf(game.enemies[0]);
      if(this.state===STATE.SCATTER)return this.spawn;
      if(this.state===STATE.FRIGHTENED){
        return {
          x:clamp(p.x+Math.floor(Math.random()*9)-4,1,COLS-2),
          y:clamp(p.y+Math.floor(Math.random()*9)-4,1,ROWS-2)
        };
      }
      if(this.name==='Alpha')return p;
      if(this.name==='Beta'){
        const d=game.player.dir;
        return {x:p.x+d.x*(4+Math.min(3,game.level)),y:p.y+d.y*(4+Math.min(3,game.level))};
      }
      if(this.name==='Gamma')return {x:p.x+(p.x-a.x),y:p.y+(p.y-a.y)};
      const d=dist(this,game.player);
      return d>190?p:{x:p.x+(p.x-tileOf(this).x)*3,y:p.y+(p.y-tileOf(this).y)*3};
    }
    update(dt,game){
      // Tras ser capturado, el enemigo desaparece por completo.
      // Después reaparece en una posición aleatoria y permanece intocable
      // durante una breve animación de entrada.
      if(this.state===STATE.RESPAWN){
        this.respawnTimer=Math.max(0,this.respawnTimer-dt);
        this.stateTime+=dt;
        this.path=[];
        if(this.respawnTimer<=0){
          const pos=this.findRandomRespawn(game);
          const p=center(pos);
          this.x=p.x;this.y=p.y;
          this.dir=DIRS.none;
          this.setState(STATE.APPEARING);
        }
        return;
      }

      // APPEARING: visible con efecto de aparición, pero NO puede causar daño.
      if(this.state===STATE.APPEARING){
        this.appearTimer=Math.max(0,this.appearTimer-dt);
        this.stateTime+=dt;
        this.anim+=dt*10;
        if(this.appearTimer<=0){
          this.setState(game.powerTimer>0?STATE.FRIGHTENED:STATE.CHASE);
          this.stateTime=0;
        }
        return;
      }

      this.stateTime+=dt;

      // RETURN tiene prioridad sobre FRIGHTENED: una captura ya confirmada
      // nunca puede ser anulada por el temporizador de energía.
      const vulnerable=game.powerTimer>0 &&
        this.state!==STATE.RESPAWN &&
        this.state!==STATE.APPEARING;

      if(vulnerable&&this.state!==STATE.FRIGHTENED)this.setState(STATE.FRIGHTENED);
      if(!vulnerable&&this.state===STATE.FRIGHTENED)this.setState(STATE.CHASE);

      if(this.state===STATE.SCATTER&&this.stateTime>Math.max(2,3.4-game.level*.12))this.setState(STATE.CHASE);
      else if(this.state===STATE.CHASE&&this.stateTime>Math.max(4.8,8.5-game.level*.35))this.setState(STATE.SCATTER);

      this.target=this.chooseTarget(game);
      this.path=bfs(tileOf(this),this.target,game.map);

      const baseSpeed=76+game.level*8;
      const speed=baseSpeed*(vulnerable?.62:1);

      if(this.path.length){
        const n=this.path[0],p=center(n);
        const dx=p.x-this.x,dy=p.y-this.y,len=Math.hypot(dx,dy)||1;
        this.dir=Math.abs(dx)>=Math.abs(dy)
          ?(dx<0?DIRS.left:DIRS.right)
          :(dy<0?DIRS.up:DIRS.down);
        this.x+=dx/len*speed*dt;
        this.y+=dy/len*speed*dt;
        if(Math.hypot(p.x-this.x,p.y-this.y)<5)this.path.shift();
        this.anim+=dt*9;
      }
    }
    draw(ctx,t){
      if(this.state===STATE.RESPAWN)return;

      ctx.save();
      if(this.state===STATE.APPEARING){
        const progress=1-Math.max(0,this.appearTimer)/1.25;
        ctx.globalAlpha=0.25+progress*0.75;
        ctx.shadowColor='#70eaff';
        ctx.shadowBlur=12+progress*12;
      }

      const frame=Math.floor(this.anim+this.phase)%6;
      const drawn=this.sprites.drawEnemy(ctx,this.x,this.y,frame,this.row,this.dir,40);

      if(this.state===STATE.FRIGHTENED){
        ctx.save();
        ctx.translate(this.x,this.y+8);
        ctx.globalAlpha=.38;
        ctx.fillStyle=Math.floor(t*8)%2?'#eafcff':'#6ccfff';
        ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;
        ctx.strokeStyle='#dffcff';ctx.lineWidth=2;ctx.stroke();
        ctx.restore();
        ctx.restore();
        return;
      }

      if(!drawn){
        const colors=['#d21d61','#1c91ff','#23d879','#f2bf28'];
        ctx.fillStyle=colors[this.row];
        ctx.beginPath();ctx.arc(this.x,this.y,12,0,Math.PI*2);ctx.fill();
      }

      ctx.restore();
    }
  }

  class Portal {
    constructor(a,b){this.a=a;this.b=b;this.cool=0;}
    update(dt){this.cool=Math.max(0,this.cool-dt);}
    teleport(entity){
      if(this.cool>0)return false;const t=tileOf(entity);
      if(t.x===this.a.x&&t.y===this.a.y){const p=center(this.b);entity.x=p.x;entity.y=p.y;this.cool=.7;return true;}
      if(t.x===this.b.x&&t.y===this.b.y){const p=center(this.a);entity.x=p.x;entity.y=p.y;this.cool=.7;return true;}
      return false;
    }
    draw(ctx,time){
      for(const p of [this.a,this.b]){
        const c=center(p);
        ctx.save();
        ctx.translate(c.x,c.y);
        const pulse=1+Math.sin(time*5+c.x*.02)*.045;

        if(portalTextureReady && portalTexture.naturalWidth){
          // Portal oficial proporcionado por el usuario. Se conserva el pixel-art
          // y se mantiene suficientemente pequeño para no tapar el laberinto.
          const w=31*pulse;
          const h=36.3*pulse;
          ctx.imageSmoothingEnabled=false;
          ctx.shadowColor='#62eaff';
          ctx.shadowBlur=10;
          ctx.globalAlpha=.98;
          ctx.drawImage(portalTexture,-w/2,-h/2,w,h);
        }else{
          // Respaldo si el PNG todavía está cargando.
          ctx.rotate(time*1.5);
          ctx.strokeStyle='#e46cff';ctx.lineWidth=2;
          ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.stroke();
          ctx.strokeStyle='#65f4ff';
          ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------
  // RENDER DEL ESCENARIO: estética instalación ciber-militar
  // ------------------------------------------------------------
  function theme(level){
    return [
      {floor:'#07111d',wall:'#153b55',edge:'#36b7d8',glow:'#35d6ff',accent:'#8cf6ff',name:'SECTOR NEXUS',pattern:'grid'},
      {floor:'#0b101b',wall:'#352c48',edge:'#a46be8',glow:'#e56dff',accent:'#f4b4ff',name:'SECTOR OMEGA',pattern:'scan'},
      {floor:'#07130f',wall:'#174b3b',edge:'#35d68e',glow:'#54ffb0',accent:'#b0ffd5',name:'SECTOR GREEN CORE',pattern:'circuit'},
      {floor:'#151006',wall:'#59401b',edge:'#e1ad38',glow:'#ffc83d',accent:'#ffe7a0',name:'SECTOR REACTOR',pattern:'reactor'},
      {floor:'#16080d',wall:'#5b1c2a',edge:'#ff4767',glow:'#ff365e',accent:'#ffb0bd',name:'BLACK SITE',pattern:'warning'},
      {floor:'#0c0717',wall:'#35205f',edge:'#8d4cff',glow:'#ff4fd8',accent:'#b9a1ff',name:'CYBER CITY',pattern:'city'},
      {floor:'#07141a',wall:'#214c5a',edge:'#6ee8ff',glow:'#8fffff',accent:'#e5ffff',name:'DEFENSE GRID',pattern:'laser'},
      {floor:'#100e08',wall:'#4d3c1c',edge:'#f4ca55',glow:'#ffe37b',accent:'#fff5bf',name:'NEXUS CORE',pattern:'core'}
    ][clamp(level,1,8)-1];
  }

  function renderBackground(ctx,level,time){
    const th=theme(level);

    // La imagen es la base visual de todos los niveles. Encima aplicamos
    // una capa de color diferente por sector para conservar la progresión.
    const hasImage = drawLevelBackground(ctx);
    if(!hasImage){
      ctx.fillStyle=th.floor;
      ctx.fillRect(0,0,WIDTH,HEIGHT);
    }else{
      ctx.fillStyle='rgba(2,6,14,.22)';
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle=th.floor;
      ctx.globalAlpha=.10;
      ctx.fillRect(0,0,WIDTH,HEIGHT);
      ctx.globalAlpha=1;
    }

    ctx.save();

    if(th.pattern==='grid'){
      ctx.globalAlpha=.3;ctx.strokeStyle=th.edge;
      for(let x=0;x<WIDTH;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
      for(let y=0;y<HEIGHT;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    }else if(th.pattern==='scan'){
      ctx.globalAlpha=.18;ctx.strokeStyle=th.glow;
      for(let y=(time*30)%12;y<HEIGHT;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
      ctx.globalAlpha=.35;
      for(let i=0;i<10;i++){
        const x=((i*91+time*22)%WIDTH+WIDTH)%WIDTH;
        ctx.fillStyle=th.glow;ctx.fillRect(x,0,1,HEIGHT);
      }
    }else if(th.pattern==='circuit'){
      ctx.globalAlpha=.32;ctx.strokeStyle=th.edge;
      for(let y=16;y<HEIGHT;y+=48)for(let x=16;x<WIDTH;x+=64){
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+24,y);ctx.lineTo(x+24,y+16);ctx.lineTo(x+42,y+16);ctx.stroke();
        ctx.fillStyle=th.glow;ctx.fillRect(x+22,y-2,4,4);
      }
    }else if(th.pattern==='reactor'){
      ctx.translate(WIDTH/2,HEIGHT/2);
      ctx.globalAlpha=.22;ctx.strokeStyle=th.glow;
      for(let r=80;r<360;r+=55){
        ctx.beginPath();ctx.arc(0,0,r+Math.sin(time*2+r)*5,time*.15,time*.15+Math.PI*1.6);ctx.stroke();
      }
      ctx.setTransform(1,0,0,1,0,0);
    }else if(th.pattern==='warning'){
      ctx.globalAlpha=.2;ctx.strokeStyle=th.glow;ctx.lineWidth=7;
      for(let x=-HEIGHT;x<WIDTH;x+=32){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+HEIGHT,HEIGHT);ctx.stroke();
      }
      ctx.globalAlpha=.5;ctx.fillStyle=th.accent;
      ctx.fillRect(0,((time*18)%HEIGHT),WIDTH,2);
    }else if(th.pattern==='city'){
      ctx.globalAlpha=.25;ctx.strokeStyle=th.edge;
      for(let x=0;x<WIDTH;x+=48)for(let y=20;y<HEIGHT;y+=64){
        const h=16+((x+y)%32);
        ctx.strokeRect(x+6,y-h,30,h);
      }
      ctx.globalAlpha=.5;
      for(let i=0;i<18;i++){
        const x=((i*71+time*25*(i%2?1:-1))%WIDTH+WIDTH)%WIDTH;
        const y=(i*37)%HEIGHT;
        ctx.fillStyle=i%2?th.glow:th.accent;ctx.fillRect(x,y,2,2);
      }
    }else if(th.pattern==='laser'){
      ctx.globalAlpha=.3;ctx.strokeStyle=th.glow;
      const offset=(time*40)%32;
      for(let x=-32+offset;x<WIDTH+32;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
      for(let y=-32+offset;y<HEIGHT+32;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
      ctx.globalAlpha=.6;ctx.fillStyle=th.accent;ctx.fillRect(0,HEIGHT*.5,WIDTH,1);
    }else{
      const pulse=1+Math.sin(time*2.5)*.08;
      ctx.translate(WIDTH/2,HEIGHT/2);
      ctx.globalAlpha=.18;ctx.strokeStyle=th.glow;
      for(let r=45;r<260;r+=42){
        ctx.beginPath();ctx.arc(0,0,r*pulse,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=.5;ctx.fillStyle=th.glow;
      ctx.beginPath();ctx.arc(0,0,5+Math.sin(time*4)*2,0,Math.PI*2);ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha=.8;
    for(let i=0;i<12;i++){
      const x=((i*83+time*18*(i%2?1:-1))%WIDTH+WIDTH)%WIDTH;
      const y=(i*47)%HEIGHT;
      ctx.strokeStyle=th.glow;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+18,y);ctx.lineTo(x+28,y+8);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  function makeFragmentCode(index,level){
    const alphabet='0123456789ABCDEF';
    const a=alphabet[(index*7+level*3)%alphabet.length];
    const b=alphabet[(index*11+level*5+2)%alphabet.length];
    return a+b;
  }

  function drawVerticalCode(ctx,code,x,y,accent){
    ctx.save();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font='bold 5px monospace';
    ctx.fillStyle='#020711cc';
    ctx.fillRect(x-4,y-9,8,22);
    ctx.fillStyle=accent;
    for(let i=0;i<code.length;i++)ctx.fillText(code[i],x,y+i*6-6);
    ctx.restore();
  }

  function renderMap(ctx,map,level,time){
    const th=theme(level);renderBackground(ctx,level,time);
    for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
      const v=map[y][x],px=x*TILE,py=y*TILE;
      if(v===1){
        drawWallTile(ctx,px,py,x,y,th);
      }else{
        // El suelo queda parcialmente transparente para que la ilustración
        // se perciba dentro de los corredores del laberinto.
        ctx.fillStyle=th.floor;
        ctx.globalAlpha=.26;
        ctx.fillRect(px,py,TILE,TILE);
        ctx.globalAlpha=1;
        ctx.strokeStyle='#ffffff16';
        ctx.strokeRect(px,py,TILE,TILE);
        if(v===3){ctx.fillStyle=th.glow+'55';ctx.fillRect(px+5,py+5,22,22);}
        if(v===4){ctx.fillStyle=th.accent;ctx.fillRect(px+10,py+10,12,12);}
        if(v===5){ctx.fillStyle='#ff435a';ctx.fillRect(px+10,py+10,12,12);}
      }
    }
    ctx.fillStyle=th.accent;ctx.font='bold 12px monospace';ctx.fillText(th.name,12,16);
  }

  function drawDebug(ctx,g){
    ctx.save();ctx.fillStyle='#02050de8';ctx.fillRect(8,24,405,190);
    ctx.fillStyle='#80ffbf';ctx.font='12px monospace';
    const p=tileOf(g.player);
    const lines=[`DEBUG F2 | FPS ${Math.round(g.fps)}`,`PLAYER TILE ${p.x},${p.y}`,`SCORE ${g.score} | LIVES ${g.lives} | LEVEL ${g.level}`,`POWER ${g.powerTimer.toFixed(1)}s | SECTOR ${theme(g.level).name}`];
    g.enemies.forEach(e=>lines.push(`${e.name} | ${e.state} | TILE ${tileOf(e).x},${tileOf(e).y} | DIST ${dist(e,g.player).toFixed(0)} | PATH ${e.path.length}`));
    lines.forEach((s,i)=>ctx.fillText(s,16,45+i*20));
    ctx.strokeStyle='#ffffff66';ctx.lineWidth=1;
    for(const e of g.enemies){ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.target.x*TILE+16,e.target.y*TILE+16);ctx.stroke();}
    ctx.restore();
  }

  // ------------------------------------------------------------
  // GAME
  // ------------------------------------------------------------
  class Game {
    constructor(canvas,input,audio,sprites){
      this.ctx=canvas.getContext('2d');this.input=input;this.audio=audio;this.sprites=sprites;
      this.player=new Player(sprites);this.enemies=[];this.level=1;this.score=0;this.lives=3;this.powerTimer=0;this.combo=200;this.debug=false;this.paused=false;this.ended=false;this.time=0;this.fps=60;
      this.map=parseLevel(LEVELS[0]);this.portal=new Portal({x:9,y:13},{x:16,y:13});this.fragments=[];
    }
    loadLevel(n){
      this.level=n;
      this.map=cloneMap(LEVELS[n-1]||LEVELS[LEVELS.length-1]);

      const starts=[],portals=[];
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(this.map[y][x]===4)starts.push({x,y});
        if(this.map[y][x]===3)portals.push({x,y});
      }

      const start=starts[0]||{x:1,y:1};
      this.player.setStart(start);

      const open=[];
      for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++){
        if(this.map[y][x]===0)open.push({x,y});
      }

      const usable=open.filter(p=>
        Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>6 &&
        !portals.some(q=>q.x===p.x&&q.y===p.y)
      );

      // Fragmentos aumentan progresivamente. Los power-ups aparecen con una
      // frecuencia controlada para que la energía siga siendo especial.
      this.fragments=[];
      const count=Math.min(42,18+n*3);
      const pool=usable.length?usable:open;
      const used=new Set();
      for(let i=0;i<count&&pool.length;i++){
        let index=(i*17+n*13)%pool.length;
        let p=pool[index];
        let tries=0;
        while(used.has(`${p.x},${p.y}`)&&tries<pool.length){
          index=(index+1)%pool.length;p=pool[index];tries++;
        }
        used.add(`${p.x},${p.y}`);
        this.fragments.push({
          x:p.x,y:p.y,collected:false,
          power:i===0||i%Math.max(5,10-Math.floor(n/2))===0,
          code:makeFragmentCode(i,n)
        });
      }

      // Las posiciones iniciales de los agentes cambian en cada nivel.
      // Usamos objetivos distintos y buscamos la casilla abierta más cercana,
      // evitando jugador, fragmentos y portales.
      const hasExit=p=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{
        const x=p.x+dx,y=p.y+dy;
        return x>=0&&y>=0&&x<COLS&&y<ROWS&&this.map[y]?.[x]===0;
      });
      const spawnTargets=[
        [{x:23,y:1},{x:23,y:13},{x:12,y:13},{x:12,y:7}],
        [{x:1,y:1},{x:23,y:1},{x:1,y:13},{x:23,y:13}],
        [{x:5,y:3},{x:19,y:3},{x:5,y:11},{x:19,y:11}],
        [{x:3,y:7},{x:21,y:7},{x:12,y:3},{x:12,y:11}],
        [{x:21,y:2},{x:3,y:2},{x:21,y:12},{x:3,y:12}],
        [{x:7,y:2},{x:17,y:2},{x:7,y:12},{x:17,y:12}],
        [{x:2,y:5},{x:22,y:5},{x:2,y:9},{x:22,y:9}],
        [{x:10,y:2},{x:14,y:2},{x:10,y:12},{x:14,y:12}]
      ];
      const targets=spawnTargets[(n-1)%spawnTargets.length];
      const spawnCandidates=pool.filter(p=>
        !used.has(`${p.x},${p.y}`) &&
        !portals.some(q=>q.x===p.x&&q.y===p.y) &&
        Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>5 &&
        hasExit(p)
      );
      const chosen=[];
      const nearestAvailable=target=>{
        const list=spawnCandidates.filter(p=>!chosen.some(q=>q.x===p.x&&q.y===p.y));
        return list.reduce((best,p)=>{
          const d=Math.abs(p.x-target.x)+Math.abs(p.y-target.y);
          return !best||d<best.d?{p,d}:best;
        },null)?.p;
      };
      for(const target of targets){
        const p=nearestAvailable(target);
        if(p)chosen.push(p);
      }
      // Respaldo por si un laberinto muy cerrado deja menos de cuatro candidatos.
      const fallbackPool=pool.filter(p=>
        !used.has(`${p.x},${p.y}`) &&
        !portals.some(q=>q.x===p.x&&q.y===p.y) &&
        !chosen.some(q=>q.x===p.x&&q.y===p.y)
      );
      let fi=0;
      while(chosen.length<4&&fallbackPool.length){
        chosen.push(fallbackPool[fi%fallbackPool.length]);
        fi++;
      }
      while(chosen.length<4)chosen.push(start);

      this.enemies=[
        new Enemy('Alpha',chosen[0].x,chosen[0].y,0,this.sprites),
        new Enemy('Beta',chosen[1].x,chosen[1].y,1,this.sprites),
        new Enemy('Gamma',chosen[2].x,chosen[2].y,2,this.sprites),
        new Enemy('Delta',chosen[3].x,chosen[3].y,3,this.sprites)
      ];

      if(portals.length>=2){
        this.portal=new Portal(portals[0],portals[1]);
      }else{
        const portalCandidates=open.filter(p=>
          Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>6 &&
          Math.abs(p.x-start.x)+Math.abs(p.y-start.y)<999
        );
        const a=portalCandidates[0]||{x:COLS-2,y:ROWS-2};
        const b=portalCandidates.find(p=>Math.abs(p.x-a.x)+Math.abs(p.y-a.y)>8)||{x:COLS-2,y:1};
        this.portal=new Portal(a,b);
      }

      this.powerTimer=0;
      this.combo=200;
      this.ended=false;
      this.paused=false;
      this.levelIntro=1.6;
      updateHUD(this);
    }
    startNew(){this.score=0;this.lives=3;this.loadLevel(1);this.time=0;}
    restartLevel(){this.loadLevel(this.level);}
    update(dt){
      if(this.ended||this.paused)return;
      this.time+=dt;
      this.levelIntro=Math.max(0,(this.levelIntro||0)-dt);
      this.portal.update(dt);
      this.powerTimer=Math.max(0,this.powerTimer-dt);

      if(this.input.pressed('F2'))this.debug=!this.debug;
      if(this.input.pressed('p','P'))this.togglePause();
      if(this.input.pressed('r','R'))this.restartLevel();
      if(this.input.pressed('m','M'))this.audio.toggle();

      this.player.update(dt,this.input,this.map);
      this.portal.teleport(this.player);

      for(const e of this.enemies){
        e.update(dt,this);
        if(e.state!==STATE.RESPAWN&&e.state!==STATE.APPEARING)this.portal.teleport(e);
      }

      this.collect();
      this.collisions();

      if(this.fragments.length&&this.fragments.every(f=>f.collected))this.nextLevel();
      updateHUD(this);
    }
    collect(){
      for(const f of this.fragments){
        if(!f.collected&&dist(this.player,center(f))<17){f.collected=true;this.score+=f.power?100:50;this.audio.beep(f.power?980:650,f.power?.12:.05);
          if(f.power){this.powerTimer=Math.max(5,7-(this.level-1)*.18);this.combo=200;}
        }
      }
    }
    collisions(){
      for(const e of this.enemies){
        if(e.state===STATE.RESPAWN||e.state===STATE.APPEARING)continue;
        if(dist(this.player,e)<20){
          if(e.state===STATE.FRIGHTENED){
            this.score+=this.combo;
            this.combo=Math.min(1600,this.combo*2);
            this.audio.beep(1050,.12);
            e.path=[];e.setState(STATE.RESPAWN);
          }else if(this.player.inv<=0){
            this.lives--;
            this.player.inv=2;
            this.player.setHurt();
            this.combo=200;
            this.audio.beep(95,.2);
            if(this.lives<=0)this.gameOver();
            else this.restartLevel();
          }
        }
      }
    }
    nextLevel(){
      this.score+=500;this.audio.beep(1200,.16);
      this.level++;
      if(this.level>8){this.gameOver(true);return;}
      this.loadLevel(this.level);
    }
    gameOver(win=false){
      this.ended=true;this.audio.stopMusic();Store.saveScore({name:operatorName,score:this.score,level:this.level,date:new Date().toLocaleString()});
      $('#finalTitle').textContent=win?'PROTOCOLO COMPLETADO':'GAME OVER';$('#finalScore').textContent=`Puntuación: ${this.score} · Nivel: ${this.level}`;$('#finalStats').textContent=`Operador: ${operatorName} · Datos recuperados: ${this.fragments.filter(f=>f.collected).length}/${this.fragments.length}`;show('#gameover');
    }
    togglePause(){this.paused=!this.paused;$('#pause').classList.toggle('hidden',!this.paused);}
    draw(){
      const c=this.ctx;
      c.clearRect(0,0,WIDTH,HEIGHT);
      renderMap(c,this.map,this.level,this.time);

      this.portal.draw(c,this.time);

      for(const f of this.fragments)if(!f.collected){
        const p=center(f);
        c.save();
        c.translate(p.x,p.y);
        const pulse=1+Math.sin(this.time*6+p.x)*.08;

        if(f.power && powerUpTextureReady && powerUpTexture.naturalWidth){
          // El objeto enviado por el usuario es ahora el Power Up oficial.
          // Se conserva su pixel-art y se escala suavemente para darle vida.
          c.imageSmoothingEnabled=false;
          c.shadowColor=theme(this.level).glow;
          c.shadowBlur=16;
          c.globalAlpha=.96;
          const w=20*pulse;
          const h=27*pulse;
          c.drawImage(powerUpTexture,-w/2,-h/2,w,h);

          // Aura exterior muy sutil para diferenciarlo de los fragmentos.
          c.globalAlpha=.28;
          c.strokeStyle=theme(this.level).accent;
          c.lineWidth=1.5;
          c.beginPath();
          c.arc(0,0,18*pulse,0,Math.PI*2);
          c.stroke();
        }else if(fragmentTextureReady && fragmentTexture.naturalWidth){
          // Fragmento de datos oficial proporcionado por el usuario.
          c.imageSmoothingEnabled=false;
          c.globalAlpha=.98;
          c.shadowColor=theme(this.level).glow;
          c.shadowBlur=8;
          const w=17*pulse;
          const h=20*pulse;
          c.drawImage(fragmentTexture,-w/2,-h/2,w,h);
        }else{
          // Respaldo si el PNG todavía está cargando o no está disponible.
          c.rotate(this.time*2);
          c.fillStyle='#75eaff';
          c.shadowColor='#75eaff';
          c.shadowBlur=7;
          c.fillRect(-4*pulse,-4*pulse,8*pulse,8*pulse);
        }

        // Código hexadecimal vertical para dar identidad a cada fragmento.
        // Se apila carácter por carácter en lugar de ocupar espacio horizontal.
        drawVerticalCode(c,f.code||'00',9,-1,theme(this.level).accent);
        c.restore();
      }

      this.player.draw(c,this.time);
      for(const e of this.enemies)e.draw(c,this.time);

      if(this.levelIntro>0){
        c.save();
        c.fillStyle='#020711cc';
        c.fillRect(180,190,440,100);
        c.strokeStyle=theme(this.level).glow;
        c.strokeRect(180,190,440,100);
        c.textAlign='center';
        c.fillStyle=theme(this.level).accent;
        c.font='bold 18px monospace';
        c.fillText(`NIVEL ${this.level}`,400,225);
        c.font='bold 13px monospace';
        c.fillText(theme(this.level).name,400,250);
        c.font='10px monospace';
        c.fillStyle='#c7eaff';
        c.fillText('RECUPERA LOS DATOS // EVITA O CAPTURA A LOS AGENTES',400,273);
        c.restore();
      }

      if(this.debug)drawDebug(c,this);
    }
  }

  // ------------------------------------------------------------
  // EDITOR
  // ------------------------------------------------------------
  const input=new Input(),audio=new AudioManager(),sprites=new SpriteManager();
  const nameInput=$('#playerName');
  let operatorName=Store.read('cyberMazeOperator','JUGADOR');
  nameInput.value=operatorName;
  nameInput.addEventListener('input',()=>{operatorName=(nameInput.value.trim()||'JUGADOR').slice(0,14).toUpperCase();Store.write('cyberMazeOperator',operatorName);});
  const touchKeys={up:false,down:false,left:false,right:false,attack:false};
  document.querySelectorAll('[data-dir]').forEach(b=>{
    const d=b.dataset.dir;
    const on=e=>{e.preventDefault();touchKeys[d]=true;};
    const off=e=>{e.preventDefault();touchKeys[d]=false;};
    b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointerleave',off);b.addEventListener('pointercancel',off);
  });
  const canvas=$('#gameCanvas');canvas.width=WIDTH;canvas.height=HEIGHT;
  const game=new Game(canvas,input,audio,sprites);
  let editorMap=parseLevel(LEVELS[0]),editorTool=1;

  function show(id){document.querySelectorAll('.panel,.screen').forEach(e=>e.classList.add('hidden'));$(id).classList.remove('hidden');}

  function startGame(){
    show('#game');
    game.startNew();
    audio.startMusic();
  }

  function restartGame(){
    show('#game');
    game.startNew();
    audio.startMusic();
  }

  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function ranking(){show('#ranking');const scores=Store.scores();$('#rankingList').innerHTML=scores.length?scores.slice(0,10).map((s,i)=>`<li>${i+1}. ${escapeHtml(s.name)} — ${s.score} pts — nivel ${s.level}</li>`).join(''):'<li>Sin puntuaciones todavía</li>';}
  function initEditor(){show('#editor');drawEditor();}
  function drawEditor(){
    const c=$('#editorCanvas'),ctx=c.getContext('2d');c.width=WIDTH;c.height=HEIGHT;renderMap(ctx,editorMap,1,0);
    ctx.strokeStyle='#ffffff35';for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*TILE,0);ctx.lineTo(x*TILE,HEIGHT);ctx.stroke();}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*TILE);ctx.lineTo(WIDTH,y*TILE);ctx.stroke();}
  }
  function setEditorTile(e){
    const c=$('#editorCanvas'),r=c.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/(r.width/COLS)),y=Math.floor((e.clientY-r.top)/(r.height/ROWS));
    if(editorMap[y]&&editorMap[y][x]!==undefined){editorMap[y][x]=editorTool;drawEditor();}
  }
  $('#editorCanvas').addEventListener('mousedown',setEditorTile);
  document.querySelectorAll('[data-tile]').forEach(b=>b.addEventListener('click',()=>{editorTool=+b.dataset.tile;document.querySelectorAll('[data-tile]').forEach(q=>q.classList.remove('selected'));b.classList.add('selected');}));
  $('#saveLevel').addEventListener('click',()=>{Store.saveLevel({name:`Nivel local ${new Date().toLocaleString()}`,map:cloneMap(editorMap)});$('#editorInfo').textContent='Nivel guardado en localStorage.';});
  $('#loadLevel').addEventListener('click',()=>{const l=Store.levels()[0];if(l){editorMap=cloneMap(l.map);drawEditor();$('#editorInfo').textContent='Último nivel local cargado.';}else $('#editorInfo').textContent='No hay niveles guardados.';});
  $('#clearLevel').addEventListener('click',()=>{editorMap=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>(x===0||y===0||x===COLS-1||y===ROWS-1)?1:0));drawEditor();});

  document.addEventListener('click',e=>{
    const a=e.target.dataset.action;
    if(a==='start')startGame();
    else if(a==='editor')initEditor();
    else if(a==='ranking')ranking();
    else if(a==='credits')show('#credits');else if(a==='howto')show('#howto');
    else if(a==='resume')game.togglePause();
    else if(a==='restart')restartGame();
    else if(a==='menu'){game.ended=true;game.audio.stopMusic();show('#menu');}
  });

  // ------------------------------------------------------------
  // LOOP
  // ------------------------------------------------------------
  let last=performance.now();
  function loop(now){
    const dt=Math.min(.05,(now-last)/1000);last=now;game.fps=1/Math.max(dt,.001);
    if(!$('#game').classList.contains('hidden')){game.update(dt);game.draw();}
    input.end();requestAnimationFrame(loop);
  }
  game.loadLevel(1);updateHUD(game);requestAnimationFrame(loop);

  function updateHUD(g){
    $('#hudScore').textContent=`PUNTOS: ${g.score}`;$('#hudLives').textContent=`VIDAS: ${g.lives}`;$('#hudLevel').textContent=`NIVEL: ${g.level}`;
    const total=g.fragments.length,collected=g.fragments.filter(f=>f.collected).length;
    $('#hudProgress').textContent=`DATOS: ${collected}/${total}`;
    $('#hudCombo').textContent=`COMBO: x${Math.max(1,Math.round(g.combo/200))}`;
    $('#hudState').textContent=g.paused?'PAUSED':g.powerTimer>0?'ENERGÍA · CAZA':'PLAYING';
    const maxPower=Math.max(5,7-(g.level-1)*.18);
    const bar=$('#powerBar');bar.style.width=`${Math.min(100,g.powerTimer/maxPower*100)}%`;
  }
})();
