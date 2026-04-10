// ── Gamepad ──

let gpJumpHeld = false;
let gpStartHeld = false;
let gpDismountHeld = false;
let gpCallYoshiHeld = false;

// Overlay UI state (controller-only RESTART / CONTINUE buttons shown on the
// dead, gameover and levelComplete screens).
let overlayChoice = 0;
let overlayLastDir = 0;
let overlayLastConfirm = false;
let overlayLastState = null;

function getGamepad() {
  let gamepads = navigator.getGamepads();
  for (let gp of gamepads) {
    if (gp) return gp;
  }
  return null;
}

// Scan every even-indexed axis (0, 2, 4…) and return the one with the
// strongest signal. Different controllers expose the X stick at different
// indices (axes[0] on standard mapping, axes[2] on many non-standard
// Bluetooth pads), so we don't hard-code one.
function readGamepadAxisX(gp) {
  let strongest = 0;
  for (let i = 0; i < gp.axes.length; i += 2) {
    let v = gp.axes[i];
    if (typeof v !== 'number' || isNaN(v)) continue;
    if (abs(v) > abs(strongest)) strongest = v;
  }
  return strongest;
}

function pollGamepad(player) {
  let gp = getGamepad();
  if (!gp || !gpMapped) {
    player.gpMoveDir = 0;
    return;
  }

  // Movement: any horizontal axis OR standard d-pad (buttons 14/15) OR a
  // user-mapped left/right button. We only report a direction here — the
  // actual speed (and the riding-Yoshi bonus) is applied in updatePlayer
  // so keyboard and controller cannot diverge.
  let axisX = readGamepadAxisX(gp);
  let dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
  let dpadRight = gp.buttons[15] && gp.buttons[15].pressed;
  let leftBtn = gpMapping.left >= 0
    && gp.buttons[gpMapping.left]
    && gp.buttons[gpMapping.left].pressed;
  let rightBtn = gpMapping.right >= 0
    && gp.buttons[gpMapping.right]
    && gp.buttons[gpMapping.right].pressed;

  if (axisX < -STICK_DEADZONE || dpadLeft || leftBtn) {
    player.gpMoveDir = -1;
  } else if (axisX > STICK_DEADZONE || dpadRight || rightBtn) {
    player.gpMoveDir = 1;
  } else {
    player.gpMoveDir = 0;
  }

  // Mapped jump button (edge-triggered)
  let jumpBtn = gp.buttons[gpMapping.jump] && gp.buttons[gpMapping.jump].pressed;
  if (jumpBtn && !gpJumpHeld) {
    if (game.state === 'playing' && player.onGround && !player.growing && !player.dead) {
      player.vy = player.jumpForce;
      player.onGround = false;
    }
    if (game.state === 'levelComplete' && game.currentLevel < LEVELS.length - 1) {
      stopAllSounds();
      game.currentLevel++;
      loadLevel(LEVELS[game.currentLevel], true);
    }
  }
  gpJumpHeld = jumpBtn;

  // Dismount Yoshi (edge-triggered)
  if (gpMapping.dismount >= 0) {
    let dismountBtn = gp.buttons[gpMapping.dismount] && gp.buttons[gpMapping.dismount].pressed;
    if (dismountBtn && !gpDismountHeld && game.state === 'playing') {
      dismountYoshiVoluntary(player);
    }
    gpDismountHeld = dismountBtn;
  }

  // Call Yoshi (edge-triggered)
  if (gpMapping.callYoshi >= 0) {
    let callBtn = gp.buttons[gpMapping.callYoshi] && gp.buttons[gpMapping.callYoshi].pressed;
    if (callBtn && !gpCallYoshiHeld && game.state === 'playing') {
      callYoshiToPlayer(player);
    }
    gpCallYoshiHeld = callBtn;
  }

  // Mapped start/restart button (edge-triggered)
  let startBtn = gp.buttons[gpMapping.start] && gp.buttons[gpMapping.start].pressed;
  if (startBtn && !gpStartHeld) {
    if (game.state === 'dead' || game.state === 'gameover' || (game.state === 'levelComplete' && game.currentLevel >= LEVELS.length - 1)) {
      stopAllSounds();
      if (game.state === 'gameover' || game.state === 'levelComplete') {
        game.lives = 3;
        game.score = 0;
        game.coinCount = 0;
        game.currentLevel = 0;
      }
      loadLevel(LEVELS[game.currentLevel]);
    }
  }
  gpStartHeld = startBtn;
}

// ── Overlay buttons (controller-only RESTART / CONTINUE) ──

