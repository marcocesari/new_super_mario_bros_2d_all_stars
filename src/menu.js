// ── Menu screens ──

// Gamepad mapping state
let gpConnected = false;
let gpMapping = { left: -1, right: -1, jump: -1, eat: -1, dismount: -1, callYoshi: -1, start: -1 };
let gpMapStep = 0;       // 0=left, 1=right, 2=jump, 3=eat, 4=dismount, 5=callYoshi, 6=start
let gpMapped = false;
let gpMapCooldown = 0;
let gpDetectPhase = true; // true = waiting for gamepad detection
let gpLastButtons = [];   // track button states for edge detection
const GP_MAP_LABELS = [
  'MOVE LEFT (or tilt stick)',
  'MOVE RIGHT (or tilt stick)',
  'JUMP (A)',
  'YOSHI EAT (B)',
  'GET OFF YOSHI (X)',
  'CALL YOSHI (Y)',
  'RESTART (Start)',
];
const GP_MAP_NAMES = ['left', 'right', 'jump', 'eat', 'dismount', 'callYoshi', 'start'];

// Joystick dead zone
const STICK_DEADZONE = 0.3;

// ── Shared menu option renderer (kept for other screens) ──

function drawMenuOption(label, y, isSelected) {
  if (isSelected) {
    fill(255, 220, 50);
    text('> ' + label + ' <', width / 2, y);
  } else {
    fill(255);
    text('  ' + label + '  ', width / 2, y);
  }
}

// ── Main menu ────────────────────────────────────────────────────────────────
// Layout (landscape):
//   LEFT  half  — looping video
//   CENTER      — animated wavy gradient divider
//   RIGHT half  — Mario-on-Yoshi sprite + stylised title + pill buttons

// Animation state for the Mario-on-Yoshi sprite shown on the title screen.
let _menuSprFrame  = 0;
let _menuSprTimer  = 0;

// Button bounding boxes, populated each frame and read by mobile touch handler.
let _menuBtnRects = { controller: null, keyboard: null };
let _psBtnRects   = { one: null, two: null };

// Playful Mario-on-Yoshi pop-ups: clicking anywhere on the home menu (except
// the two buttons) spawns one at the cursor that hops up, then falls under
// gravity off the bottom of the screen.
//
// Hidden easter egg: if the player clicks VERY FAST on the SAME SPOT and keeps
// it up for exactly 2.5 seconds straight, the 1-up mushroom pops out with the
// classic 1-up jingle. Two seconds later a red power-up mushroom follows with
// the power-up sound. Then the streak resets so it can be earned again.
let _menuPopups = [];
const MENU_POPUP_SIZE    = 90;    // Mario-on-Yoshi pop-up size
const MENU_MUSHROOM_SIZE = 190;   // reward mushrooms — big enough to clearly notice
const MENU_POPUP_GRAVITY = 0.8;
const MENU_POPUP_JUMP_VY = -11;   // initial upward "pop"

// 1-up streak tracking.
const ONE_UP_HOLD_MS      = 2500;   // must sustain the mashing for exactly 2.5 seconds
const ONE_UP_FAST_MS      = 350;    // max gap between clicks to count as "very fast"
const ONE_UP_SPOT_PX      = 45;     // clicks must stay within this radius
const POWER_UP_DELAY_MS   = 2500;   // power-up mushroom follows the 1-up by 2.5 s
let _oneUpAnchorX     = null;
let _oneUpAnchorY     = 0;
let _oneUpStreakStart = 0;
let _oneUpLastClick   = 0;
let _oneUpFired       = false;
let _powerUpFollowAt  = 0;          // millis() to fire the power-up follow-up (0 = none)
let _powerUpX = 0, _powerUpY = 0;   // where to pop the follow-up mushroom

// Push a pop-up of a given kind ('ride' | '1up' | 'powerup') — see _drawMenuPopups.
function _pushMenuPopup(x, y, kind) {
  // Small random spin, direction randomized so successive pops differ.
  let rotVel = (0.06 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1);
  let size = (kind === '1up' || kind === 'powerup') ? MENU_MUSHROOM_SIZE : MENU_POPUP_SIZE;
  _menuPopups.push({ x, y, vy: MENU_POPUP_JUMP_VY, rot: 0, rotVel, kind: kind || 'ride', size });
}

function spawnMenuPopup(x, y) {
  _pushMenuPopup(x, y, 'ride');
  _trackOneUpClick(x, y);
}

// On each click: extend the streak, or restart it if the click was too slow or
// too far from the anchor.
function _trackOneUpClick(x, y) {
  const now = millis();
  const sameSpot = _oneUpAnchorX !== null && dist(x, y, _oneUpAnchorX, _oneUpAnchorY) <= ONE_UP_SPOT_PX;
  const fast     = now - _oneUpLastClick <= ONE_UP_FAST_MS;
  if (!(sameSpot && fast)) {
    _oneUpAnchorX = x;              // start a fresh streak anchored here
    _oneUpAnchorY = y;
    _oneUpStreakStart = now;
    _oneUpFired = false;
  }
  _oneUpLastClick = now;
}

