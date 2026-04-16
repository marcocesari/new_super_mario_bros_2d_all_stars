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
  text(title, width / 2, height / 2 - 60);

  if (useController && gpMapped) {
    drawOverlayButtons();
  } else {
    textSize(18);
    text(subtitle, width / 2, height / 2 - 5);
  }
}

function drawOverlayButtons() {
  let opts = getOverlayOptions();
  if (opts.length === 0) return;

  let btnW = 200;
  let btnH = 56;
  let gap = 30;
  let totalW = opts.length * btnW + (opts.length - 1) * gap;
  let startX = width / 2 - totalW / 2;
  let btnY = height / 2 + 10;

  for (let i = 0; i < opts.length; i++) {
    let bx = startX + i * (btnW + gap);
    let selected = (i === overlayChoice);

    noStroke();
    fill(selected ? color(255, 220, 50) : color(60));
    rect(bx, btnY, btnW, btnH, 10);

    if (selected) {
      stroke(255, 220, 50);
      strokeWeight(3);
      noFill();
      rect(bx - 4, btnY - 4, btnW + 8, btnH + 8, 12);
      noStroke();
    }

    fill(selected ? 0 : 255);
    textSize(22);
    textAlign(CENTER, CENTER);
    text(opts[i].label, bx + btnW / 2, btnY + btnH / 2);
  }

  fill(180);
  textSize(13);
  textAlign(CENTER, CENTER);
  if (opts.length > 1) {
    text('Joystick / D-pad: navigate     JUMP: confirm', width / 2, btnY + btnH + 28);
  } else {
    text('Press JUMP to confirm', width / 2, btnY + btnH + 28);
  }
}

// ── Level drawing ──

function drawLevel() {
  let viewW = width / (viewScale || 1);
  let startCol = floor(cameraX / TILE_DRAW);
  let endCol = min(startCol + ceil(viewW / TILE_DRAW) + 1, levelCols);

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
