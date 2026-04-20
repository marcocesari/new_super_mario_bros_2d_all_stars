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
    { x: 0, y: 105, w: 14, h: 18 },   // egg
    { x: 17, y: 105, w: 13, h: 16 },   // egg cracking
    { x: 6, y: 127, w: 18, h: 19 },    // shell breaking
    { x: 6, y: 149, w: 21, h: 19 },    // baby Yoshi emerging
    { x: 39, y: 123, w: 26, h: 36 },   // green Yoshi standing (idle)
    { x: 67, y: 125, w: 27, h: 34 },   // green Yoshi walk frame
  ],
};

const YOSHI_DRAW_W = 80;
const YOSHI_DRAW_H = 88;
const YOSHI_FEET_OFFSET = 8; // nudge Yoshi down so feet touch ground

// Mario-on-Yoshi ride sprite (3 frames, each 200x200 in mario_on_yoshi.png)
const RIDE_DRAW_SIZE = 105;
const RIDE_FRAMES = [
  { x: 0, y: 0, w: 200, h: 200 },
  { x: 200, y: 0, w: 200, h: 200 },
  { x: 400, y: 0, w: 200, h: 200 },
];

// Mario-on-Yoshi eating sprite (6 frames, each 256x256 in yoshi_eating.png)
const EAT_DRAW_SIZE = 180; // scaled up to match ride character size
const EAT_BODY_OFFSET = 50; // shift to keep body aligned (body is left-side of eat frames)
const EAT_ANIM_FRAMES = [
  { x: 0, y: 0, w: 256, h: 256 },
  { x: 256, y: 0, w: 256, h: 256 },
  { x: 512, y: 0, w: 256, h: 256 },
  { x: 768, y: 0, w: 256, h: 256 },
  { x: 1024, y: 0, w: 256, h: 256 },
  { x: 1280, y: 0, w: 256, h: 256 },
];

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
      // Advance through 6 frames: 4 egg-crack frames then 2 green Yoshi frames.
      let totalFrames = YOSHI_FRAMES.hatch.length;
      let progress = 1 - e.hatchTimer / e.hatchDuration;
      e.hatchFrame = floor(progress * totalFrames);
      e.hatchFrame = constrain(e.hatchFrame, 0, totalFrames - 1);
      if (e.hatchTimer <= 0) {
        yoshis.push(createYoshi(e.worldX - 10, e.worldY - 20));
        e.alive = false;
        game.yoshiHatching = false;
      }
    } else {
      if (e.onGround) {
        e.vy = 1;
        e.hatching = true;
        e.vx = 0;

        // Play hatch sound and freeze gameplay until it finishes.
        if (sounds.yoshiHatch) {
          // Stop only the level music so the hatch jingle is audible.
          if (activeLevelMusic && activeLevelMusic.isPlaying()) {
            activeLevelMusic.stop();
          }
          if (levelMusicLoopTimer) {
            clearTimeout(levelMusicLoopTimer);
            levelMusicLoopTimer = null;
          }
          // Ensure audio context is running (iOS can re-suspend it).
          tryResumeAudio();
          sounds.yoshiHatch.setVolume(1.0);
          sounds.yoshiHatch.play();
          // Set hatch duration to match the sound length (in frames at 60fps).
          let dur = sounds.yoshiHatch.duration();
          e.hatchDuration = max(90, round(dur * 60));
          e.hatchTimer = e.hatchDuration;
          sounds.yoshiHatch.onended(() => {
            // Resume level music after hatch sound.
            playLevelMusic();
          });
        } else {
          e.hatchDuration = 60;
          e.hatchTimer = 60;
        }
        e.hatchFrame = 0;
        game.yoshiHatching = true;
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

    let eggScale = 3;
    if (e.hatching) {
      // Draw hatching animation from sprite sheet
      let f = YOSHI_FRAMES.hatch[e.hatchFrame];
      let drawW = f.w * eggScale;
      let drawH = f.h * eggScale;
      let shake = e.hatchTimer < 30 ? floor(random(-2, 3)) : 0;
      image(yoshiSheet, sx + shake, e.worldY + 50 - drawH, drawW, drawH, f.x, f.y, f.w, f.h);
    } else {
      // Draw first hatch frame as the egg
      let f = YOSHI_FRAMES.hatch[0];
      let drawW = f.w * eggScale;
      let drawH = f.h * eggScale;
      image(yoshiSheet, sx, e.worldY + 50 - drawH, drawW, drawH, f.x, f.y, f.w, f.h);
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
    eatTimer: 0,
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

// ── Yoshi eat (extended range in facing direction) ──

const YOSHI_EAT_RANGE = 120;

function isEatButtonHeld() {
  // Keyboard: shift key
  if (keyIsDown(SHIFT) || keyIsDown(16)) return true;
  // Touch: on-screen B button
  if (touchActionHeld) return true;
  // Controller: mapped eat button
  if (useController && gpMapped && gpMapping.eat >= 0) {
    let gp = getGamepad();
    if (gp && gp.buttons[gpMapping.eat] && gp.buttons[gpMapping.eat].pressed) return true;
  }
  return false;
}

// Full eat animation cycle: smooth extend and retract with no pause.
// Tongue extends, is available for eating contact, then retracts back in.
const YOSHI_EAT_CYCLE = 42;
const YOSHI_EAT_CONTACT_START = 10;  // tongue first reaches enemies
const YOSHI_EAT_CONTACT_END = 32;   // tongue starts retracting
const YOSHI_TONGUE_BALL_RADIUS = 12; // radius of the ball at end of tongue
const YOSHI_TONGUE_MAX_REACH = 180; // maximum distance tongue extends (covers gaps between islands)

function yoshiTryEat(player) {
  let y = player.ridingYoshi;
  if (!y) return;

  // Begin a new eat cycle on a fresh button press (don't restart mid-cycle).
  if (isEatButtonHeld() && y.eating <= 0) {
    y.eating = YOSHI_EAT_CYCLE;
    y.ateThisCycle = false;
  }

  if (y.eating <= 0) return;

  // While the tongue is out, scan for enemies colliding with the tongue ball.
  // Eat at most one enemy per cycle.
  let elapsed = YOSHI_EAT_CYCLE - y.eating;
  if (y.ateThisCycle) return;
  if (elapsed < YOSHI_EAT_CONTACT_START || elapsed > YOSHI_EAT_CONTACT_END) return;

  let px = player.worldX + player.ox + player.hw / 2;
  let py = player.worldY + player.oy + player.hh / 2;

  // Calculate tongue extension progress (0 to 1 at peak, then back to 0)
  let cycleProgress = (elapsed - YOSHI_EAT_CONTACT_START) / (YOSHI_EAT_CONTACT_END - YOSHI_EAT_CONTACT_START);
  // Make it extend and retract: goes 0->1 then 1->0
  let tongueExtension = cycleProgress < 0.5 ? cycleProgress * 2 : (1 - cycleProgress) * 2;
  
  // Calculate tongue ball position at the end of the tongue
  let tongueReach = YOSHI_TONGUE_MAX_REACH * tongueExtension;
  let tongueBallX = px + (player.facing * tongueReach);
  let tongueBallY = py;

  // Check for collision with tongue ball (circle collision)
  let bestEnemy = null;
  let bestDist = Infinity;
  for (let enemy of enemies) {
    if (!enemy.alive || enemy.state === 'stomped') continue;
    let ex = enemy.worldX + enemy.ox + enemy.hw / 2;
    let ey = enemy.worldY + enemy.oy + enemy.hh / 2;
    let dx = ex - tongueBallX;
    let dy = ey - tongueBallY;
    let dist = sqrt(dx * dx + dy * dy);
    
    // Check if enemy center is within tongue ball radius
    if (dist <= YOSHI_TONGUE_BALL_RADIUS + 15) { // +15 for enemy size tolerance
      if (dist < bestDist) {
        bestDist = dist;
        bestEnemy = enemy;
      }
    }
  }

  if (bestEnemy) {
    bestEnemy.alive = false;
    game.score += 200;
    y.ateThisCycle = true;
    // Retract tongue immediately after eating (end animation completely)
    y.eating = 0; // Immediately stop eating animation
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
  translate(sx + YOSHI_DRAW_W / 2, sy + YOSHI_DRAW_H - drawH + YOSHI_FEET_OFFSET);
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
    let feetY = y.worldY + y.oy + y.hh;
    drawYoshiSprite(sx, feetY - YOSHI_DRAW_H, y.facing, frames, 0);
  }
}

// ── Draw Yoshi under a riding player ──

function drawRidingYoshi(player) {
  let y = player.ridingYoshi;
  let sx = player.worldX - cameraX;

  // Animate walk (fast cycle)
  if (player.state === 'walk') {
    y.animTimer++;
    if (y.animTimer >= 3) {
      y.animTimer = 0;
      y.animFrame = (y.animFrame + 1) % RIDE_FRAMES.length;
    }
  } else {
    y.animFrame = 0;
    y.animTimer = 0;
  }

  // Align feet with ground
  let playerFeetY = player.worldY + player.oy + player.hh;
  let drawSize = RIDE_DRAW_SIZE;
  let drawY = playerFeetY - drawSize + YOSHI_FEET_OFFSET;
  let drawX = sx - (drawSize - SPRITE_STRIDE * SCALE) / 2;

  if (y.eating > 0) {
    // Eating: drive the animation from the eat-cycle countdown so the tongue
    // visibly extends before the enemy is consumed (contact at ~frame 3).
    let elapsed = YOSHI_EAT_CYCLE - y.eating;
    let eatFrame = constrain(floor(elapsed / 3), 0, EAT_ANIM_FRAMES.length - 1);
    let ef = EAT_ANIM_FRAMES[eatFrame];
    let eatSize = EAT_DRAW_SIZE;
    // Align feet: eat sprite has ~60/256 padding below feet
    let eatFeetOffset = 60 * eatSize / 256;
    let eatY = playerFeetY - eatSize + eatFeetOffset + YOSHI_FEET_OFFSET;
    // Anchor body position (body is on the left side of eat frames)
    let centerX = sx + SPRITE_STRIDE * SCALE / 2;
    push();
    translate(centerX, eatY);
    scale(player.facing, 1);
    image(eatSheet, -eatSize / 2 + EAT_BODY_OFFSET, 0, eatSize, eatSize, ef.x, ef.y, ef.w, ef.h);
    pop();
  } else {
    // Normal: draw ride sprite (Mario + Yoshi together)
    let rf = RIDE_FRAMES[y.animFrame % RIDE_FRAMES.length];
    push();
    translate(drawX + drawSize / 2, drawY);
    scale(player.facing, 1);
    image(rideSheet, -drawSize / 2, 0, drawSize, drawSize, rf.x, rf.y, rf.w, rf.h);
    pop();
  }
}

// ── Dismount (on death — Yoshi runs off and is gone) ──

function dismountYoshi(player) {
  if (!player.ridingYoshi) return;
  player.ridingYoshi.mounted = false;
  player.ridingYoshi.alive = false;
  player.ridingYoshi = null;
}

// ── Voluntary dismount — Yoshi stays alive next to the player ──

function dismountYoshiVoluntary(player) {
  if (!player.ridingYoshi) return;
  let y = player.ridingYoshi;
  y.mounted = false;
  // Place Yoshi just behind the player so we don't immediately re-mount
  y.worldX = player.worldX + (player.facing === 1 ? -TILE_DRAW : TILE_DRAW);
  y.worldY = player.worldY;
  y.vx = 0;
  y.vy = 0;
  y.eating = 0;
  y.tongueTarget = null;
  player.ridingYoshi = null;
}

// ── Call Yoshi — summon the nearest unmounted Yoshi to the player ──

function callYoshiToPlayer(player) {
  if (player.dead || player.ridingYoshi) return;
  let nearest = null;
  let nearestDist = Infinity;
  for (let y of yoshis) {
    if (!y.alive || y.mounted) continue;
    let d = abs(y.worldX - player.worldX);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = y;
    }
  }
  if (!nearest) return;
  // Teleport Yoshi onto the player and mount instantly.
  nearest.worldX = player.worldX;
  nearest.worldY = player.worldY;
  nearest.vx = 0;
  nearest.vy = 0;
  nearest.mounted = true;
  player.ridingYoshi = nearest;
}

// ── Reset ──

function resetYoshis() {
  yoshiEggs = [];
  yoshis = [];
}