// Called every menu frame so the jingle fires the instant the fast, same-spot
// streak reaches exactly ONE_UP_HOLD_MS — not on the next click after it.
function _updateOneUpStreak() {
  // Power-up follow-up, 2 s after the 1-up: red mushroom + power-up sound.
  if (_powerUpFollowAt && millis() >= _powerUpFollowAt) {
    _powerUpFollowAt = 0;
    playSoundSafe(sounds.powerUp);
    _pushMenuPopup(_powerUpX, _powerUpY, 'powerup');
  }

  if (_oneUpAnchorX === null || _oneUpFired) return;
  const now = millis();
  if (now - _oneUpLastClick > ONE_UP_FAST_MS) { _oneUpAnchorX = null; return; }  // streak died
  if (now - _oneUpStreakStart >= ONE_UP_HOLD_MS) {
    _oneUpFired = true;            // earn it again from scratch next time
    playSoundSafe(oneUpSound);
    _pushMenuPopup(_oneUpAnchorX, _oneUpAnchorY, '1up');   // 1-up mushroom, not Mario+Yoshi
    _powerUpX = _oneUpAnchorX;
    _powerUpY = _oneUpAnchorY;
    _powerUpFollowAt = now + POWER_UP_DELAY_MS;             // schedule the power-up follow-up
  }
}

// Advance + draw every live pop-up; drop any that has fallen fully off-screen.
function _drawMenuPopups() {
  for (let i = _menuPopups.length - 1; i >= 0; i--) {
    let p = _menuPopups[i];
    p.vy  += MENU_POPUP_GRAVITY;
    p.y   += p.vy;
    p.rot += p.rotVel;

    const S = p.size || MENU_POPUP_SIZE;

    // Drop once the whole (rotating) sprite has cleared the bottom edge.
    if (p.y - S > height) { _menuPopups.splice(i, 1); continue; }

    push();
    translate(p.x, p.y);
    rotate(p.rot);
    if (p.kind === '1up' && oneUpMushroomImage) {
      image(oneUpMushroomImage, -S / 2, -S / 2, S, S);           // 1-up mushroom (jpg)
    } else if (p.kind === 'powerup') {
      const f = QUESTION_ITEM[0];                                // red power-up mushroom (in-game sprite)
      image(marioSheet, -S / 2, -S / 2, S, S, f.x, f.y, f.w, f.h);
    } else {
      const rf = RIDE_FRAMES[0];                                 // Mario-on-Yoshi
      image(rideSheet, -S / 2, -S / 2, S, S, rf.x, rf.y, rf.w, rf.h);
    }
    pop();
  }
}


// Shared title-screen backdrop: black base, sky-blue left panel, clipped video
// on the right, and the soft blue fade divider. Used by both the main menu and
// the player-select screen so they share one look.
function _drawMenuBackdrop() {
  // ── Right half: black background (video will draw on top) ─────────────────
  background(0);

  // ── Left half: sky-blue background (menu content) ─────────────────────────
  noStroke();
  fill(92, 148, 252);
  rect(0, 0, width / 2, height);

  // ── Right half: video, clipped so it never bleeds into the left panel ──────
  if (menuVideo && menuVideo.elt.readyState >= 2) {
    try {
      let vw = menuVideo.elt.videoWidth  || 0;
      let vh = menuVideo.elt.videoHeight || 0;
      if (vw > 0 && vh > 0) {
        let s  = Math.max((width / 2) / vw, height / vh);
        let dw = vw * s, dh = vh * s;
        let dx = width / 2 + ((width / 2) - dw) / 2;
        let dy = (height - dh) / 2;
        drawingContext.save();
        drawingContext.beginPath();
        drawingContext.rect(width / 2, 0, width / 2, height);
        drawingContext.clip();
        drawingContext.drawImage(menuVideo.elt, dx, dy, dw, dh);
        drawingContext.restore();
      }
    } catch (_) {}
  }

  // ── Centre: soft blue fade divider ────────────────────────────────────────
  _drawMenuDivider();
}

// Version tag (top-left corner), shared across title screens.
function _drawVersionTag() {
  push();
  textAlign(LEFT, TOP);
  textSize(11);
  fill(200);
  noStroke();
  text(GAME_VERSION, 8, 8);
  pop();
}

function drawMenu() {
  _drawMenuBackdrop();

  // ── Left half: sprite + title + buttons ───────────────────────────────────
  _drawMenuLeftPanel();

  _drawVersionTag();

  // Click-spawned Mario-on-Yoshi pop-ups, drawn on top of everything.
  _drawMenuPopups();

  // Fire the 1-up jingle exactly 2.5 s into a fast same-spot click streak.
  _updateOneUpStreak();
}

function _drawMenuDivider() {
  let cx = width / 2;

  drawingContext.save();

  // Long, even linear fade — like the reference gradient, but blue instead of
  // black. Solid blue holds up to the seam, then ramps evenly to fully
  // transparent partway across the video, so the dissolve is gentle and wide.
  let fadeEnd = cx + min(width * 0.17, 220);   // where blue reaches transparent
  let grad = drawingContext.createLinearGradient(cx, 0, fadeEnd, 0);
  grad.addColorStop(0.0, 'rgba(92,148,252,1)');  // solid blue (at the seam)
  grad.addColorStop(1.0, 'rgba(92,148,252,0)');  // fully transparent (right)
  drawingContext.fillStyle = grad;
  drawingContext.fillRect(cx, 0, fadeEnd - cx, height);

  drawingContext.restore();
}

