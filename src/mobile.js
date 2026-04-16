// ── Mobile support: touch controls, first-gesture unlock, rotate prompt ──

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// Held state, read by player movement and Yoshi eat logic.
let touchLeftHeld = false;
let touchRightHeld = false;
let touchActionHeld = false;

// For edge detection (jump = rising edge, action press = call Yoshi).
let _prevTouchJump = false;
let _prevTouchAction = false;

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

function getTouchButtonLayout() {
  let shortEdge = min(width, height);
  let r = max(42, min(80, shortEdge * 0.09));
  let bigR = max(56, min(100, shortEdge * 0.12));
  let pad = max(18, shortEdge * 0.04);

  let dpadCY = height - pad - r;
  let leftCX = pad + r;
  let rightCX = leftCX + r * 2.1;

  let jumpCY = height - pad - bigR;
  let jumpCX = width - pad - bigR;

  let actR = bigR * 0.75;
  let actCX = jumpCX - bigR - actR - pad * 0.3;
  let actCY = height - pad - actR;

  return { r, bigR, actR, leftCX, rightCX, dpadCY, jumpCX, jumpCY, actCX, actCY };
}

function _touchInCircle(cx, cy, r) {
  for (let t of touches) {
    let dx = t.x - cx, dy = t.y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

function updateTouchControls() {
  if (!isTouchDevice || game.state !== 'playing') {
    touchLeftHeld = false;
    touchRightHeld = false;
    touchActionHeld = false;
    _prevTouchJump = false;
    _prevTouchAction = false;
    return;
  }

  let L = getTouchButtonLayout();
  touchLeftHeld  = _touchInCircle(L.leftCX,  L.dpadCY, L.r);
  touchRightHeld = _touchInCircle(L.rightCX, L.dpadCY, L.r);
  let jumpHeld   = _touchInCircle(L.jumpCX,  L.jumpCY, L.bigR);
  let actionHeld = _touchInCircle(L.actCX,   L.actCY,  L.actR);

  // Jump: rising edge
  if (jumpHeld && !_prevTouchJump && mario && !mario.dead && !mario.growing && mario.onGround) {
    mario.vy = mario.jumpForce;
    mario.onGround = false;
  }
  _prevTouchJump = jumpHeld;

  // Action button: held → Yoshi eats (via isEatButtonHeld). Rising edge with
  // no Yoshi under Mario → call Yoshi to him.
  touchActionHeld = actionHeld;
  if (actionHeld && !_prevTouchAction && mario && !mario.dead && !mario.ridingYoshi) {
    callYoshiToPlayer(mario);
  }
  _prevTouchAction = actionHeld;
}

function drawTouchControls() {
  if (!isTouchDevice || game.state !== 'playing') return;

  let L = getTouchButtonLayout();
  push();
  noStroke();
  textAlign(CENTER, CENTER);

  // D-pad left
  fill(255, 255, 255, touchLeftHeld ? 200 : 110);
  ellipse(L.leftCX, L.dpadCY, L.r * 2);
  fill(0, 0, 0, 200);
  textSize(L.r * 0.9);
  text('\u25C0', L.leftCX, L.dpadCY);

  // D-pad right
  fill(255, 255, 255, touchRightHeld ? 200 : 110);
  ellipse(L.rightCX, L.dpadCY, L.r * 2);
  fill(0, 0, 0, 200);
  text('\u25B6', L.rightCX, L.dpadCY);

  // Action button (B)
  fill(255, 180, 60, touchActionHeld ? 230 : 150);
  ellipse(L.actCX, L.actCY, L.actR * 2);
  fill(0, 0, 0, 220);
  textSize(L.actR * 0.8);
  text('B', L.actCX, L.actCY);

  // Jump button (A)
  fill(100, 220, 120, _prevTouchJump ? 230 : 150);
  ellipse(L.jumpCX, L.jumpCY, L.bigR * 2);
  fill(0, 0, 0, 220);
  textSize(L.bigR * 0.9);
  text('A', L.jumpCX, L.jumpCY);

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
