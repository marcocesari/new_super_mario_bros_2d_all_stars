// ── HUD ──

function drawHUD() {
  noStroke();
  textSize(16);

  // P1 Mario - red label
  textAlign(LEFT);
  fill(255, 100, 100);
  text('P1', 10, 20);
  fill(255);
  text(' LIVES: ' + game.lives, 35, 20);

  // Score & coins
  textAlign(CENTER);
  fill(255);
  text('COINS: ' + game.coinCount + '  SCORE: ' + game.score, width / 2, 20);

  // World
  textAlign(RIGHT);
  text('WORLD ' + LEVEL_THEMES[game.currentLevel].name, width - 10, 20);

  // Player indicators
  textSize(12);
  textAlign(LEFT);
  if (mario.dead && mario.respawnTimer > 0) {
    fill(255, 100, 100);
    text('P1: respawning...', 10, 38);
  }
  if (luigi && luigi.dead && luigi.respawnTimer > 0) {
    fill(100, 255, 100);
    text('P2: respawning...', 10, mario.dead ? 38 : 52);
  }
}

// ── Overlay (death, game over, level complete) ──

function drawOverlay(title, subtitle) {
  fill(0, 0, 0, 150);
  noStroke();
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text(title, width / 2, height / 2 - 20);
  textSize(18);
  text(subtitle, width / 2, height / 2 + 25);
}

// ── Level drawing ──

function drawLevel() {
  let startCol = floor(cameraX / TILE_DRAW);
  let endCol = min(startCol + ceil(width / TILE_DRAW) + 1, levelCols);

  for (let r = 0; r < levelRows; r++) {
    for (let c = startCol; c <= endCol; c++) {
      let tile = levelData[r][c];
      if (tile && tile !== 'flag') {
        let src = BLOCK_SPRITES[tile];
        if (src) {
          let sx = c * TILE_DRAW - cameraX;
          let sy = r * TILE_DRAW;
          image(blocksSheet, sx, sy, TILE_DRAW, TILE_DRAW, src.x, src.y, src.w, src.h);
        }
      }
      if (tile === 'flag') {
        let sx = c * TILE_DRAW - cameraX + TILE_DRAW / 2;
        let sy = r * TILE_DRAW;
        stroke(200);
        strokeWeight(3);
        line(sx, sy - TILE_DRAW * 4, sx, sy + TILE_DRAW);
        noStroke();
        fill(0, 200, 0);
        triangle(sx, sy - TILE_DRAW * 4, sx, sy - TILE_DRAW * 2.5, sx + TILE_DRAW, sy - TILE_DRAW * 3.25);
      }
    }
  }
}