function getOverlayOptions() {
  if (game.state === 'levelComplete' && game.currentLevel < LEVELS.length - 1) {
    return [
      { label: 'CONTINUE',     action: 'next' },
      { label: 'BACK TO MENU', action: 'menu' },
    ];
  }
  if (game.state === 'dead') {
    return [
      { label: 'RESTART',      action: 'retry' },
      { label: 'BACK TO MENU', action: 'menu' },
    ];
  }
  if (game.state === 'gameover' || game.state === 'levelComplete') {
    return [
      { label: 'RESTART',      action: 'restart' },
      { label: 'BACK TO MENU', action: 'menu' },
    ];
  }
  return [];
}

function executeOverlayAction(action) {
  stopAllSounds();
  if (action === 'next') {
    game.currentLevel++;
    loadLevel(LEVELS[game.currentLevel], true);
  } else if (action === 'retry') {
    loadLevel(LEVELS[game.currentLevel]);
  } else if (action === 'menu') {
    game.state = 'menu';
    menuSelection = useController ? 0 : 1;
  } else { // 'restart'
    game.lives = 3;
    game.score = 0;
    game.coinCount = 0;
    game.currentLevel = 0;
    loadLevel(LEVELS[game.currentLevel]);
  }
  overlayChoice = 0;
}

function pollOverlayControls() {
  // Reset selection on overlay state entry; ignore the first frame's button
  // state so a held jump from the previous moment doesn't auto-confirm.
  if (game.state !== overlayLastState) {
    overlayChoice = 0;
    overlayLastDir = 0;
    overlayLastConfirm = true;
    overlayLastState = game.state;
  }

  if (!useController || !gpMapped) return;
  let gp = getGamepad();
  if (!gp) return;

  let opts = getOverlayOptions();
  if (opts.length === 0) return;
  if (overlayChoice >= opts.length) overlayChoice = 0;

  // Navigation: any horizontal axis OR d-pad OR mapped left/right
  let axisX = readGamepadAxisX(gp);
  let dpadL = gp.buttons[14] && gp.buttons[14].pressed;
  let dpadR = gp.buttons[15] && gp.buttons[15].pressed;
  let mappedL = gpMapping.left >= 0 && gp.buttons[gpMapping.left] && gp.buttons[gpMapping.left].pressed;
  let mappedR = gpMapping.right >= 0 && gp.buttons[gpMapping.right] && gp.buttons[gpMapping.right].pressed;

  let dir = 0;
  if (axisX < -STICK_DEADZONE || dpadL || mappedL) dir = -1;
  else if (axisX > STICK_DEADZONE || dpadR || mappedR) dir = 1;

  // Rising-edge: only flip selection on a fresh tap
  if (dir !== 0 && overlayLastDir === 0 && opts.length > 1) {
    overlayChoice = (overlayChoice + dir + opts.length) % opts.length;
  }
  overlayLastDir = dir;

  // Confirm with the jump button (rising edge)
  let confirmBtn = gp.buttons[gpMapping.jump] && gp.buttons[gpMapping.jump].pressed;
  if (confirmBtn && !overlayLastConfirm) {
    let chosen = opts[overlayChoice];
    if (chosen) executeOverlayAction(chosen.action);
  }
  overlayLastConfirm = confirmBtn;
}

// ── Sound helpers ──

// Custom level-music loop: replaces .loop() so we can control the gap
// between repeats (some MP3s have trailing silence that makes the default
// loop pause feel very long).
const LEVEL_MUSIC_LOOP_GAP_MS = 500;
let activeLevelMusic = null;
let levelMusicLoopTimer = null;

function stopAllSounds() {
  for (let key in sounds) {
    if (sounds[key] && sounds[key].isPlaying()) sounds[key].stop();
  }
  if (levelMusicLoopTimer) {
    clearTimeout(levelMusicLoopTimer);
    levelMusicLoopTimer = null;
  }
  activeLevelMusic = null;
}

function playLevelMusic() {
  let levelMusic = game.currentLevel === 1 ? sounds.music2
                 : game.currentLevel === 2 ? sounds.music3
                 : sounds.music;
  if (!levelMusic) return;
  if (activeLevelMusic === levelMusic && levelMusic.isPlaying()) return;

  activeLevelMusic = levelMusic;
  levelMusic.setVolume(0.5);
  levelMusic.play();

  // When the track finishes, wait a fixed 500 ms and restart it.
  levelMusic.onended(() => {
    if (activeLevelMusic !== levelMusic) return;
    if (levelMusicLoopTimer) clearTimeout(levelMusicLoopTimer);
    levelMusicLoopTimer = setTimeout(() => {
      levelMusicLoopTimer = null;
      if (activeLevelMusic === levelMusic && game.state === 'playing') {
        levelMusic.play();
      }
    }, LEVEL_MUSIC_LOOP_GAP_MS);
  });
}

// ── Game start / level loading ──

function startGame() {
  game.currentLevel = 0;
  game.lives = 3;
  game.score = 0;
  game.coinCount = 0;
  loadLevel(LEVELS[game.currentLevel]);
}

