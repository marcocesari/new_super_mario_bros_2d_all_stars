// ── Mobile support: touch controls, first-gesture unlock, rotate prompt ──

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// Held state, read by player movement and Yoshi eat logic.
let touchLeftHeld = false;
let touchRightHeld = false;
let touchActionHeld = false;

// For edge detection on face buttons.
let _prevTouchJump = false;
let _prevTouchAction = false;
let _prevTouchDismount = false;
let _prevTouchCall = false;

// Joystick state. Spawns at the first non-button touch, anchors there, and
// tracks the knob relative to that anchor. Hidden otherwise.
let _joystick = {
  active: false,
  id: -1,
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
};

// ── First-gesture handling ────────────────────────────────────────────────
// iOS won't resume the AudioContext, enter fullscreen, or lock orientation
// without a user gesture. Called from touchStarted / mousePressed / keyPressed.

// iOS Safari (especially as an installed PWA) sometimes leaves the
// AudioContext in 'suspended' even after userStartAudio(), and can
// re-suspend it after backgrounding the app. Running a resume on every
// gesture — not just the first — keeps the context reliably 'running'.
function tryResumeAudio() {
  try {
    let ctx = getAudioContext();
    if (ctx && ctx.state !== 'running') {
      let p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) { /* ignore */ }
  try {
    let p = userStartAudio();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* ignore */ }
}

let _gestureHandled = false;
function handleFirstGesture() {
  tryResumeAudio();
  if (_gestureHandled) return;
  _gestureHandled = true;
  // Fullscreen + landscape-lock only on touch devices — desktop users are
  // trusted to choose fullscreen via the browser (F11 / ⌃⌘F).
  if (isTouchDevice) {
    try { fullscreen(true); } catch (e) { /* not supported on iPhone Safari <16.4 */ }
    try {
      if (screen.orientation && screen.orientation.lock) {
        let q = screen.orientation.lock('landscape');
        if (q && typeof q.catch === 'function') q.catch(() => {});
      }
    } catch (e) { /* ignored on browsers that don't support it */ }
  }
}

// ── Rotate prompt ─────────────────────────────────────────────────────────
// iOS PWAs can't be orientation-locked, so when a phone is held upright we
// block gameplay with a prompt and resume on rotation.

function drawRotatePrompt() {
  background(0);
  push();
  noStroke();
  textAlign(CENTER, CENTER);

  let cx = width / 2, cy = height / 2 - 40;
  let phoneW = 44, phoneH = 80;
  let pulse = 0.9 + 0.1 * sin(frameCount * 0.1);
  fill(255, 220, 50);
  rectMode(CENTER);
  rect(cx, cy, phoneW * pulse, phoneH * pulse, 8);
  fill(0);
  rect(cx, cy, (phoneW - 8) * pulse, (phoneH - 20) * pulse, 4);
  rectMode(CORNER);

  fill(255);
  textSize(22);
  text('Please rotate your device', width / 2, cy + 80);
  textSize(16);
  fill(200);
  text('The game plays in landscape', width / 2, cy + 110);
  pop();
}

// ── On-screen touch controls ──────────────────────────────────────────────
// Right side: A (big, jump) plus smaller X / Y / B around it.
// Left side: virtual joystick that spawns under the player's thumb.

function getTouchButtonLayout() {
  let shortEdge = min(width, height);
  let aR = max(54, min(92, shortEdge * 0.12));     // A — big primary (jump)
  let smallR = aR * 0.58;                           // X, Y, B — secondary
  let pad = max(18, shortEdge * 0.04);

  // A lifted off the corner — sits in the lower-right quadrant roughly
  // 25% off the bottom edge and 10% off the right edge, like the aim
  // button in Brawl Stars rather than pinned to the screen corner.
  let bottomMargin = max(pad + aR * 0.5, height * 0.25);
  let rightMargin  = max(pad + smallR,    width  * 0.10);
  let aCX = width  - rightMargin  - aR;
  let aCY = height - bottomMargin - aR;

  // X: above-left of A, Y: above-right of A, B: left of A (slightly down).
  let xCX = aCX - aR * 0.75 - smallR * 0.2;
  let xCY = aCY - aR - smallR * 0.4;
  let yCX = aCX + aR * 0.75 + smallR * 0.2;
  let yCY = xCY;
  let bCX = aCX - aR - smallR * 1.2;
  let bCY = aCY + aR * 0.25;

  return {
    aR, smallR,
    aCX, aCY,
    bCX, bCY,
    xCX, xCY,
    yCX, yCY,
  };
}

function _touchInCircle(cx, cy, r) {
  for (let t of touches) {
    let dx = t.x - cx, dy = t.y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

// Is a touch inside any face button (with a small grace margin)? The
// joystick ignores these so tapping A doesn't also start a drag.
function _isTouchOnFaceButton(tx, ty, L) {
  let margin = 1.15;
  let buttons = [
    [L.aCX, L.aCY, L.aR * margin],
    [L.bCX, L.bCY, L.smallR * margin],
    [L.xCX, L.xCY, L.smallR * margin],
    [L.yCX, L.yCY, L.smallR * margin],
  ];
  for (let b of buttons) {
    let dx = tx - b[0], dy = ty - b[1];
    if (dx * dx + dy * dy <= b[2] * b[2]) return true;
  }
  return false;
}

function _updateVirtualJoystick(L) {
  // Keep tracking the existing finger if it's still on screen.
  if (_joystick.active) {
    let tracked = null;
    for (let t of touches) {
      if (t.id === _joystick.id) { tracked = t; break; }
    }
    if (!tracked) {
      _joystick.active = false;
    } else {
      _joystick.curX = tracked.x;
      _joystick.curY = tracked.y;
    }
  }

  // Acquire: the first active touch that isn't on a face button spawns the
  // joystick anchored at its landing position.
  if (!_joystick.active) {
    for (let t of touches) {
      if (!_isTouchOnFaceButton(t.x, t.y, L)) {
        _joystick.active = true;
        _joystick.id = t.id;
        _joystick.startX = t.x;
        _joystick.startY = t.y;
        _joystick.curX = t.x;
        _joystick.curY = t.y;
        break;
      }
    }
  }

  // Horizontal offset → left/right movement.
  if (_joystick.active) {
    let shortEdge = min(width, height);
    let deadzone = max(8, shortEdge * 0.02);
    let dx = _joystick.curX - _joystick.startX;
    if (dx > deadzone) { touchLeftHeld = false; touchRightHeld = true; }
    else if (dx < -deadzone) { touchLeftHeld = true; touchRightHeld = false; }
    else { touchLeftHeld = false; touchRightHeld = false; }
  } else {
    touchLeftHeld = false;
    touchRightHeld = false;
  }
}

function updateTouchControls() {
  // Inside the MarcoGames iOS app, a connected native gamepad takes over and
  // the on-screen touch UI should go away. Falls back to touch if the gamepad
  // disconnects mid-game.
  let nativeGpActive = window.__p5NativeHost && getGamepad();
  if (!isTouchDevice || game.state !== 'playing' || nativeGpActive) {
    touchLeftHeld = false;
    touchRightHeld = false;
    touchActionHeld = false;
    _prevTouchJump = false;
    _prevTouchAction = false;
    _prevTouchDismount = false;
    _prevTouchCall = false;
    _joystick.active = false;
    return;
  }

  let L = getTouchButtonLayout();

  let jumpHeld     = _touchInCircle(L.aCX, L.aCY, L.aR);
  let actionHeld   = _touchInCircle(L.bCX, L.bCY, L.smallR);
  let dismountHeld = _touchInCircle(L.xCX, L.xCY, L.smallR);
  let callHeld     = _touchInCircle(L.yCX, L.yCY, L.smallR);

  // A — Jump (rising edge)
  if (jumpHeld && !_prevTouchJump && mario && !mario.dead && !mario.growing && mario.onGround) {
    mario.vy = mario.jumpForce;
    mario.onGround = false;
  }
  _prevTouchJump = jumpHeld;

  // B — Yoshi eat (held) + call Yoshi on rising edge when not riding.
  touchActionHeld = actionHeld;
  if (actionHeld && !_prevTouchAction && mario && !mario.dead && !mario.ridingYoshi) {
    callYoshiToPlayer(mario);
  }
  _prevTouchAction = actionHeld;

  // X — Dismount Yoshi (rising edge)
  if (dismountHeld && !_prevTouchDismount && mario && !mario.dead) {
    dismountYoshiVoluntary(mario);
  }
  _prevTouchDismount = dismountHeld;

  // Y — Call Yoshi (rising edge)
  if (callHeld && !_prevTouchCall && mario && !mario.dead) {
    callYoshiToPlayer(mario);
  }
  _prevTouchCall = callHeld;

  // Movement joystick — runs AFTER face buttons so its touch acquisition
  // correctly skips any finger currently pressing a button.
  _updateVirtualJoystick(L);
}

// Native-host gamepad status banner: a 2.5s pill shown when a MarcoGames
// iOS app detects a gamepad connect/disconnect, so the player knows why
// the touch UI just appeared/vanished. No-op in a regular browser.
let _nativeGpLastState = null;  // null = unseen, true = connected, false = not
let _nativeGpBannerUntil = 0;

function drawNativeGamepadBanner() {
  if (!window.__p5NativeHost) return;
  let connected = !!getGamepad();
  if (_nativeGpLastState === null) {
    _nativeGpLastState = connected;
    return;
  }
  if (connected !== _nativeGpLastState) {
    _nativeGpLastState = connected;
    _nativeGpBannerUntil = millis() + 2500;
  }
  if (millis() >= _nativeGpBannerUntil) return;

  let msg = connected ? 'Controller connected' : 'Controller disconnected — using touch';
  push();
  textAlign(CENTER, CENTER);
  textSize(14);
  let pad = 10;
  let w = textWidth(msg) + pad * 2;
  let h = 28;
  let x = width / 2 - w / 2;
  let y = 12;
  noStroke();
  fill(0, 0, 0, 200);
  rect(x, y, w, h, 6);
  fill(connected ? color(80, 220, 120) : color(240, 200, 80));
  text(msg, width / 2, y + h / 2 + 1);
  pop();
}

function drawTouchControls() {
  if (!isTouchDevice || game.state !== 'playing') return;
  if (window.__p5NativeHost && getGamepad()) return;

  let L = getTouchButtonLayout();
  push();
  noStroke();
  textAlign(CENTER, CENTER);

  // Joystick — only visible while a finger is on the movement zone.
  if (_joystick.active) {
    let maxR = max(36, min(width, height) * 0.09);
    let dx = _joystick.curX - _joystick.startX;
    let dy = _joystick.curY - _joystick.startY;
    let d = sqrt(dx * dx + dy * dy);
    if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; }

    // Base ring
    fill(255, 255, 255, 55);
    ellipse(_joystick.startX, _joystick.startY, maxR * 2);
    stroke(255, 255, 255, 180);
    strokeWeight(2);
    noFill();
    ellipse(_joystick.startX, _joystick.startY, maxR * 2);
    noStroke();

    // Knob with highlight
    let knobR = maxR * 0.5;
    fill(80, 140, 220, 240);
    ellipse(_joystick.startX + dx, _joystick.startY + dy, knobR * 2);
    fill(255, 255, 255, 150);
    ellipse(_joystick.startX + dx - knobR * 0.3,
            _joystick.startY + dy - knobR * 0.3,
            knobR * 0.8);
  }

  // Face buttons — colourful, with a soft top highlight for a 3D feel.
  _drawFaceButton(L.aCX, L.aCY, L.aR, 'A', [80, 210, 110], _prevTouchJump);
  _drawFaceButton(L.bCX, L.bCY, L.smallR, 'B', [230, 80, 90], touchActionHeld);
  _drawFaceButton(L.xCX, L.xCY, L.smallR, 'X', [80, 150, 230], _prevTouchDismount);
  _drawFaceButton(L.yCX, L.yCY, L.smallR, 'Y', [245, 205, 60], _prevTouchCall);

  pop();
}

function _drawFaceButton(cx, cy, r, label, rgb, held) {
  // Drop shadow for depth
  noStroke();
  fill(0, 0, 0, 90);
  ellipse(cx + 1, cy + 3, r * 2);

  // Dark rim so the colour pops against any background
  fill(0, 0, 0, 180);
  ellipse(cx, cy, r * 2.08);

  // Main body — a touch brighter while held
  let boost = held ? 35 : 0;
  fill(min(255, rgb[0] + boost), min(255, rgb[1] + boost), min(255, rgb[2] + boost), 245);
  ellipse(cx, cy, r * 2);

  // Top highlight (gives a glossy, 3D button feel)
  fill(255, 255, 255, held ? 70 : 110);
  ellipse(cx - r * 0.25, cy - r * 0.3, r * 1.05, r * 0.75);

  // Label
  fill(0, 0, 0, 230);
  textSize(r * 0.95);
  textStyle(BOLD);
  text(label, cx, cy);
  textStyle(NORMAL);
}

// Called on any touch while game is NOT in 'playing'. Collapses the menus
// into a single tap-to-start flow so a phone without a keyboard can play.
// Returns true if it consumed the tap.
function handleMenuTouchAdvance() {
  if (!isTouchDevice) return false;

  if (game.state === 'menu' || game.state === 'controllerConnect' || game.state === 'playerSelect') {
    // On the MarcoGames iOS host with a gamepad connected, keep controller
    // mode on — otherwise isEatButtonHeld (and other useController-gated
    // checks) will ignore the gamepad after a tap-to-start.
    if (!(window.__p5NativeHost && getGamepad())) {
      useController = false;
    }
    twoPlayer = false;
    startGame();
    return true;
  }
  if (game.state === 'dead') {
    stopAllSounds();
    loadLevel(LEVELS[game.currentLevel]);
    return true;
  }
  if (game.state === 'gameover') {
    stopAllSounds();
    game.lives = 3;
    game.score = 0;
    game.coinCount = 0;
    game.currentLevel = 0;
    loadLevel(LEVELS[game.currentLevel]);
    return true;
  }
  if (game.state === 'levelComplete') {
    stopAllSounds();
    if (game.currentLevel < LEVELS.length - 1) {
      game.currentLevel++;
      loadLevel(LEVELS[game.currentLevel], true);
    } else {
      game.lives = 3;
      game.score = 0;
      game.coinCount = 0;
      game.currentLevel = 0;
      loadLevel(LEVELS[game.currentLevel]);
    }
    return true;
  }
  return false;
}