// Animated Mario-on-Yoshi sprite. Drawn BEHIND the title/content so the writing
// sits on top of it. `centerX` defaults to the left-panel center.
function _drawMenuSprite(centerX) {
  let pw = width / 2, ph = height;
  if (centerX === undefined) centerX = pw * 0.5;

  // Animate Mario-on-Yoshi (3-frame walk cycle, 10 ticks/frame)
  _menuSprTimer++;
  if (_menuSprTimer >= 10) { _menuSprTimer = 0; _menuSprFrame = (_menuSprFrame + 1) % RIDE_FRAMES.length; }

  let sprSize = min(pw, ph);
  let sprX    = centerX - sprSize / 2;        // centered on centerX
  let sprY    = ph * 0.5 - sprSize / 2;       // centered vertically
  try {
    let rf = RIDE_FRAMES[_menuSprFrame];
    image(rideSheet, sprX, sprY, sprSize, sprSize, rf.x, rf.y, rf.w, rf.h);
  } catch (_) {}
}

function _drawMenuLeftPanel() {
  let pw = width  / 2;  // left panel width
  let ph = height;

  _drawMenuSprite();

  // ── Title (centered in the left panel) — drawn on top of the sprite ──
  _drawMenuTitle(pw * 0.5, ph * 0.07, pw * 0.48);

  // ── Pill buttons (lower half, centered in left panel) ──
  _drawMenuButtons(pw / 2, ph * 0.73, pw);
}

// Actual New Super Mario Bros. logo face (assets/fonts), Arial Black fallback.
const LOGO_FONT = '1px "New Super Mario Font U", "Arial Black", Arial, sans-serif';
const LOGO_SP   = 0.02;  // letter spacing (× size) — tight so shadows merge

// One NSMB logo letter: flat white face with a thin black keyline, sitting on a
// solid black drop-shadow offset down-right (fattened so neighbours merge into
// one silhouette, like the real wordmark).
function _drawLogoLetter(ctx, ch, x, y, sz) {
  ctx.font = LOGO_FONT.replace('1px', sz + 'px');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // Solid black drop shadow (offset down-right, fattened to connect)
  const dx = sz * 0.05, dy = sz * 0.14;
  ctx.lineWidth   = sz * 0.18;
  ctx.strokeStyle = '#000';
  ctx.fillStyle   = '#000';
  ctx.strokeText(ch, x + dx, y + dy);
  ctx.fillText(ch, x + dx, y + dy);

  // White face with a thin black keyline
  ctx.lineWidth   = sz * 0.055;
  ctx.strokeStyle = '#000';
  ctx.strokeText(ch, x, y);
  ctx.fillStyle   = '#fff';
  ctx.fillText(ch, x, y);
}

function _logoRunWidth(ctx, str, sz) {
  ctx.font = LOGO_FONT.replace('1px', sz + 'px');
  let t = 0;
  for (const ch of str) t += ctx.measureText(ch).width + sz * LOGO_SP;
  return t - sz * LOGO_SP;
}

// Draw a word left-aligned at x.
function _drawLogoRun(ctx, str, x, y, sz) {
  ctx.font = LOGO_FONT.replace('1px', sz + 'px');
  for (const ch of str) {
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') _drawLogoLetter(ctx, ch, x, y, sz);
    x += w + sz * LOGO_SP;
  }
}

// Draw a word centred on cx, auto-shrinking to fit maxW. Returns size used.
function _drawLogoCentered(ctx, str, cx, y, sz, maxW) {
  let w = _logoRunWidth(ctx, str, sz);
  if (w > maxW) { sz *= maxW / w; w = _logoRunWidth(ctx, str, sz); }
  _drawLogoRun(ctx, str, cx - w / 2, y, sz);
  return sz;
}

