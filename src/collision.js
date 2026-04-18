// ── Tile collision ──

function isSolid(row, col) {
  if (row < 0 || col < 0 || row >= levelRows || col >= levelCols) return false;
  let t = levelData[row][col];
  return t !== null && t !== 'flag';
}

// Move entity, resolve collisions on both axes. Returns true if hit a wall on X.
function collideTiles(ent) {
  ent.worldX += ent.vx;
  let hitX = resolveCollision(ent, 'x');

  ent.worldY += ent.vy;
  ent.onGround = false;
  resolveCollision(ent, 'y');

  return hitX;
}

function resolveCollision(ent, axis) {
  let left = ent.worldX + ent.ox;
  let top = ent.worldY + ent.oy;
  let right = left + ent.hw - 1;
  let bottom = top + ent.hh - 1;

  let cLeft = floor(left / TILE_DRAW);
  let cRight = floor(right / TILE_DRAW);
  let rTop = floor(top / TILE_DRAW);
  let rBottom = floor(bottom / TILE_DRAW);

  let hit = false;

  for (let r = rTop; r <= rBottom; r++) {
    for (let c = cLeft; c <= cRight; c++) {
      if (!isSolid(r, c)) continue;

      let tileL = c * TILE_DRAW;
      let tileT = r * TILE_DRAW;
      let tileR = tileL + TILE_DRAW;
      let tileB = tileT + TILE_DRAW;

      let eL = ent.worldX + ent.ox;
      let eT = ent.worldY + ent.oy;
      let eR = eL + ent.hw;
      let eB = eT + ent.hh;

      if (eR <= tileL || eL >= tileR || eB <= tileT || eT >= tileB) continue;

      hit = true;
      if (axis === 'x') {
        if (ent.vx > 0) {
          ent.worldX = tileL - ent.ox - ent.hw;
        } else if (ent.vx < 0) {
          ent.worldX = tileR - ent.ox;
        }
        ent.vx = 0;
      } else {
        if (ent.vy > 0) {
          ent.worldY = tileT - ent.oy - ent.hh;
          ent.vy = 0;
          ent.onGround = true;
        } else if (ent.vy < 0) {
          ent.worldY = tileB - ent.oy;
          ent.vy = 0;
          // Hit ? or coin block from below
          if (isPlayer(ent)) {
            if (levelData[r][c] === 'question') {
              hitQuestionBlock(r, c);
            } else if (levelData[r][c] === 'coinBlock') {
              hitCoinBlock(r, c);
            } else if (levelData[r][c] === 'yoshiBlock') {
              hitYoshiBlock(r, c);
            } else if (levelData[r][c] === 'brick' && ent.big) {
              levelData[r][c] = null;
            }
          }
        }
      }
    }
  }
  return hit;
}

// ── Box overlap (AABB) ──

function boxOverlap(a, b) {
  let aL = a.worldX + a.ox;
  let aT = a.worldY + a.oy;
  let aR = aL + a.hw;
  let aB = aT + a.hh;
  let bL = b.worldX + b.ox;
  let bT = b.worldY + b.oy;
  let bR = bL + b.hw;
  let bB = bT + b.hh;
  return aR > bL && aL < bR && aB > bT && aT < bB;
}

function isPlayer(ent) {
  return ent === mario || ent === luigi;
}

// ── Enemy/player collision checks ──

function checkEnemyCollisionsFor(player) {
  if (player.dead) return;
  if (player.invincible > 0) {
    player.invincible--;
    return;
  }

  for (let enemy of enemies) {
    if (!enemy.alive || !enemy.active || enemy.state === 'stomped') continue;
    if (!boxOverlap(player, enemy)) continue;

    let playerBottom = player.worldY + player.oy + player.hh;
    let enemyMid = enemy.worldY + enemy.oy + enemy.hh * 0.4;
    let stomping = player.vy > 0 && playerBottom < enemyMid + 4;

    if (player.ridingYoshi) {
      if (stomping) {
        // Jump on enemy: normal stomp
        stompEnemy(enemy);
        player.vy = STOMP_BOUNCE;
      } else if (player.big) {
        // Big Mario on Yoshi: shrink back to small, keep Yoshi
        shrinkPlayer(player);
      } else {
        // Small Mario on Yoshi: lose Yoshi, Mario continues
        dismountYoshi(player);
        player.invincible = INVINCIBILITY_FRAMES;
      }
      continue;
    }

    if (stomping) {
      // Stomp!
      stompEnemy(enemy);
      player.vy = STOMP_BOUNCE;
    } else if (enemy.state === 'shell') {
      // Kick a stationary shell
      let kickDir = (player.worldX + player.ox + player.hw / 2) < (enemy.worldX + enemy.ox + enemy.hw / 2) ? 1 : -1;
      enemy.state = 'shellSlide';
      enemy.vx = kickDir * 6;
    } else {
      if (player.big) {
        shrinkPlayer(player);
      } else {
        killPlayer(player);
      }
    }
  }
}

function checkMushroomCollectionFor(player) {
  for (let i = popups.length - 1; i >= 0; i--) {
    let p = popups[i];
    if (!p.alive || p.rising) continue;
    if (boxOverlap(player, p)) {
      p.alive = false;
      popups.splice(i, 1);
      game.score += 100;
      growPlayer(player);
    }
  }
}
