// ── Hitbox helpers ──

function setSmallHitbox(ent) {
  ent.ox = SMALL_OX; ent.oy = SMALL_OY; ent.hw = SMALL_W; ent.hh = SMALL_H;
}

function setBigHitbox(ent) {
  ent.ox = BIG_OX; ent.oy = BIG_OY; ent.hw = BIG_W; ent.hh = BIG_H;
}

// ── Player creation ──

function createPlayer(spawnCol) {
  let p = {
    worldX: spawnCol * TILE_DRAW,
    worldY: 8 * TILE_DRAW - SPRITE_STRIDE * SCALE,
    vx: 0,
    vy: 0,
    speed: PLAYER_SPEED,
    jumpForce: JUMP_FORCE,
    onGround: true,
    facing: 1,
    animFrame: 0,
    animTimer: 0,
    state: 'idle',
    dead: false,
    big: false,
    invincible: 0,
    growing: false,
    gpMoving: false,
    growTimer: 0,
    respawnTimer: 0,
    ridingYoshi: null,
  };
  setSmallHitbox(p);
  return p;
}

function resetPlayers() {
  mario = createPlayer(3);
  if (twoPlayer) {
    luigi = createPlayer(4);
    players = [mario, luigi];
  } else {
    luigi = null;
    players = [mario];
  }
}

// ── Player input ──

function getPlayerInput(player) {
  if (player === mario) {
    let left = keyIsDown(LEFT_ARROW) || (useController && keyIsDown(padMapping.left));
    let right = keyIsDown(RIGHT_ARROW) || (useController && keyIsDown(padMapping.right));
    return { left, right };
  } else {
    return { left: keyIsDown(KEY_A), right: keyIsDown(KEY_D) };
  }
}

// ── Player update ──

function updatePlayer(player) {
  let input = getPlayerInput(player);
  let moving = false;
  let spd = player.ridingYoshi ? 4.5 : player.speed;

  if (input.left) {
    player.vx = -spd;
    player.facing = -1;
    moving = true;
  } else if (input.right) {
    player.vx = spd;
    player.facing = 1;
    moving = true;
  } else {
    player.vx = 0;
  }

  // Gamepad polling for Mario only
  if (player === mario) {
    pollGamepad(player);
    if (player.gpMoving) moving = true;
    if (!player.gpMoving && !input.left && !input.right) {
      player.vx = 0;
    }
  }

  if (player.onGround) {
    player.vy = 1;
  } else {
    player.vy += GRAVITY;
  }

  collideTiles(player);

  if (player.onGround) {
    player.worldY = round(player.worldY);
  }

  // Clamp to level left edge
  if (player.worldX < 0) {
    player.worldX = 0;
    player.vx = 0;
  }

  // Pit death
  if (player.worldY > levelRows * TILE_DRAW) {
    killPlayer(player);
    return;
  }

  // Flag reached — any player can complete the level
  let playerCol = floor((player.worldX + player.ox + player.hw / 2) / TILE_DRAW);
  for (let r = 0; r < levelRows; r++) {
    if (levelData[r][playerCol] === 'flag') {
      game.state = 'levelComplete';
      stopAllSounds();
      if (sounds.levelComplete) sounds.levelComplete.play();
      return;
    }
  }

  // Animation state
  if (!player.onGround) {
    player.state = 'jump';
  } else if (moving) {
    player.state = 'walk';
  } else {
    player.state = 'idle';
  }

  if (player.state === 'walk') {
    player.animTimer++;
    if (player.animTimer >= 6) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 3;
    }
  } else {
    player.animFrame = 0;
    player.animTimer = 0;
  }
}

// ── Grow / shrink / kill ──

function growPlayer(player) {
  if (player.big || player.growing) return;
  player.growing = true;
  player.growTimer = GROW_TIMER_FRAMES;
  player.vx = 0;
}

function finishGrowingPlayer(player) {
  player.growing = false;
  player.big = true;
  player.worldY -= SPRITE_STRIDE * SCALE;
  setBigHitbox(player);
}