// The signature red spiky starburst "New" badge with white italic script.
function _drawNewBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.06);
  ctx.lineJoin = 'round';

  const pts = 11;
  const star = (ro, ri) => {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const rad = (i % 2 === 0) ? ro : ri;
      const a = Math.PI / pts * i - Math.PI / 2;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };

  // drop shadow
  ctx.save(); ctx.translate(2, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; star(r, r * 0.8); ctx.fill();
  ctx.restore();
  // white outline star
  ctx.fillStyle = '#ffffff'; star(r, r * 0.8); ctx.fill();
  // red star
  ctx.fillStyle = '#e8231a'; star(r * 0.88, r * 0.70); ctx.fill();

  // "New" — white italic script
  ctx.font = `italic 900 ${r * 0.6}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('New', 0, -r * 0.04);

  ctx.restore();
}

// ── "2D ALL STARS" emblem — styled after the Super Mario 3D All-Stars logo ──

function _roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

// One big metallic letter: red 3D extrude, gold + red outlines, white-steel face.
function _drawMetalLetter(ctx, ch, x, y, sz) {
  ctx.font = LOGO_FONT.replace('1px', sz + 'px');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // Red 3D extrude (down + slightly right)
  const depth = sz * 0.11, steps = 8;
  ctx.fillStyle = '#7d0f0f';
  for (let i = steps; i >= 1; i--) {
    const t = (i / steps) * depth;
    ctx.fillText(ch, x + t * 0.55, y + t);
  }
  // Gold outer rim, then red rim
  ctx.lineWidth = sz * 0.21; ctx.strokeStyle = '#e6a81c'; ctx.strokeText(ch, x, y);
  ctx.lineWidth = sz * 0.12; ctx.strokeStyle = '#c0151a'; ctx.strokeText(ch, x, y);
  // White-steel face
  const g = ctx.createLinearGradient(0, y, 0, y + sz);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e6edf6'); g.addColorStop(1, '#b6c6dd');
  ctx.fillStyle = g; ctx.fillText(ch, x, y);
  // Glossy top sheen
  const s = ctx.createLinearGradient(0, y, 0, y + sz * 0.5);
  s.addColorStop(0, 'rgba(255,255,255,0.85)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillText(ch, x, y);
}

// Gold swallowtail ribbon with red "ALL ★ STARS".
function _drawGoldBanner(ctx, cx, cy, w, h) {
  const L = cx - w / 2, R = cx + w / 2, T = cy - h / 2, B = cy + h / 2;
  const notch = h * 0.55;
  ctx.save();
  ctx.lineJoin = 'round';

  // Folded tails behind (darker gold)
  ctx.fillStyle = '#9a6606';
  for (const s of [-1, 1]) {
    const ex = (s < 0 ? L : R);
    ctx.beginPath();
    ctx.moveTo(ex, T + h * 0.15);
    ctx.lineTo(ex + s * h * 0.7, T + h * 0.32);
    ctx.lineTo(ex + s * h * 0.7, B - h * 0.10);
    ctx.lineTo(ex, B - h * 0.30);
    ctx.closePath();
    ctx.fill();
  }

  // Ribbon body with swallowtail ends
  ctx.beginPath();
  ctx.moveTo(L, T);
  ctx.lineTo(R, T);
  ctx.lineTo(R - notch, cy);
  ctx.lineTo(R, B);
  ctx.lineTo(L, B);
  ctx.lineTo(L + notch, cy);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, T, 0, B);
  bg.addColorStop(0, '#fff3b0'); bg.addColorStop(0.5, '#f3c63c'); bg.addColorStop(1, '#c9870e');
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = Math.max(1.5, h * 0.09); ctx.strokeStyle = '#6e3f00'; ctx.stroke();
  ctx.lineWidth = Math.max(1, h * 0.04);  ctx.strokeStyle = '#fff2c0'; ctx.stroke();

  // "ALL ★ STARS" in red
  let fs = h * 0.52;
  const setF = () => { ctx.font = `900 ${fs}px "Arial Black", Arial, sans-serif`; };
  setF();
  while (ctx.measureText('ALL ★ STARS').width > w * 0.74 && fs > 6) { fs -= 1; setF(); }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(1, fs * 0.12);
  ctx.strokeStyle = '#5e0c0c';
  ctx.strokeText('ALL ★ STARS', cx, cy + h * 0.02);
  ctx.fillStyle = '#c4161a';
  ctx.fillText('ALL ★ STARS', cx, cy + h * 0.02);

  ctx.restore();
}

function _drawAllStarsEmblem(ctx, cx, topY, w) {
  const dSz = w * 0.30;                       // "2D" cap size
  ctx.font = LOGO_FONT.replace('1px', dSz + 'px');
  const sp = dSz * 0.02;
  const w2 = ctx.measureText('2').width, wD = ctx.measureText('D').width;
  const dTotal = w2 + sp + wD;
  const dY = topY;

  // Dark-red plaque behind "2D" with gold double-border
  const plW = dTotal * 1.34, plH = dSz * 1.04;
  const plX = cx - plW / 2, plY = dY - dSz * 0.05;
  _roundRectPath(ctx, plX, plY, plW, plH, plH * 0.22);
  const pg = ctx.createLinearGradient(0, plY, 0, plY + plH);
  pg.addColorStop(0, '#d61f1f'); pg.addColorStop(1, '#7c0f0f');
  ctx.fillStyle = pg; ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, dSz * 0.08); ctx.strokeStyle = '#ecb73e'; ctx.stroke();
  ctx.lineWidth = Math.max(1, dSz * 0.03); ctx.strokeStyle = '#6e4300'; ctx.stroke();

  // "2D"
  let x = cx - dTotal / 2;
  _drawMetalLetter(ctx, '2', x, dY, dSz);
  _drawMetalLetter(ctx, 'D', x + w2 + sp, dY, dSz);

  // Gold "ALL ★ STARS" banner overlapping the plaque's bottom
  const bH = dSz * 0.52;
  const bY = plY + plH + bH * 0.02;
  _drawGoldBanner(ctx, cx, bY, w * 1.0, bH);

  return plH + bH; // approximate emblem height
}

function _drawMenuTitle(cx, startY, maxW) {
  // Preferred path: the real logo wordmark (assets PNG). Drawn centered on cx,
  // top-aligned at startY, scaled to fit the title's width while preserving
  // aspect. Falls back to the code-drawn logo below if the image is missing.
  if (logoImage && logoImage.width > 0) {
    const drawW = maxW * 1.18;               // the badge/extrudes spill past maxW
    const drawH = drawW * (logoImage.height / logoImage.width);
    push();
    imageMode(CORNER);
    image(logoImage, cx - drawW / 2, startY, drawW, drawH);
    pop();
    return;
  }

  const ctx = drawingContext;
  ctx.save();
  let y = startY;

  // ── Line 1: [New badge] SUPER ──
  let sz1   = min(maxW * 0.20, 60);
  let supW  = _logoRunWidth(ctx, 'SUPER', sz1);
  let badgeR = sz1 * 0.72;
  let gap    = sz1 * 0.14;
  let groupW = badgeR * 2 + gap + supW;
  if (groupW > maxW) {
    const k = maxW / groupW;
    sz1 *= k; supW *= k; badgeR *= k; gap *= k; groupW = maxW;
  }
  const gx = cx - groupW / 2;
  _drawNewBadge(ctx, gx + badgeR, y + sz1 * 0.40, badgeR);
  _drawLogoRun(ctx, 'SUPER', gx + badgeR * 2 + gap, y, sz1);
  y += sz1 * 0.92;

  // ── Line 2: MARIO BROS ──
  y += _drawLogoCentered(ctx, 'MARIO BROS', cx, y, min(maxW * 0.185, 58), maxW) * 0.98;

  // ── Line 3: "2D ALL STARS" emblem (Super Mario 3D All-Stars style) ──
  _drawAllStarsEmblem(ctx, cx, y + maxW * 0.02, min(maxW * 0.92, 280));

  ctx.restore();
}

function _drawMenuButtons(cx, centerY, rw) {
  let btnW = min(rw * 0.41, 205);
  let btnH = min(height * 0.075, 50);
  let gap  = 16;

  // The controller button gets a wider box to comfortably fit its label.
  let ctrlW = min(rw * 0.52, 260);

  // Keep the pair centered around cx.
  let totalW = ctrlW + gap + btnW;
  let b0x = cx - totalW / 2;
  let b1x = b0x + ctrlW + gap;
  let by  = centerY - btnH / 2;

  _menuBtnRects.controller = { x: b0x, y: by, w: ctrlW, h: btnH };
  _menuBtnRects.keyboard   = { x: b1x, y: by, w: btnW, h: btnH };

  _drawMenuPillBtn('GRAB A CONTROLLER', b0x, by, ctrlW, btnH, menuSelection === 0);
  _drawMenuPillBtn('GO KEYBOARD!',       b1x, by, btnW, btnH, menuSelection === 1);

  // Navigation hint below buttons
  push();
  textAlign(CENTER, TOP);
  textSize(max(10, min(13, height * 0.017)));
  fill(190, 215, 255);
  noStroke();
  text('← → PICK YOUR STYLE   •   ENTER = LET\'S-A GO!', cx, centerY + btnH / 2 + 10);
  pop();
}

function _drawMenuPillBtn(label, x, y, w, h, selected) {
  push();
  rectMode(CORNER);
  noStroke();
  let r = h / 2;

  // Drop shadow
  fill(0, 0, 0, 110);
  rect(x + 3, y + 4, w, h, r);

  // Selected: a glowing yellow line that rings the whole box (same yellow as
  // the fill). Drawn as an outer stroked pill just behind the body.
  if (selected) {
    noFill();
    stroke(255, 215, 0);
    strokeWeight(4);
    rect(x - 3, y - 3, w + 6, h + 6, r + 3);
    noStroke();
  }

  // Button body — yellow when the player is on it, gray otherwise.
  fill(selected ? color(255, 215, 0) : color(150, 150, 150));
  rect(x, y, w, h, r);

  // Top shine
  fill(255, 255, 255, selected ? 55 : 70);
  rect(x + 4, y + 3, w - 8, h * 0.45, r);

  // Label — fit it inside the pill (with horizontal padding)
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  let fs = min(h * 0.42, w / label.length * 1.6);
  textSize(fs);
  const maxTextW = w - h * 0.7; // keep clear of the rounded ends
  const tw = textWidth(label);
  if (tw > maxTextW) {
    fs = max(8, fs * maxTextW / tw);
    textSize(fs);
  }
  fill(selected ? color(20) : color(245));
  noStroke();
  text(label, x + w / 2, y + h / 2);
  textStyle(NORMAL);
  pop();
}

// ── Player select ──

// Two pill buttons ("1 PLAYER" / "2 PLAYERS") sharing the main-menu styling.
function _drawPlayerButtons(cx, centerY, rw) {
  let btnW = min(rw * 0.5, 240);
  let btnH = min(height * 0.075, 50);
  let vgap = 84;

  let bx     = cx - btnW / 2;
  let totalH = btnH * 2 + vgap;
  let y0     = centerY - totalH / 2;        // top button
  let y1     = y0 + btnH + vgap;            // bottom button

  _psBtnRects.one = { x: bx, y: y0, w: btnW, h: btnH };
  _psBtnRects.two = { x: bx, y: y1, w: btnW, h: btnH };

  _drawMenuPillBtn('1 PLAYER',  bx, y0, btnW, btnH, playerSelectChoice === 0);
  _drawMenuPillBtn('2 PLAYERS', bx, y1, btnW, btnH, playerSelectChoice === 1);

  return { by: y1, btnH };                  // bottom button, for info placement
}

function drawPlayerSelect() {
  let pw = width / 2, ph = height;

  // Plain sky-blue background here — no video, no fade divider. The logo is
  // smaller and tucked into the top-left corner.
  background(125, 38, 40);         // dark-red fabric tone
  _drawMenuSprite(width * 0.75);   // big Mario & Yoshi on the right side
  let logoMaxW  = pw * 0.34;
  let logoDrawW = logoMaxW * 1.18;       // matches _drawMenuTitle's image scale
  _drawMenuTitle(10 + logoDrawW / 2, 10, logoMaxW);

  // Vertical anchors: the heading up top and the controls hint down the
  // bottom. The buttons are centered in the gap between them.
  let headingY  = ph * 0.38;
  let controlsY = ph * 0.90;

  // Heading.
  push();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(max(16, min(28, height * 0.046)));
  stroke(0); strokeWeight(4); strokeJoin(ROUND);
  fill(255);
  text('HOW MANY PLAYERS?', pw * 0.5, headingY);
  pop();

  // Pill buttons (same look as the controller/keyboard pills), stacked on the
  // left side of the screen, vertically centered between the heading and the
  // controls hint.
  let psBtnW = min(pw * 0.5, 240);
  let psCx   = width * 0.16 + psBtnW / 2;     // left-anchored, nudged right
  const { by, btnH } = _drawPlayerButtons(psCx, (headingY + controlsY) / 2, pw);

  // Per-player control hint (only relevant in 2-player mode).
  push();
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  noStroke();
  let infoY = by + btnH + 12;
  if (playerSelectChoice === 1) {
    textSize(max(11, min(15, height * 0.02)));
    fill(255, 90, 90);
    text(useController ? 'P1 (MARIO): Controller'
                       : 'P1 (MARIO): Arrow keys + SPACE', psCx, infoY);
    fill(120, 230, 120);
    text('P2 (LUIGI): A/D + W to jump', psCx, infoY + 20);
  }
  pop();

  // Navigation hint below.
  push();
  textAlign(CENTER, TOP);
  textSize(max(10, min(13, height * 0.017)));
  fill(190, 215, 255);
  noStroke();
  text('▲ ▼ PICK PLAYERS   •   ENTER = START   •   ESC = BACK', pw * 0.5, controlsY);
  pop();

  _drawVersionTag();

  // Poll gamepad for navigation on this screen
  if (useController) {
    pollMenuGamepad();
  }
}

// ── Between-level loading screen ──

// Black screen with the animated Mario-on-Yoshi sprite running in the bottom-
// left corner, matching the startup loading screen.
function drawLoading() {
  background(0);

  // Advance the ride walk-cycle (slightly faster than the menu sprite).
  _menuSprTimer++;
  if (_menuSprTimer >= 8) { _menuSprTimer = 0; _menuSprFrame = (_menuSprFrame + 1) % RIDE_FRAMES.length; }

  let sz = min(width, height) * 0.22;
  let x  = max(24, width * 0.04);
  let y  = height - sz - max(24, height * 0.05);
  try {
    let rf = RIDE_FRAMES[_menuSprFrame];
    image(rideSheet, x, y, sz, sz, rf.x, rf.y, rf.w, rf.h);
  } catch (_) {}

  // "LOADING" with animated dots, just above the sprite.
  push();
  textAlign(LEFT, BOTTOM);
  textStyle(BOLD);
  noStroke();
  fill(255);
  textSize(max(18, min(30, height * 0.04)));
  let dots = '.'.repeat(floor(frameCount / 18) % 4);
  text('LOADING' + dots, x + 6, y - 6);
  textStyle(NORMAL);
  pop();
}

// ── Controller connect (Gamepad API) ──

// Shared dark-red backdrop for the controller-setup screen, matching the
// player-select look: red fabric tone, big Mario-on-Yoshi on the right, small
// logo tucked top-left. Returns the content-column center x (`cx`) used to lay
// the text out on the left side, clear of the sprite.
function _drawControllerBackdrop() {
  background(125, 38, 40);                 // dark-red, like player-select
  _drawMenuSprite(width * 0.78);           // big Mario & Yoshi on the right

  let pw = width / 2;
  let logoMaxW  = pw * 0.34;
  let logoDrawW = logoMaxW * 1.18;
  _drawMenuTitle(10 + logoDrawW / 2, 10, logoMaxW);

  return width * 0.28;                     // content column center (left side)
}

function drawControllerConnect() {
  let cx = _drawControllerBackdrop();

  noStroke();
  textAlign(CENTER, CENTER);

  // Heading — same position and style as the player-select "HOW MANY PLAYERS?".
  push();
  textStyle(BOLD);
  textSize(max(16, min(28, height * 0.046)));
  stroke(0); strokeWeight(4); strokeJoin(ROUND);
  fill(255);
  text('CONTROLLER SETUP', width / 4, height * 0.38);
  pop();

  if (gpMapCooldown > 0) gpMapCooldown--;

  // Phase 1: detect gamepad
  if (gpDetectPhase) {
    let gp = getGamepad();

    // Bigger title above the steps.
    push();
    textStyle(BOLD);
    textSize(max(20, min(30, width * 0.034)));
    fill(255);
    text('HOW TO SET UP', width * 0.42, 40);
    pop();

    textSize(15);
    fill(235);
    text('1. Open System Settings > Bluetooth', width * 0.42, 88);
    text('2. Turn on your controller (hold power button)', width * 0.42, 112);
    text('3. Pair it when it appears in the Bluetooth list', width * 0.42, 136);
    text('4. Once connected, press any button below', width * 0.42, 160);

    // Pulsing dots animation
    let dots = '.'.repeat((floor(frameCount / 20) % 3) + 1);
    textSize(24);
    fill(255, 220, 50);
    text('Waiting for controller' + dots, cx, 270);

    if (gp) {
      // Draw detected controller info
      textSize(14);
      fill(120, 255, 150);
      text('Detected: ' + gp.id.substring(0, 50), cx, 340);
      text(gp.buttons.length + ' buttons, ' + gp.axes.length + ' axes', cx, 360);

      // Check if any button is pressed to proceed
      for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i].pressed) {
          gpDetectPhase = false;
          gpMapStep = 0;
          gpMapped = false;
          gpMapCooldown = 30;
          // Snapshot current button states to avoid instant re-trigger
          gpLastButtons = [];
          for (let j = 0; j < gp.buttons.length; j++) {
            gpLastButtons[j] = gp.buttons[j].pressed;
          }
          break;
        }
      }
    }

    fill(220, 180, 180);
    textSize(14);
    text('Press ESC to go back', cx, 520);
    return;
  }

  // Phase 2: map buttons
  if (!gpMapped) {
    let gp = getGamepad();

    textSize(15);
    fill(235);
    text('Map each control. For LEFT / RIGHT you can either', width * 0.42, 30);
    text('press a button OR tilt the analog stick to skip.', width * 0.42, 54);

    if (gpMapCooldown > 0) {
      textSize(22);
      fill(220, 180, 180);
      text('OK! Next...', cx, 250);
    } else {
      textSize(22);
      fill(255, 220, 50);
      text('Press the button for:', cx, 210);
      textSize(min(34, width * 0.04));
      fill(120, 255, 150);
      text(GP_MAP_LABELS[gpMapStep], cx, 280);
    }

    // Show already mapped
    textSize(14);
    let y = 350;
    for (let i = 0; i < gpMapStep; i++) {
      fill(120, 235, 130);
      let val = gpMapping[GP_MAP_NAMES[i]];
      let valText = val < 0 ? 'Joystick' : ('Button ' + val);
      text('\u2713 ' + GP_MAP_LABELS[i] + '  =  ' + valText, cx, y);
      y += 22;
    }

    // Detect input for mapping
    if (gp && gpMapCooldown <= 0) {
      let curStep = GP_MAP_NAMES[gpMapStep];

      // For LEFT/RIGHT, allow tilting any analog axis to skip — pollGamepad
      // scans every even axis in-game, so we don't care which one the user
      // wiggled. Mapping stays -1 (sentinel meaning "use the analog stick").
      if (curStep === 'left' || curStep === 'right') {
        let strongest = 0;
        for (let i = 0; i < gp.axes.length; i += 2) {
          let v = gp.axes[i];
          if (typeof v === 'number' && !isNaN(v) && abs(v) > abs(strongest)) {
            strongest = v;
          }
        }
        let tilted = (curStep === 'left' && strongest < -0.7) ||
                     (curStep === 'right' && strongest > 0.7);
        if (tilted) {
          gpMapping[curStep] = -1; // sentinel: use joystick
          gpMapStep++;
          gpMapCooldown = 30;
        }
      }

      // Otherwise wait for a button press
      if (gpMapStep < GP_MAP_NAMES.length && gpMapCooldown <= 0) {
        for (let i = 0; i < gp.buttons.length; i++) {
          let wasPressed = gpLastButtons[i] || false;
          let isPressed = gp.buttons[i].pressed;
          if (isPressed && !wasPressed) {
            gpMapping[GP_MAP_NAMES[gpMapStep]] = i;
            gpMapStep++;
            gpMapCooldown = 30;
            if (gpMapStep >= GP_MAP_NAMES.length) {
              gpMapped = true;
            }
            break;
          }
        }
      }

      if (gpMapStep >= GP_MAP_NAMES.length) {
        gpMapped = true;
      }

      // Update button state snapshot
      for (let i = 0; i < gp.buttons.length; i++) {
        gpLastButtons[i] = gp.buttons[i].pressed;
      }
    }

    fill(220, 180, 180);
    textSize(14);
    text('Press ESC to go back', cx, 520);
    return;
  }

  // Phase 3: ready — show summary and test
  let gp = getGamepad();

  textSize(22);
  fill(120, 255, 150);
  text('Controller ready!', cx, 130);

  textSize(13);
  fill(235);
  let fmtBtn = (v) => v < 0 ? 'Joystick' : ('Button ' + v);
  text('LEFT:  ' + fmtBtn(gpMapping.left), cx, 165);
  text('RIGHT:  ' + fmtBtn(gpMapping.right), cx, 183);
  text('JUMP:  Button ' + gpMapping.jump, cx, 201);
  text('YOSHI EAT:  Button ' + gpMapping.eat, cx, 219);
  text('GET OFF YOSHI:  Button ' + gpMapping.dismount, cx, 237);
  text('CALL YOSHI:  Button ' + gpMapping.callYoshi, cx, 255);
  text('RESTART:  Button ' + gpMapping.start, cx, 273);

  // Live test display
  if (gp) {
    textSize(14);
    fill(210, 170, 170);
    text('-- Live test --', cx, 300);

    // Use the same multi-axis scan + d-pad/button fallbacks as in-game
    let axisX = readGamepadAxisX(gp);
    let dpadL = gp.buttons[14] && gp.buttons[14].pressed;
    let dpadR = gp.buttons[15] && gp.buttons[15].pressed;
    let mappedL = gpMapping.left >= 0 && gp.buttons[gpMapping.left] && gp.buttons[gpMapping.left].pressed;
    let mappedR = gpMapping.right >= 0 && gp.buttons[gpMapping.right] && gp.buttons[gpMapping.right].pressed;
    let goingLeft = axisX < -STICK_DEADZONE || dpadL || mappedL;
    let goingRight = axisX > STICK_DEADZONE || dpadR || mappedR;
    let jumpBtn = gp.buttons[gpMapping.jump] && gp.buttons[gpMapping.jump].pressed;
    let startBtn = gp.buttons[gpMapping.start] && gp.buttons[gpMapping.start].pressed;

    // Draw joystick indicator
    let testY = 350;
    let barW = 200;
    let barX = cx - barW / 2;
    fill(90, 30, 32);
    noStroke();
    rect(barX, testY, barW, 20, 5);
    // Position dot reflects analog tilt or full-deflection if buttons used
    let visX = axisX;
    if (mappedL || dpadL) visX = -1;
    if (mappedR || dpadR) visX = 1;
    let dotX = cx + visX * (barW / 2);
    fill(goingLeft || goingRight ? color(120, 255, 150) : color(210, 170, 170));
    ellipse(dotX, testY + 10, 16, 16);

    // Direction label
    textSize(14);
    fill(255);
    if (goingLeft) {
      text('LEFT', cx, testY + 45);
    } else if (goingRight) {
      text('RIGHT', cx, testY + 45);
    } else {
      fill(210, 170, 170);
      text('NEUTRAL', cx, testY + 45);
    }

    // Button indicators
    let btnY = testY + 70;
    fill(jumpBtn ? color(120, 255, 150) : color(90, 30, 32));
    rect(cx - 90, btnY, 80, 30, 5);
    fill(startBtn ? color(120, 255, 150) : color(90, 30, 32));
    rect(cx + 10, btnY, 80, 30, 5);

    fill(255);
    textSize(12);
    text('JUMP', cx - 50, btnY + 15);
    text('RESTART', cx + 50, btnY + 15);

    // Check for jump button press to proceed
    let jumpPressed = gp.buttons[gpMapping.jump] && gp.buttons[gpMapping.jump].pressed;
    let wasJump = gpLastButtons[gpMapping.jump] || false;
    if (jumpPressed && !wasJump) {
      useController = true;
      game.state = 'playerSelect';
      playerSelectChoice = 0;
    }
    // Update button states
    for (let i = 0; i < gp.buttons.length; i++) {
      gpLastButtons[i] = gp.buttons[i].pressed;
    }
  }

  textSize(20);
  fill(255, 220, 50);
  text('Press JUMP to continue!', cx, 490);

  fill(220, 180, 180);
  textSize(14);
  text('Press ESC to remap', cx, 520);
}

// ── Gamepad navigation for menus ──

let gpMenuCooldown = 0;
let gpMenuJumpPrev = false;

function pollMenuGamepad() {
  let gp = getGamepad();
  if (!gp || !gpMapped) return;

  if (gpMenuCooldown > 0) { gpMenuCooldown--; return; }

  let axisY = gp.axes[1] || 0;
  let axisX = gp.axes[0] || 0;

  // Joystick (either axis) to navigate the two pills
  if (game.state === 'playerSelect') {
    if (axisY < -0.5 || axisY > 0.5 || axisX < -0.5 || axisX > 0.5) {
      playerSelectChoice = 1 - playerSelectChoice;
      gpMenuCooldown = 15;
    }
    // Jump button to confirm
    let jumpPressed = gp.buttons[gpMapping.jump] && gp.buttons[gpMapping.jump].pressed;
    if (jumpPressed && !gpMenuJumpPrev) {
      twoPlayer = (playerSelectChoice === 1);
      startGame();
    }
    gpMenuJumpPrev = jumpPressed;
  }
}
