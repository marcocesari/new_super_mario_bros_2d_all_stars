// ── Yoshi system ──

let yoshiEggs = [];
let yoshis = [];

// Sprite frames from Yoshi sheet (503x620, transparent bg)
const YOSHI_FRAMES = {
  walk: [
    { x: 39, y: 123, w: 26, h: 36 },
    { x: 67, y: 125, w: 27, h: 34 },
    { x: 96, y: 125, w: 27, h: 33 },
  ],
  idle: [{ x: 39, y: 123, w: 26, h: 36 }],
  eat: [{ x: 75, y: 271, w: 49, h: 21 }],
  hatch: [
    { x: 0, y: 105, w: 14, h: 18 },
    { x: 17, y: 105, w: 13, h: 16 },
    { x: 6, y: 127, w: 18, h: 19 },
    { x: 6, y: 149, w: 21, h: 19 },
  ],
};

const YOSHI_DRAW_W = 80;
const YOSHI_DRAW_H = 88;

// ── Yoshi egg block hit ──

function hitYoshiBlock(row, col) {
  levelData[row][col] = 'hitBlock';
  yoshiEggs.push({
    worldX: col * TILE_DRAW + TILE_DRAW / 2 - 20,
    worldY: row * TILE_DRAW,
    vx: 0,
    vy: -5,
    onGround: false,
    alive: true,
    rising: true,
    hatching: false,
    hatchTimer: 0,
    hatchFrame: 0,
    ox: 6,
    oy: 6,
    hw: 28,
    hh: 36,
  });
}

// ── Egg update ──

function updateYoshiEggs() {
  for (let i = yoshiEggs.length - 1; i >= 0; i--) {
    let e = yoshiEggs[i];
    if (!e.alive) { yoshiEggs.splice(i, 1); continue; }

    if (e.rising) {
      e.worldY += e.vy;
      e.vy += 0.3;
      if (e.vy >= 0) {
        e.rising = false;
        e.vy = 0;
        e.vx = 0;
      }
    } else if (e.hatching) {
      e.hatchTimer--;
      // Advance hatch frame over time
      let progress = 1 - e.hatchTimer / 60;
      e.hatchFrame = floor(progress * 4);
      e.hatchFrame = constrain(e.hatchFrame, 0, 3);
      if (e.hatchTimer <= 0) {
        yoshis.push(createYoshi(e.worldX - 10, e.worldY - 20));
        e.alive = false;
      }
    } else {
      if (e.onGround) {
        e.vy = 1;
        e.hatching = true;
        e.hatchTimer = 60;
        e.hatchFrame = 0;
        e.vx = 0;
      } else {
        e.vy += GRAVITY;
      }
      collideTiles(e);
      if (e.onGround) e.worldY = round(e.worldY);
      if (e.worldY > levelRows * TILE_DRAW + 100) e.alive = false;
    }
  }
}

// ── Egg drawing ──

function drawYoshiEggs() {
  for (let e of yoshiEggs) {
    if (!e.alive) continue;
    let sx = e.worldX - cameraX;

    if (e.hatching) {
      // Draw hatching animation from sprite sheet
      let f = YOSHI_FRAMES.hatch[e.hatchFrame];
      let drawW = f.w * 1.5;
      let drawH = f.h * 1.5;
      let shake = e.hatchTimer < 30 ? floor(random(-2, 3)) : 0;
      image(yoshiSheet, sx + shake, e.worldY + 36 - drawH, drawW, drawH, f.x, f.y, f.w, f.h);
    } else {
      // Draw first hatch frame as the egg
      let f = YOSHI_FRAMES.hatch[0];
      let drawW = f.w * 1.5;
      let drawH = f.h * 1.5;
      image(yoshiSheet, sx, e.worldY + 36 - drawH, drawW, drawH, f.x, f.y, f.w, f.h);
    }
  }
}

// ── Yoshi creation ──

