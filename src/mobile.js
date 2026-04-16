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

// Joystick state. The base ring sits at a fixed position on the bottom-left
// and is always visible; the knob tracks whichever finger is holding it (by
// touch id) and returns to centre on release.
let _joystick = {
  active: false,
  id: -1,
  dx: 0, // knob offset from base centre (clamped to baseR)
  dy: 0,
};

// ── First-gesture handling ────────────────────────────────────────────────
// iOS won't resume the AudioContext, enter fullscreen, or lock orientation
// without a user gesture. Called from touchStarted / mousePressed / keyPressed.

let _gestureHandled = false;
function handleFirstGesture() {
  if (_gestureHandled) return;
  _gestureHandled = true;
  try {
    let p = userStartAudio();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* ignore */ }
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
// Right side: Nintendo face-button diamond (X top, Y left, A right, B bottom).
// Left side: virtual joystick that spawns wherever the player's thumb lands.

function getTouchButtonLayout() {
  let shortEdge = min(width, height);
  let btnR = max(32, min(60, shortEdge * 0.075));
  let spacing = btnR * 1.9; // distance from diamond centre to each button
  let pad = max(18, shortEdge * 0.04);

  // Diamond centre — pulled inward from the right edge so A sits
  // comfortably under the thumb instead of against the screen edge.
  let diamondCX = width - pad - btnR - spacing;
  let diamondCY = height - pad - btnR - spacing;

  // Always-visible joystick anchored on the bottom-left.
  let baseR = max(50, min(90, shortEdge * 0.11));
  let knobR = baseR * 0.45;
  let jCX = pad + baseR;
  let jCY = height - pad - baseR;

  return {
    btnR, spacing,
    diamondCX, diamondCY,
    aCX: diamondCX + spacing, aCY: diamondCY,             // right
    bCX: diamondCX,           bCY: diamondCY + spacing,   // bottom
    xCX: diamondCX,           xCY: diamondCY - spacing,   // top
    yCX: diamondCX - spacing, yCY: diamondCY,             // left
    jCX, jCY, baseR, knobR,
  };
}

function _touchInCircle(cx, cy, r) {
  for (let t of touches) {
    let dx = t.x - cx, dy = t.y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

function _updateVirtualJoystick(L) {
  // Keep the tracked finger's position mirrored onto the knob.
  if (_joystick.active) {
    let tracked = null;
    for (let t of touches) {
      if (t.id === _joystick.id) { tracked = t; break; }
    }
    if (!tracked) {
      _joystick.active = false;
      _joystick.dx = 0;
      _joystick.dy = 0;
    } else {
      let dx = tracked.x - L.jCX;
      let dy = tracked.y - L.jCY;
      let d = sqrt(dx * dx + dy * dy);
      if (d > L.baseR) { dx = dx / d * L.baseR; dy = dy / d * L.baseR; }
      _joystick.dx = dx;
      _joystick.dy = dy;
    }
  }

  // Acquire: any touch landing within a generous grab area around the base
  // claims the joystick. The face buttons sit on the far right, so they
  // can't accidentally overlap this zone.
  if (!_joystick.active) {
    let grabR = L.baseR * 2;
    let grabR2 = grabR * grabR;
    for (let t of touches) {
      let dx = t.x - L.jCX;
      let dy = t.y - L.jCY;
      if (dx * dx + dy * dy <= grabR2) {
        _joystick.active = true;
        _joystick.id = t.id;
        let d = sqrt(dx * dx + dy * dy);
        if (d > L.baseR) { dx = dx / d * L.baseR; dy = dy / d * L.baseR; }
        _joystick.dx = dx;
        _joystick.dy = dy;
        break;
      }
    }
  }

  // Horizontal knob offset → left/right movement (with deadzone).
  let deadzone = L.baseR * 0.22;
  if (_joystick.dx > deadzone) {
    touchLeftHeld = false;
    touchRightHeld = true;
  } else if (_joystick.dx < -deadzone) {
    touchLeftHeld = true;
    touchRightHeld = false;
  } else {
    touchLeftHeld = false;
    touchRightHeld = false;
  }
}

function updateTouchControls() {
  if (!isTouchDevice || game.state !== 'playing') {
    touchLeftHeld = false;
    touchRightHeld = false;
    touchActionHeld = false;
    _prevTouchJump = false;
    _prevTouchAction = false;
    _prevTouchDismount = false;
    _prevTouchCall = false;
    _joystick.active = false;
    _joystick.dx = 0;
    _joystick.dy = 0;
    return;
  }

  let L = getTouchButtonLayout();

  let jumpHeld     = _touchInCircle(L.aCX, L.aCY, L.btnR);
  let actionHeld   = _touchInCircle(L.bCX, L.bCY, L.btnR);
  let dismountHeld = _touchInCircle(L.xCX, L.xCY, L.btnR);
  let callHeld     = _touchInCircle(L.yCX, L.yCY, L.btnR);

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

function drawTouchControls() {
  if (!isTouchDevice || game.state !== 'playing') return;

  let L = getTouchButtonLayout();
  push();
  noStroke();
  textAlign(CENTER, CENTER);

  // Always-visible joystick — translucent base + coloured knob.
  fill(255, 255, 255, 55);
  ellipse(L.jCX, L.jCY, L.baseR * 2);
  stroke(255, 255, 255, 180);
  strokeWeight(2);
  noFill();
  ellipse(L.jCX, L.jCY, L.baseR * 2);
  noStroke();

  // Knob (brighter while held, like Brawl Stars).
  fill(80, 140, 220, _joystick.active ? 240 : 200);
  ellipse(L.jCX + _joystick.dx, L.jCY + _joystick.dy, L.knobR * 2);
  fill(255, 255, 255, 140);
  ellipse(L.jCX + _joystick.dx - L.knobR * 0.25,
          L.jCY + _joystick.dy - L.knobR * 0.25,
          L.knobR * 0.7);

  // Face-button diamond
  // A (right, green) — Jump
  fill(100, 220, 120, _prevTouchJump ? 230 : 160);
  ellipse(L.aCX, L.aCY, L.btnR * 2);
  fill(0, 0, 0, 220);
  textSize(L.btnR * 0.95);
  text('A', L.aCX, L.aCY);

  // B (bottom, red) — Eat / call Yoshi
  fill(230, 80, 80, touchActionHeld ? 230 : 160);
  ellipse(L.bCX, L.bCY, L.btnR * 2);
  fill(0, 0, 0, 220);
  text('B', L.bCX, L.bCY);

  // X (top, blue) — Dismount Yoshi
  fill(80, 150, 230, _prevTouchDismount ? 230 : 160);
  ellipse(L.xCX, L.xCY, L.btnR * 2);
  fill(0, 0, 0, 220);
  text('X', L.xCX, L.xCY);

  // Y (left, yellow) — Call Yoshi
  fill(240, 210, 60, _prevTouchCall ? 230 : 160);
  ellipse(L.yCX, L.yCY, L.btnR * 2);
  fill(0, 0, 0, 220);
  text('Y', L.yCX, L.yCY);

  pop();
}

// Called on any touch while game is NOT in 'playing'. Collapses the menus
// into a single tap-to-start flow so a phone without a keyboard can play.
// Returns true if it consumed the tap.
function handleMenuTouchAdvance() {
  if (!isTouchDevice) return false;

  if (game.state === 'menu' || game.state === 'controllerConnect' || game.state === 'playerSelect') {
    useController = false;
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
