// ── Global state ──

// Sprite sheets
let marioSheet, blocksSheet, enemiesSheet, yoshiSheet, rideSheet, eatSheet;

// Sounds (keyed for easy iteration in stopAllSounds)
let sounds = {
  music: null,
  music2: null,
  music3: null,
  death: null,
  gameOver: null,
  levelComplete: null,
  coin: null,
};

// Kept outside `sounds` so stopAllSounds() never touches it.
let yoshiHatchSound = null;

// Game state
let game = {
  state: 'menu', // 'menu', 'playerSelect', 'controllerConnect', 'playing', 'dying', 'dead', 'gameover', 'levelComplete'
  lives: 3,
  score: 0,
  coinCount: 0,
  currentLevel: 0,
  yoshiHatching: false,
};

// Level state
let levelData = [];
let levelCols = 0;
let levelRows = 0;
let cameraX = 0;

// Entities
let enemies = [];
let popups = [];      // mushrooms popping out of ? blocks
let coinPopups = [];   // coins popping out of coin blocks

// Players
let mario, luigi;
let players = [];
let twoPlayer = false;

// Menu state
let useController = false;
let menuSelection = 0;        // 0 = controller, 1 = keyboard
let playerSelectChoice = 0;   // 0 = 1 player, 1 = 2 players

// Timers
let deathTimer = 0;
let levelCompleteTimer = 0;

// Uniform scale applied to the world draw so the full level height fits the
// screen (otherwise the ground row is cut off on short viewports like iPhone
// landscape). Updated every frame in draw() before camera + world render.
let viewScale = 1;

// ── p5.js lifecycle ──

function preload() {
  marioSheet = loadImage('assets/mario.png');
  blocksSheet = loadImage('assets/blocks.png');
  enemiesSheet = loadImage('assets/enemies.png');
  yoshiSheet = loadImage('assets/yoshi.png');
  rideSheet = loadImage('assets/mario_yoshi.png');
  eatSheet = loadImage('assets/yoshi_eat.png');
  // Pass error callback so a single failed decode (common on iOS Safari)
  // doesn't leave preload hanging — the game starts muted for that track.
  loadSoundSafe('music',         'assets/audio/music_ground.mp3');
  loadSoundSafe('music2',        'assets/audio/music_player_select.mp3');
  loadSoundSafe('music3',        'assets/audio/music_overworld.mp3');
  loadSoundSafe('death',         'assets/audio/music_death.mp3');
  loadSoundSafe('gameOver',      'assets/audio/music_gameover.mp3');
  loadSoundSafe('levelComplete', 'assets/audio/music_level_complete.mp3');
  loadSoundSafe('coin',          'assets/audio/sfx_coin.wav');
  yoshiHatchSound = loadSound('assets/audio/yoshi_hatch.mp3', null, () => { yoshiHatchSound = null; });
}

