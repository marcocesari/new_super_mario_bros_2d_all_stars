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

// Game state
let game = {
  state: 'menu', // 'menu', 'playerSelect', 'controllerConnect', 'playing', 'dying', 'dead', 'gameover', 'levelComplete'
  lives: 3,
  score: 0,
  coinCount: 0,
  currentLevel: 0,
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

// ── p5.js lifecycle ──

function preload() {
  marioSheet = loadImage('assets/mario_and_items.png');
  blocksSheet = loadImage('assets/blocks.png');
  enemiesSheet = loadImage('assets/enemies.png');
  yoshiSheet = loadImage('assets/images of Yoshi.png');
  rideSheet = loadImage('assets/mario_on_yoshi.png');
  eatSheet = loadImage('assets/yoshi_eating.png');
  sounds.music = loadSound('assets/01. Ground Theme.mp3');
  sounds.music2 = loadSound('assets/02 Player Select.mp3');
  sounds.music3 = loadSound('assets/09. Overworld.mp3');
  sounds.death = loadSound('assets/08. Lost A Life Theme.mp3');
  sounds.gameOver = loadSound('assets/09. Game Over Theme.mp3');
  sounds.levelComplete = loadSound('assets/06. Level Complete Theme.mp3');
  sounds.coin = loadSound('assets/smw_coin.wav');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  game.currentLevel = 0;
  userStartAudio();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  if (game.state === 'menu') { drawMenu(); return; }
  if (game.state === 'playerSelect') { drawPlayerSelect(); return; }
  if (game.state === 'controllerConnect') { drawControllerConnect(); return; }

  let bg = LEVEL_THEMES[game.currentLevel].bg;
  background(bg[0], bg[1], bg[2]);

  switch (game.state) {
    case 'playing':
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

  drawLevel();
  drawEnemies();
  drawPopups();
  drawCoinPopups();
  drawYoshiEggs();
  drawYoshis();
  drawAllPlayers();
  drawHUD();

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
