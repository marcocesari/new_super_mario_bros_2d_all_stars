// ── Enemy creation ──

function createEnemy(type, col, row) {
  return {
    type: type,
    worldX: col * TILE_DRAW,
    worldY: row * TILE_DRAW + TILE_DRAW - SPRITE_STRIDE * SCALE,
    vx: -1.5,
    vy: 0,
    onGround: false,
    alive: true,
    active: false,
    state: 'walk', // 'walk', 'stomped', 'shell', 'shellSlide'
    facing: -1,
    animFrame: 0,
    animTimer: 0,
    stompTimer: 0,
    ox: 2 * SCALE,
    oy: 2 * SCALE,
    hw: 14 * SCALE,
    hh: 16 * SCALE,
  };
}

function stompEnemy(enemy) {
  game.score += 100;
  if (enemy.type === 'goomba') {
    enemy.state = 'stomped';
    enemy.vx = 0;
    enemy.stompTimer = STOMP_TIMER_FRAMES;
  } else if (enemy.type === 'koopa') {
    if (enemy.state === 'walk') {
      enemy.state = 'shell';
      enemy.vx = 0;
    } else if (enemy.state === 'shellSlide') {
      enemy.state = 'shell';
      enemy.vx = 0;
    }
  }
}

// ── Enemy update ──

function updateEnemies() {
  for (let enemy of enemies) {
    if (!enemy.alive) continue;

    // Activate when within 1.5 screens of camera
    let dist = enemy.worldX - cameraX;
    if (dist < -TILE_DRAW * 4 || dist > width * 1.5) {
      enemy.active = false;
      continue;
    }
    if (!enemy.active) {
      enemy.active = true;
      // Snap to ground on first activation
      for (let row = floor((enemy.worldY + enemy.oy) / TILE_DRAW); row < levelRows; row++) {
        let col = floor((enemy.worldX + enemy.ox + enemy.hw / 2) / TILE_DRAW);
        if (isSolid(row, col)) {
          enemy.worldY = row * TILE_DRAW - enemy.oy - enemy.hh;
          enemy.onGround = true;
          break;
        }
      }
    }

    // Stomped goomba countdown
    if (enemy.state === 'stomped') {
      enemy.stompTimer--;
      if (enemy.stompTimer <= 0) enemy.alive = false;
      continue;
    }

    // Stationary shell (not sliding)
    if (enemy.state === 'shell') continue;

    // Gravity
    if (enemy.onGround) {
      enemy.vy = 1;
    } else {
      enemy.vy += GRAVITY;
    }

    let prevVx = enemy.vx;
    let hitWall = collideTiles(enemy);

    if (enemy.onGround) {
      enemy.worldY = round(enemy.worldY);
    }

    // Turn around at walls
    if (hitWall && enemy.state === 'walk') {
      enemy.vx = -prevVx;
      enemy.facing = enemy.vx > 0 ? 1 : -1;
    }

    // Shell slide bounces off walls
    if (hitWall && enemy.state === 'shellSlide') {
      enemy.vx = -prevVx;
    }

    // Edge detection for walking enemies (don't walk off ledges)
    if (enemy.state === 'walk' && enemy.onGround) {
      let aheadX = enemy.worldX + enemy.ox + (enemy.vx > 0 ? enemy.hw : -1);
      let aheadCol = floor(aheadX / TILE_DRAW);
      let belowRow = floor((enemy.worldY + enemy.oy + enemy.hh + 2) / TILE_DRAW);
      if (!isSolid(belowRow, aheadCol)) {
        enemy.vx = -enemy.vx;
        enemy.facing = enemy.vx > 0 ? 1 : -1;
      }
    }

    // Fall off screen = dead
    if (enemy.worldY > levelRows * TILE_DRAW + 100) {
      enemy.alive = false;
    }

    // Animation
    enemy.animTimer++;
    if (enemy.animTimer >= 12) {
      enemy.animTimer = 0;
      enemy.animFrame = (enemy.animFrame + 1) % 2;
    }
  }

  // Shell slide kills other enemies
  for (let shell of enemies) {
    if (!shell.alive || shell.state !== 'shellSlide') continue;
    for (let other of enemies) {
      if (other === shell || !other.alive || other.state === 'stomped') continue;
      if (boxOverlap(shell, other)) {
        other.alive = false;
      }
    }
  }
}

// ── Enemy drawing ──

function drawEnemies() {
  for (let enemy of enemies) {
    if (!enemy.alive || !enemy.active) continue;

    let frames;
    if (enemy.state === 'stomped') {
      frames = ENEMY_FRAMES[enemy.type].squished;
    } else if (enemy.state === 'shell' || enemy.state === 'shellSlide') {
      frames = ENEMY_FRAMES[enemy.type].shell;
    } else {
      frames = ENEMY_FRAMES[enemy.type].walk;
    }

    let f = frames[enemy.animFrame % frames.length];
    let drawW = f.w * SCALE;
    let drawH = f.h * SCALE;
    let screenX = enemy.worldX - cameraX;

    push();
    translate(screenX + drawW / 2, enemy.worldY);
    scale(enemy.facing, 1);
    image(enemiesSheet, -drawW / 2, 0, drawW, drawH, f.x, f.y, f.w, f.h);
    pop();
  }
}
