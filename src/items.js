// ── Question block / coin block hits ──

function hitCoinBlock(row, col) {
  levelData[row][col] = 'hitBlock';
  game.score += 100;
  game.coinCount++;
  if (sounds.coin) { sounds.coin.setVolume(1.5); sounds.coin.play(); }
  coinPopups.push({
    x: col * TILE_DRAW,
    y: row * TILE_DRAW,
    vy: -8,
    timer: 40,
  });
}

function hitQuestionBlock(row, col) {
  levelData[row][col] = 'hitBlock';
  popups.push({
    worldX: col * TILE_DRAW + TILE_DRAW / 2 - SPRITE_STRIDE * SCALE / 2,
    worldY: row * TILE_DRAW,
    vx: 0,
    vy: -5,
    onGround: false,
    alive: true,
    rising: true,
    ox: 2 * SCALE,
    oy: 2 * SCALE,
    hw: 14 * SCALE,
    hh: 14 * SCALE,
  });
}

// ── Mushroom popups ──

function updatePopups() {
  for (let i = popups.length - 1; i >= 0; i--) {
    let p = popups[i];
    if (!p.alive) { popups.splice(i, 1); continue; }

    if (p.rising) {
      p.worldY += p.vy;
      p.vy += 0.3;
      if (p.vy >= 0) {
        p.rising = false;
        p.vy = 0;
        p.vx = -2;
      }
    } else {
      if (p.onGround) {
        p.vy = 1;
      } else {
        p.vy += GRAVITY;
      }

      let prevVx = p.vx;
      let hitWall = collideTiles(p);

      if (p.onGround) {
        p.worldY = round(p.worldY);
      }

      if (hitWall) {
        p.vx = -prevVx;
      }

      if (p.worldY > levelRows * TILE_DRAW + 100) {
        p.alive = false;
      }
    }
  }
}

function drawPopups() {
  for (let p of popups) {
    if (!p.alive) continue;
    let sx = p.worldX - cameraX;
    let f = QUESTION_ITEM[floor(frameCount / 8) % QUESTION_ITEM.length];
    let drawW = f.w * SCALE;
    let drawH = f.h * SCALE;
    image(marioSheet, sx, p.worldY, drawW, drawH, f.x, f.y, f.w, f.h);
  }
}

// ── Coin popups ──

function updateCoinPopups() {
  for (let i = coinPopups.length - 1; i >= 0; i--) {
    let c = coinPopups[i];
    c.y += c.vy;
    c.vy += 0.3;
    c.timer--;
    if (c.timer <= 0) coinPopups.splice(i, 1);
  }
}

function drawCoinPopups() {
  let src = BLOCK_SPRITES.coin;
  for (let c of coinPopups) {
    let sx = c.x - cameraX;
    image(blocksSheet, sx, c.y, TILE_DRAW, TILE_DRAW, src.x, src.y, src.w, src.h);
  }
}
