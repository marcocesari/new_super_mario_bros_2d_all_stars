// ── Global state ──

// Sprite sheets
let marioSheet, blocksSheet, enemiesSheet, yoshiSheet, rideSheet, eatSheet;

// Title-screen logo (full "New Super Mario Bros. 2D All Stars" wordmark)
let logoImage = null;

// Sounds (keyed for easy iteration in stopAllSounds)
let sounds = {
  homeMenu: null,
  playerSelect: null,
  music: null,
  music2: null,
  music3: null,
  death: null,
  gameOver: null,
  levelComplete: null,
  coin: null,
  powerUp: null,
};

// Kept outside `sounds` so stopAllSounds() never touches it.
let yoshiHatchSound = null;
// One-shot easter-egg SFX (rapid-click on the home menu). Kept outside
// `sounds` so a screen transition's stopAllSounds() never cuts it off.
let oneUpSound = null;
// 1-up mushroom image shown by the home-menu easter egg.
let oneUpMushroomImage = null;

// Menu background video (left half of title screen)
let menuVideo = null;

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

// Between-level loading interlude: when advancing to the next level we show a
// brief "LOADING" screen (Mario-on-Yoshi in the corner) before loadLevel runs.
const LOADING_FRAMES = 75;    // ~1.25s at 60fps
let loadingTimer = 0;
let pendingLevel = null;      // { mapStrings, keepPowerUps }

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
  // Logo wordmark for the title screen. Failure falls back to the code-drawn
  // logo (see _drawMenuTitle), so a missing/broken file never blocks the menu.
  logoImage = loadImage('assets/New Super Mario Bros 2D All Stars.png',
                        null, () => { logoImage = null; });
  // Pass error callback so a single failed decode (common on iOS Safari)
  // doesn't leave preload hanging — the game starts muted for that track.
  loadSoundSafe('homeMenu',      'assets/audio/home_menu_theme.mp3');
  loadSoundSafe('playerSelect',  'assets/audio/file_and_player_select.mp3');
  loadSoundSafe('music',         'assets/audio/music_ground.mp3');
  loadSoundSafe('music2',        'assets/audio/music_player_select.mp3');
  loadSoundSafe('music3',        'assets/audio/music_overworld.mp3');
  loadSoundSafe('death',         'assets/audio/music_death.mp3');
  loadSoundSafe('gameOver',      'assets/audio/music_gameover.mp3');
  loadSoundSafe('levelComplete', 'assets/audio/music_level_complete.mp3');
  loadSoundSafe('coin',          'assets/audio/coin_sound.mp3');
  loadSoundSafe('powerUp',       'assets/audio/power_up_sound.mp3');
  yoshiHatchSound = loadSound('assets/audio/yoshi_hatch.mp3', null, () => { yoshiHatchSound = null; });
  oneUpSound = loadSound('assets/audio/1-up_sound.mp3', null, () => { oneUpSound = null; });
  oneUpMushroomImage = loadImage('assets/1_up_mushroom.jpg', null, () => { oneUpMushroomImage = null; });
}

function loadSoundSafe(key, path) {
  sounds[key] = loadSound(path, null, () => { sounds[key] = null; });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();

  // Use the New Super Mario Bros. font for ALL canvas text (the same face the
  // loading screen uses). Applied globally so every text() call inherits it;
  // re-applied once the webfont finishes loading in case it wasn't ready yet.
  textFont('New Super Mario Font U');
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { try { textFont('New Super Mario Font U'); } catch (e) {} });
  }

  game.currentLevel = 0;
  try { getAudioContext(); } catch (e) { /* ignore */ }
  // iOS native host (WKWebView + GamepadBridge.swift): preset the standard
  // W3C gamepad mapping so the player skips the manual mapping flow. No-op
  // in a regular browser — __p5NativeHost is undefined there.
  if (window.__p5NativeHost) {
    useController = true;
    gpMapped = true;
    gpMapping.jump = 0;        // A / cross
    gpMapping.eat = 1;         // B / circle
    gpMapping.dismount = 2;    // X / square
    gpMapping.callYoshi = 3;   // Y / triangle
    gpMapping.start = 9;       // Menu / options
    gpMapping.left = -1;       // use analog stick
    gpMapping.right = -1;
  }

  // Menu background video — muted + playsinline so it autoplays on iOS PWA.
  // Adjust MENU_VIDEO_START_SEC to skip the intro and begin on the action.
  const MENU_VIDEO_START_SEC = 3;

  try {
    menuVideo = createVideo(
      'assets/audio/Screen%20Recording%202026-04-25%20at%2020.28.04.mov'
    );
    menuVideo.attribute('playsinline', '');
    menuVideo.attribute('muted', '');
    menuVideo.volume(0);
    menuVideo.hide();

    // Once metadata is ready, seek to the action start and begin playing.
    menuVideo.elt.addEventListener('loadedmetadata', () => {
      menuVideo.elt.currentTime = MENU_VIDEO_START_SEC;
    });

    // When the video ends, loop back to the action start (not time 0).
    menuVideo.elt.addEventListener('ended', () => {
      menuVideo.elt.currentTime = MENU_VIDEO_START_SEC;
      let rp = menuVideo.elt.play();
      if (rp && typeof rp.catch === 'function') rp.catch(() => {});
    });

    // Attempt immediate playback (works on desktop; iOS needs a gesture).
    let vp = menuVideo.elt.play();
    if (vp && typeof vp.catch === 'function') vp.catch(() => {});
  } catch (e) { menuVideo = null; }
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
  // Suppress synthesized mouse events on touch devices (touchStarted handles those).
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
  _watchLevelMusic();

  if (game.state === 'menu') { stopScreenMusic('playerSelect'); playScreenMusic('homeMenu'); drawMenu(); return; }
  stopScreenMusic('homeMenu');
  if (game.state === 'playerSelect') { playScreenMusic('playerSelect'); drawPlayerSelect(); return; }
  stopScreenMusic('playerSelect');
  if (game.state === 'controllerConnect') { drawControllerConnect(); return; }

  // Between-level loading interlude.
  if (game.state === 'loading') {
    drawLoading();
    if (--loadingTimer <= 0 && pendingLevel) {
      let p = pendingLevel;
      pendingLevel = null;
      loadLevel(p.mapStrings, p.keepPowerUps);   // sets state back to 'playing'
    }
    return;
  }

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
  drawNativeGamepadBanner();

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