function shrinkPlayer(player) {
  if (!player.big) return;
  player.big = false;
  player.invincible = INVINCIBILITY_FRAMES;
  player.worldY += SPRITE_STRIDE * SCALE;
  setSmallHitbox(player);
}

function killPlayer(player) {
  if (player.dead) return;
  dismountYoshi(player);
  player.dead = true;
  player.state = 'dead';
  player.vy = -10;
  player.vx = 0;

  // Check if the other player is also dead
  let otherAlive = false;
  for (let p of players) {
    if (p !== player && !p.dead) {
      otherAlive = true;
      break;
    }
  }

  if (otherAlive) {
    player.respawnTimer = RESPAWN_TIMER_FRAMES;
  } else {
    game.state = 'dying';
    stopAllSounds();
    deathTimer = DEATH_TIMER_FRAMES;
    if (sounds.death) sounds.death.play();
  }
}

function respawnPlayer(player) {
  let other = null;
  for (let p of players) {
    if (p !== player && !p.dead) {
      other = p;
      break;
    }
  }

  if (other) {
    player.worldX = other.worldX - TILE_DRAW;
    player.worldY = other.worldY;
  } else {
    player.worldX = 3 * TILE_DRAW;
    player.worldY = 8 * TILE_DRAW - SPRITE_STRIDE * SCALE;
  }

  player.vx = 0;
  player.vy = 0;
  player.dead = false;
  player.state = 'idle';
  player.onGround = false;
  player.invincible = INVINCIBILITY_FRAMES;
  player.big = false;
  player.growing = false;
  player.ridingYoshi = null;
  setSmallHitbox(player);
  player.respawnTimer = 0;
}

// ── Player drawing ──

function drawAllPlayers() {
  drawPlayer(mario, false);
  if (luigi) drawPlayer(luigi, true);
}

function drawPlayer(player, isLuigi) {
  if (player.dead && player.respawnTimer <= 0 && (game.state === 'gameover' || game.state === 'dead')) return;
  if (player.dead && player.respawnTimer <= 0 && game.state === 'playing') return;

  // Blink during invincibility
  if (player.invincible > 0 && floor(frameCount / 4) % 2 === 0) return;

  let screenX = player.worldX - cameraX;

  if (isLuigi) tint(100, 255, 100);

  // Draw Yoshi underneath if riding
  if (player.ridingYoshi) {
    if (isLuigi) noTint(); // temporarily remove tint for Yoshi
    drawRidingYoshi(player);
    if (isLuigi) tint(100, 255, 100);
  }

  if (player.growing) {
    let phase = floor(frameCount / 8) % 2;
    let f, drawW, drawH;
    let feetY = player.worldY + SPRITE_STRIDE * SCALE;
    if (phase === 0) {
      f = FRAMES_SMALL.idle[0];
    } else {
      f = FRAMES_BIG.idle[0];
    }
    drawW = f.w * SCALE;
    drawH = f.h * SCALE;
    push();
    translate(screenX + drawW / 2, feetY - drawH);
    scale(player.facing, 1);
    image(marioSheet, -drawW / 2, 0, drawW, drawH, f.x, f.y, f.w, f.h);
    pop();
    if (isLuigi) noTint();
    return;
  }

  let frameSet = player.big ? FRAMES_BIG : FRAMES_SMALL;
  let frames = frameSet[player.state];
  let f = frames[player.animFrame % frames.length];
  let drawW = f.w * SCALE;
  let drawH = f.h * SCALE;

  let rideOffset = player.ridingYoshi ? -24 : 0;

  push();
  translate(screenX + drawW / 2, player.worldY + rideOffset);
  scale(player.facing, 1);
  image(marioSheet, -drawW / 2, 0, drawW, drawH, f.x, f.y, f.w, f.h);
  pop();

  if (isLuigi) noTint();

  // Player label (only in 2P mode)
  if (twoPlayer) {
    let labelX = screenX + drawW / 2;
    let labelY = player.worldY - 8;
    push();
    textAlign(CENTER, BOTTOM);
    textSize(10);
    noStroke();
    fill(isLuigi ? color(100, 255, 100) : color(255, 100, 100));
    text(isLuigi ? 'P2' : 'P1', labelX, labelY);
    pop();
  }
}