function snapshotPowerUps(player) {
  if (!player) return null;
  return {
    big: player.big,
    hadYoshi: player.ridingYoshi != null,
  };
}

function applyPowerUps(player, snap) {
  if (!snap) return;
  if (snap.big) {
    player.big = true;
    player.worldY -= SPRITE_STRIDE * SCALE;
    setBigHitbox(player);
  }
  if (snap.hadYoshi) {
    let yoshi = createYoshi(player.worldX, player.worldY);
    yoshi.mounted = true;
    yoshis.push(yoshi);
    player.ridingYoshi = yoshi;
  }
}

function loadLevel(mapStrings, keepPowerUps) {
  // Snapshot power-up state BEFORE wiping players/yoshis.
  let marioSnap = keepPowerUps ? snapshotPowerUps(mario) : null;
  let luigiSnap = keepPowerUps ? snapshotPowerUps(luigi) : null;

  levelRows = mapStrings.length;
  levelCols = mapStrings[0].length;
  levelData = [];
  enemies = [];
  popups = [];
  coinPopups = [];
  resetYoshis();

  for (let r = 0; r < levelRows; r++) {
    levelData[r] = [];
    for (let c = 0; c < levelCols; c++) {
      let ch = mapStrings[r][c];

      if (ch === 'g') {
        enemies.push(createEnemy('goomba', c, r));
      } else if (ch === 'k') {
        enemies.push(createEnemy('koopa', c, r));
      }

      levelData[r][c] = TILE_CHARS[ch] !== undefined ? TILE_CHARS[ch] : null;
    }
  }

  resetPlayers();
  applyPowerUps(mario, marioSnap);
  applyPowerUps(luigi, luigiSnap);

  cameraX = 0;
  game.state = 'playing';
  playLevelMusic();
}

// ── Keyboard input ──

function keyPressed() {
  // Menu navigation
  if (game.state === 'menu') {
    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
      menuSelection = 1 - menuSelection;
    }
    if (keyCode === ENTER) {
      if (menuSelection === 0) {
        game.state = 'controllerConnect';
      } else {
        useController = false;
        game.state = 'playerSelect';
        playerSelectChoice = 0;
      }
    }
    return;
  }

  // Controller connect screen (gamepad handled in draw via polling)
  if (game.state === 'controllerConnect') {
    if (keyCode === ESCAPE) {
      if (gpMapped) {
        // Remap: reset to detection phase
        gpMapped = false;
        gpMapStep = 0;
        gpDetectPhase = true;
      } else {
        game.state = 'menu';
      }
    }
    return;
  }

  // Player select screen
  if (game.state === 'playerSelect') {
    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
      playerSelectChoice = 1 - playerSelectChoice;
    }
    if (keyCode === ENTER) {
      twoPlayer = (playerSelectChoice === 1);
      startGame();
    }
    if (keyCode === ESCAPE) {
      game.state = 'menu';
    }
    return;
  }

  // In-game controls (gamepad jump/restart handled in pollGamepad)
  let isP1Jump = key === ' ';
  let isP2Jump = twoPlayer && keyCode === KEY_W;
  let isRestart = key === 'r' || key === 'R';

  // P1 Yoshi: dismount (Up arrow) / call (Down arrow)
  if (game.state === 'playing' && !mario.dead) {
    if (keyCode === UP_ARROW) {
      dismountYoshiVoluntary(mario);
    } else if (keyCode === DOWN_ARROW) {
      callYoshiToPlayer(mario);
    }
  }

  // P1 Jump
  if (isP1Jump && game.state === 'playing' && !mario.dead && mario.onGround && !mario.growing) {
    mario.vy = mario.jumpForce;
    mario.onGround = false;
  }

  // P2 Jump
  if (isP2Jump && luigi && game.state === 'playing' && !luigi.dead && luigi.onGround && !luigi.growing) {
    luigi.vy = luigi.jumpForce;
    luigi.onGround = false;
  }

  // Next level
  if ((isP1Jump || isP2Jump || isRestart) && game.state === 'levelComplete' && game.currentLevel < LEVELS.length - 1) {
    stopAllSounds();
    game.currentLevel++;
    loadLevel(LEVELS[game.currentLevel], true);
  }

  // Restart when dead or game over
  if (isRestart && (game.state === 'dead' || game.state === 'gameover' || (game.state === 'levelComplete' && game.currentLevel >= LEVELS.length - 1))) {
    stopAllSounds();
    if (game.state === 'gameover' || game.state === 'levelComplete') {
      game.lives = 3;
      game.score = 0;
      game.coinCount = 0;
      game.currentLevel = 0;
    }
    loadLevel(LEVELS[game.currentLevel]);
  }
}