function loadSoundSafe(key, path) {
  sounds[key] = loadSound(path, null, () => { sounds[key] = null; });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  game.currentLevel = 0;
  // Force the AudioContext into existence (suspended) so p5.sound can
  // register its AudioWorklet. We do NOT resume it here — that requires a
  // user gesture on iOS and is handled by handleFirstGesture() on first tap.
  try { getAudioContext(); } catch (e) { /* ignore */ }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ── p5 input entry points (handlers are picked up by p5 from global scope).
// First-gesture unlock + menu-advance live in src/mobile.js.

function touchStarted() {
  handleFirstGesture();
  handleMenuTouchAdvance();
  return false; // preventDefault → suppress Safari double-tap-zoom / scroll
}
function mousePressed() {
  handleFirstGesture();
  // On a touchscreen device, the synthesized mouse click would advance the
  // menu a second time — touchStarted already handled it.
  if (!isTouchDevice) handleMenuTouchAdvance();
}

function draw() {
  // On a phone held upright the game would squash horizontally — iOS PWAs
  // can't be orientation-locked, so block gameplay with a rotate prompt and
  // resume automatically once the user turns the device.
  if (isTouchDevice && height > width) {
    drawRotatePrompt();
    return;
  }

  updateTouchControls();

  if (game.state === 'menu') { drawMenu(); return; }
  if (game.state === 'playerSelect') { drawPlayerSelect(); return; }
  if (game.state === 'controllerConnect') { drawControllerConnect(); return; }

  let bg = LEVEL_THEMES[game.currentLevel].bg;
  background(bg[0], bg[1], bg[2]);

  // Fit the trimmed stage (10 rows) into the viewport height exactly, so the
  // level always fills the screen vertically on any viewport. noSmooth() keeps
  // pixel art crisp even at fractional scales.
  viewScale = levelRows > 0 ? height / (levelRows * TILE_DRAW) : 1;

  switch (game.state) {
    case 'playing':
      // Yoshi hatch cutscene: only update the egg animation, freeze everything else.
      if (game.yoshiHatching) {
        updateYoshiEggs();
        break;
      }
      for (let p of players) {
        if (p.growing) {
          p.growTimer--;
          if (p.growTimer <= 0) finishGrowingPlayer(p);
        }
      }
      for (let p of players) {
        if (!p.dead && !p.growing) updatePlayer(p);
      }
      for (let p of players) {
        if (p.dead && p.respawnTimer > 0) {
          p.respawnTimer--;
          if (p.respawnTimer <= 0) respawnPlayer(p);
        }
      }
      updateEnemies();
      updateYoshiEggs();
      updateYoshis();
      for (let p of players) {
        if (!p.dead) {
          checkYoshiMountFor(p);
          yoshiTryEat(p);
          checkEnemyCollisionsFor(p);
          checkMushroomCollectionFor(p);
        }
      }
      updatePopups();
      updateCoinPopups();
      updateCamera();
      break;

    case 'dying':
      for (let p of players) {
        if (p.dead) {
          p.vy += GRAVITY;
          p.worldY += p.vy;
        }
      }
      if (deathTimer > 0) {
        deathTimer--;
        if (deathTimer <= 0) {
          game.lives--;
          if (game.lives <= 0) {
            game.state = 'gameover';
            if (sounds.gameOver) sounds.gameOver.play();
          } else {
            game.state = 'dead';
          }
        }
      }
      break;
  }

  // Anchor ground to the bottom of the screen: translate so the scaled stage
  // ends flush with `height`, leaving any extra space as sky above.
  let stageScreenH = levelRows * TILE_DRAW * viewScale;
  let worldYOffset = height - stageScreenH;
  push();
  translate(0, worldYOffset);
  scale(viewScale);
  drawLevel();
  drawEnemies();
  drawPopups();
  drawCoinPopups();
  drawYoshiEggs();
  drawYoshis();
  drawAllPlayers();
  pop();
  drawHUD();
  drawTouchControls();
  drawSpriteDebug();

  if (game.state === 'levelComplete') {
    levelCompleteTimer--;
    pollOverlayControls();
    if (game.currentLevel < LEVELS.length - 1) {
      drawOverlay('WORLD ' + LEVEL_THEMES[game.currentLevel].name + ' CLEAR!', 'Press SPACE for next level');
    } else {
      drawOverlay('YOU WIN!', 'Final score: ' + game.score + '  |  Press R to play again');
    }
  } else if (game.state === 'dead') {
    pollOverlayControls();
    drawOverlay('YOU DIED!', 'Press R to retry (' + game.lives + ' lives left)');
  } else if (game.state === 'gameover') {
    pollOverlayControls();
    drawOverlay('GAME OVER', 'Press R to restart');
  }
}

// ── DEBUG: resizable + draggable sprite picker overlay ──
// Press 'G' to show, 'H' to hide.
// Each square can be MOVED by dragging its body and RESIZED by dragging
// the yellow handle in the bottom-right corner.

let _showSpriteDebug = false;
let _debugScale = 2;
let _debugOX = 10, _debugOY = 10;
let _debugHandleSize = 18; // resize handle in bottom-right corner

let _debugBoxes = [
  { label: 'B0', x: 70,  y: 220, w: 40, h: 44, col: [255, 100, 100] },
  { label: 'B1', x: 120, y: 220, w: 40, h: 44, col: [255, 160, 60] },
  { label: 'B2', x: 170, y: 220, w: 40, h: 44, col: [255, 255, 60] },
  { label: 'B3', x: 220, y: 220, w: 40, h: 44, col: [100, 255, 100] },
  { label: 'B4', x: 270, y: 220, w: 40, h: 44, col: [100, 200, 255] },
  { label: 'M0', x: 70,  y: 520, w: 64, h: 64, col: [200, 100, 255] },
  { label: 'M1', x: 150, y: 520, w: 64, h: 64, col: [255, 100, 200] },
];
let _debugAction = 'none'; // 'none', 'move', 'resize'
let _debugIdx = -1;
let _debugOff = { x: 0, y: 0 };

function drawSpriteDebug() {
  if (keyIsDown(71)) _showSpriteDebug = true;   // G
  if (keyIsDown(72)) _showSpriteDebug = false;  // H
  if (!_showSpriteDebug) return;

  let s = _debugScale;
  let ox = _debugOX, oy = _debugOY;
  let hs = _debugHandleSize;

  // Backdrop
  fill(0, 0, 0, 230);
  noStroke();
  rect(0, 0, width, height);

  // Sprite sheet
  image(yoshiSheet, ox, oy, 503 * s, 620 * s);

  // Pointer (mouse or first touch)
  let mx = mouseX, my = mouseY;
  let pressing = mouseIsPressed;
  if (touches.length > 0) { mx = touches[0].x; my = touches[0].y; pressing = true; }

  // Start drag / resize
  if (pressing && _debugAction === 'none') {
    for (let i = _debugBoxes.length - 1; i >= 0; i--) {
      let b = _debugBoxes[i];
      // Check resize handle first (bottom-right corner)
      let hx = b.x + b.w - hs, hy = b.y + b.h - hs;
      if (mx >= hx && mx <= hx + hs && my >= hy && my <= hy + hs) {
        _debugAction = 'resize';
        _debugIdx = i;
        _debugOff.x = mx - (b.x + b.w);
        _debugOff.y = my - (b.y + b.h);
        break;
      }
      // Check body for move
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        _debugAction = 'move';
        _debugIdx = i;
        _debugOff.x = mx - b.x;
        _debugOff.y = my - b.y;
        break;
      }
    }
  }

  // Apply drag / resize
  if (pressing && _debugIdx >= 0) {
    let b = _debugBoxes[_debugIdx];
    if (_debugAction === 'move') {
      b.x = mx - _debugOff.x;
      b.y = my - _debugOff.y;
    } else if (_debugAction === 'resize') {
      b.w = max(20, mx - b.x - _debugOff.x);
      b.h = max(20, my - b.y - _debugOff.y);
    }
  }

  // Release
  if (!pressing) { _debugAction = 'none'; _debugIdx = -1; }

  // Draw boxes
  textAlign(CENTER, CENTER);
  for (let b of _debugBoxes) {
    // Box outline + tinted fill
    stroke(b.col[0], b.col[1], b.col[2]);
    strokeWeight(2);
    fill(b.col[0], b.col[1], b.col[2], 50);
    rect(b.x, b.y, b.w, b.h);

    // Resize handle (yellow square, bottom-right)
    noStroke();
    fill(255, 255, 0);
    rect(b.x + b.w - hs, b.y + b.h - hs, hs, hs);

    // Label
    fill(255);
    textSize(13);
    text(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }

  // Coordinate readout panel
  let panelX = min(width - 280, 503 * s + ox + 20);
  let panelY = oy;
  fill(0, 0, 0, 200);
  noStroke();
  rect(panelX, panelY, 270, _debugBoxes.length * 28 + 70);
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text('Drag body to move, yellow', panelX + 8, panelY + 8);
  text('corner to resize. Press H to hide.', panelX + 8, panelY + 26);
  for (let i = 0; i < _debugBoxes.length; i++) {
    let b = _debugBoxes[i];
    let imgX = round((b.x - ox) / s);
    let imgY = round((b.y - oy) / s);
    let imgW = round(b.w / s);
    let imgH = round(b.h / s);
    fill(b.col[0], b.col[1], b.col[2]);
    textSize(12);
    text(b.label + ': x=' + imgX + ' y=' + imgY + ' w=' + imgW + ' h=' + imgH, panelX + 8, panelY + 52 + i * 28);
  }
}