function createYoshi(worldX, worldY) {
  return {
    worldX: worldX,
    worldY: worldY,
    vx: 0,
    vy: 0,
    onGround: false,
    alive: true,
    mounted: false,
    facing: 1,
    animFrame: 0,
    animTimer: 0,
    eating: 0,
    ox: 6,
    oy: 6,
    hw: 42,
    hh: 50,
  };
}

// ── Yoshi update ──

function updateYoshis() {
  for (let i = yoshis.length - 1; i >= 0; i--) {
    let y = yoshis[i];
    if (!y.alive) { yoshis.splice(i, 1); continue; }

    if (y.eating > 0) y.eating--;

    if (y.mounted) continue;

    if (y.onGround) {
      y.vy = 1;
    } else {
      y.vy += GRAVITY;
    }
    collideTiles(y);
    if (y.onGround) y.worldY = round(y.worldY);

    if (y.worldY > levelRows * TILE_DRAW + 100) {
      y.alive = false;
    }
  }
}

// ── Mount check ──

function checkYoshiMountFor(player) {
  if (player.dead || player.ridingYoshi) return;
  for (let y of yoshis) {
    if (!y.alive || y.mounted) continue;
    if (boxOverlap(player, y)) {
      y.mounted = true;
      player.ridingYoshi = y;
      break;
    }
  }
}

// ── Draw a Yoshi sprite ──

function drawYoshiSprite(sx, sy, facing, frames, animFrame) {
  let f = frames[animFrame % frames.length];
  // Scale proportionally so Yoshi isn't squished
  // Use idle frame as the reference size
  let refH = YOSHI_DRAW_H;
  let refScale = refH / YOSHI_FRAMES.idle[0].h;
  let drawW = f.w * refScale;
  let drawH = f.h * refScale;
  push();
  translate(sx + YOSHI_DRAW_W / 2, sy + YOSHI_DRAW_H - drawH);
  scale(facing, 1);
  image(yoshiSheet, -drawW / 2, 0, drawW, drawH, f.x, f.y, f.w, f.h);
  pop();
}

// ── Yoshi drawing (unmounted) ──

function drawYoshis() {
  for (let y of yoshis) {
    if (!y.alive || y.mounted) continue;
    let sx = y.worldX - cameraX;

    // Idle animation
    y.animTimer++;
    if (y.animTimer >= 12) {
      y.animTimer = 0;
      y.animFrame = (y.animFrame + 1) % YOSHI_FRAMES.walk.length;
    }

    let frames = YOSHI_FRAMES.idle;
    drawYoshiSprite(sx, y.worldY, y.facing, frames, 0);
  }
}

// ── Draw Yoshi under a riding player ──

function drawRidingYoshi(player) {
  let y = player.ridingYoshi;
  let sx = player.worldX - cameraX;

  // Animate walk (fast cycle)
  if (player.state === 'walk') {
    y.animTimer++;
    if (y.animTimer >= 7) {
      y.animTimer = 0;
      y.animFrame = (y.animFrame + 1) % YOSHI_FRAMES.walk.length;
    }
  } else {
    y.animFrame = 0;
    y.animTimer = 0;
  }

  // Pick frame set
  let frames;
  if (y.eating > 0) {
    frames = YOSHI_FRAMES.eat;
  } else if (player.state === 'walk') {
    frames = YOSHI_FRAMES.walk;
  } else {
    frames = YOSHI_FRAMES.idle;
  }

  let yoshiY = player.worldY + (player.big ? 50 : 24);
  drawYoshiSprite(sx, yoshiY, player.facing, frames, y.animFrame);
}

// ── Dismount (on death) ──

function dismountYoshi(player) {
  if (!player.ridingYoshi) return;
  player.ridingYoshi.mounted = false;
  player.ridingYoshi.alive = false;
  player.ridingYoshi = null;
}

// ── Reset ──

function resetYoshis() {
  yoshiEggs = [];
  yoshis = [];
}
