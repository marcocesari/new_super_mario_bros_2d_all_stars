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

function drawMenu() {
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

  // ── Centre: wavy gradient divider ─────────────────────────────────────────
  _drawMenuDivider();

  // ── Left half: sprite + title + buttons ───────────────────────────────────
  _drawMenuLeftPanel();

  // Version tag (top-left corner)
  push();
  textAlign(LEFT, TOP);
  textSize(11);
  fill(200);
  noStroke();
  text(GAME_VERSION, 8, 8);
  pop();
}

function _drawMenuDivider() {
  let cx = width / 2;

  // Gradient: opaque sky (left) → transparent sky (right), fading into the video
  drawingContext.save();
  let grad = drawingContext.createLinearGradient(cx - 20, 0, cx + 80, 0);
  grad.addColorStop(0, 'rgba(92,148,252,1)');
  grad.addColorStop(1, 'rgba(92,148,252,0)');
  drawingContext.fillStyle = grad;
  drawingContext.fillRect(cx - 20, 0, 100, height);
  drawingContext.restore();

  // Animated sine-wave line
  push();
  noFill();
  stroke(255, 255, 255, 120);
  strokeWeight(2.5);
  beginShape();
  for (let y = 0; y <= height; y += 4) {
    let amp = 12 * (0.7 + 0.3 * sin(y * 0.012));
    let x   = (cx - 32) + sin(y * 0.038 + frameCount * 0.045) * amp;
    vertex(x, y);
  }
  endShape();
  pop();
}

function _drawMenuLeftPanel() {
  let pw = width  / 2;  // left panel width
  let ph = height;

  // Animate Mario-on-Yoshi (3-frame walk cycle, 10 ticks/frame)
  _menuSprTimer++;
  if (_menuSprTimer >= 10) { _menuSprTimer = 0; _menuSprFrame = (_menuSprFrame + 1) % RIDE_FRAMES.length; }

  // ── Mario-on-Yoshi sprite (upper-right of left panel) ──
  let sprSize = min(pw * 0.46, ph * 0.44);
  let sprX    = pw * 0.54;
  let sprY    = ph * 0.04;
  try {
    let rf = RIDE_FRAMES[_menuSprFrame];
    image(rideSheet, sprX, sprY, sprSize, sprSize, rf.x, rf.y, rf.w, rf.h);
  } catch (_) {}

  // ── Title (upper-left of left panel) ──
  _drawMenuTitle(pw * 0.28, ph * 0.07, pw * 0.48);

  // ── Pill buttons (lower half, centered in left panel) ──
  _drawMenuButtons(pw / 2, ph * 0.73, pw);
}

function _drawMenuTitle(cx, startY, maxW) {
  push();
  textAlign(CENTER, TOP);

  const lines = [
    { label: 'NEW',              sz: min(maxW * 0.20, 66), rgb: [255, 65,  65]  },
    { label: 'SUPER MARIO BROS', sz: min(maxW * 0.12, 40), rgb: [255, 225, 45]  },
    { label: '2D ALL STARS',     sz: min(maxW * 0.17, 56), rgb: [50,  215, 255] },
  ];

  let y = startY;
  for (let { label, sz, rgb } of lines) {
    textSize(sz);
    textStyle(BOLD);
    // Thick cartoon outline
    fill(0);
    let d = max(2, sz * 0.07);
    for (let [ox, oy] of [[-d,0],[d,0],[0,-d],[0,d],[-d,-d],[d,-d],[-d,d],[d,d]]) {
      text(label, cx + ox, y + oy);
    }
    fill(...rgb);
    text(label, cx, y);
    y += sz * 1.18;
  }
  textStyle(NORMAL);
  pop();
}

function _drawMenuButtons(cx, centerY, rw) {
  let btnW = min(rw * 0.41, 205);
  let btnH = min(height * 0.075, 50);
  let gap  = 16;

  let b0x = cx - gap / 2 - btnW;
  let b1x = cx + gap / 2;
  let by  = centerY - btnH / 2;

  _menuBtnRects.controller = { x: b0x, y: by, w: btnW, h: btnH };
  _menuBtnRects.keyboard   = { x: b1x, y: by, w: btnW, h: btnH };

  _drawMenuPillBtn('I HAVE CONTROLLER', b0x, by, btnW, btnH, menuSelection === 0);
  _drawMenuPillBtn('KEYBOARD CONTROLS',  b1x, by, btnW, btnH, menuSelection === 1);

  // Navigation hint below buttons
  push();
  textAlign(CENTER, TOP);
  textSize(max(10, min(13, height * 0.017)));
  fill(190, 215, 255);
  noStroke();
  text('← → to switch   ENTER to confirm', cx, centerY + btnH / 2 + 10);
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

  // Button body
  fill(selected ? color(255, 215, 0) : color(255, 255, 255, 215));
  rect(x, y, w, h, r);

  // Top shine
  fill(255, 255, 255, selected ? 55 : 95);
  rect(x + 4, y + 3, w - 8, h * 0.45, r);

  // Label
  textAlign(CENTER, CENTER);
  let fs = max(10, min(h * 0.42, w / label.length * 1.6));
  textSize(fs);
  textStyle(BOLD);
  fill(selected ? color(20) : color(50));
  noStroke();
  text(label, x + w / 2, y + h / 2);
  textStyle(NORMAL);
  pop();
}

// ── Player select ──

function drawPlayerSelect() {
  background(0);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);

  textSize(36);
  text('HOW MANY PLAYERS?', width / 2, 100);

  textSize(22);
  drawMenuOption('1 PLAYER', 260, playerSelectChoice === 0);
  drawMenuOption('2 PLAYERS', 310, playerSelectChoice === 1);

  if (playerSelectChoice === 1) {
    textSize(16);
    fill(220, 50, 50);
    if (useController) {
      text('P1 (MARIO): Controller', width / 2, 390);
    } else {
      text('P1 (MARIO): Arrow keys + SPACE', width / 2, 390);
    }
    fill(50, 200, 50);
    text('P2 (LUIGI): A/D + W to jump', width / 2, 415);
  }

  fill(180);
  textSize(14);
  if (useController) {
    text('Use joystick and buttons to select', width / 2, 480);
  } else {
    text('Use UP/DOWN arrows and ENTER to select', width / 2, 480);
  }
  text('Press ESC to go back', width / 2, 505);

  // Poll gamepad for navigation on this screen
  if (useController) {
    pollMenuGamepad();
  }
}

// ── Controller connect (Gamepad API) ──

function drawControllerConnect() {
  background(0);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);

  textSize(28);
  text('CONTROLLER SETUP', width / 2, 60);

  if (gpMapCooldown > 0) gpMapCooldown--;

  // Phase 1: detect gamepad
  if (gpDetectPhase) {
    let gp = getGamepad();

    textSize(16);
    fill(180);
    text('1. Open System Settings > Bluetooth', width / 2, 120);
    text('2. Turn on your controller (hold power button)', width / 2, 145);
    text('3. Pair it when it appears in the Bluetooth list', width / 2, 170);
    text('4. Once connected, press any button below', width / 2, 195);

    // Pulsing dots animation
    let dots = '.'.repeat((floor(frameCount / 20) % 3) + 1);
    textSize(28);
    fill(255, 220, 50);
    text('Waiting for controller' + dots, width / 2, 270);

    if (gp) {
      // Draw detected controller info
      textSize(14);
      fill(50, 255, 100);
      text('Detected: ' + gp.id.substring(0, 50), width / 2, 340);
      text(gp.buttons.length + ' buttons, ' + gp.axes.length + ' axes', width / 2, 360);

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

    fill(100);
    textSize(14);
    text('Press ESC to go back', width / 2, 520);
    return;
  }

  // Phase 2: map buttons
  if (!gpMapped) {
    let gp = getGamepad();

    textSize(16);
    fill(180);
    text('Map each control. For LEFT / RIGHT you can either', width / 2, 110);
    text('press a button OR tilt the analog stick to skip.', width / 2, 130);

    if (gpMapCooldown > 0) {
      textSize(22);
      fill(100);
      text('OK! Next...', width / 2, 250);
    } else {
      textSize(22);
      fill(255, 220, 50);
      text('Press the button for:', width / 2, 210);
      textSize(42);
      fill(50, 255, 100);
      text(GP_MAP_LABELS[gpMapStep], width / 2, 280);
    }

    // Show already mapped
    textSize(14);
    let y = 350;
    for (let i = 0; i < gpMapStep; i++) {
      fill(50, 200, 50);
      let val = gpMapping[GP_MAP_NAMES[i]];
      let valText = val < 0 ? 'Joystick' : ('Button ' + val);
      text('\u2713 ' + GP_MAP_LABELS[i] + '  =  ' + valText, width / 2, y);
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

    fill(100);
    textSize(14);
    text('Press ESC to go back', width / 2, 520);
    return;
  }

  // Phase 3: ready — show summary and test
  let gp = getGamepad();

  textSize(22);
  fill(50, 255, 100);
  text('Controller ready!', width / 2, 130);

  textSize(13);
  fill(200);
  let fmtBtn = (v) => v < 0 ? 'Joystick' : ('Button ' + v);
  text('LEFT:  ' + fmtBtn(gpMapping.left), width / 2, 165);
  text('RIGHT:  ' + fmtBtn(gpMapping.right), width / 2, 183);
  text('JUMP:  Button ' + gpMapping.jump, width / 2, 201);
  text('YOSHI EAT:  Button ' + gpMapping.eat, width / 2, 219);
  text('GET OFF YOSHI:  Button ' + gpMapping.dismount, width / 2, 237);
  text('CALL YOSHI:  Button ' + gpMapping.callYoshi, width / 2, 255);
  text('RESTART:  Button ' + gpMapping.start, width / 2, 273);

  // Live test display
  if (gp) {
    textSize(14);
    fill(150);
    text('-- Live test --', width / 2, 300);

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
    let barX = width / 2 - barW / 2;
    fill(60);
    noStroke();
    rect(barX, testY, barW, 20, 5);
    // Position dot reflects analog tilt or full-deflection if buttons used
    let visX = axisX;
    if (mappedL || dpadL) visX = -1;
    if (mappedR || dpadR) visX = 1;
    let dotX = width / 2 + visX * (barW / 2);
    fill(goingLeft || goingRight ? color(50, 255, 100) : color(150));
    ellipse(dotX, testY + 10, 16, 16);

    // Direction label
    textSize(14);
    fill(255);
    if (goingLeft) {
      text('LEFT', width / 2, testY + 45);
    } else if (goingRight) {
      text('RIGHT', width / 2, testY + 45);
    } else {
      fill(100);
      text('NEUTRAL', width / 2, testY + 45);
    }

    // Button indicators
    let btnY = testY + 70;
    fill(jumpBtn ? color(50, 255, 100) : color(80));
    rect(width / 2 - 90, btnY, 80, 30, 5);
    fill(startBtn ? color(50, 255, 100) : color(80));
    rect(width / 2 + 10, btnY, 80, 30, 5);

    fill(255);
    textSize(12);
    text('JUMP', width / 2 - 50, btnY + 15);
    text('RESTART', width / 2 + 50, btnY + 15);

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
  text('Press JUMP to continue!', width / 2, 490);

  fill(100);
  textSize(14);
  text('Press ESC to remap', width / 2, 520);
}

// ── Gamepad navigation for menus ──

let gpMenuCooldown = 0;
let gpMenuJumpPrev = false;

function pollMenuGamepad() {
  let gp = getGamepad();
  if (!gp || !gpMapped) return;

  if (gpMenuCooldown > 0) { gpMenuCooldown--; return; }

  let axisY = gp.axes[1] || 0;

  // Joystick up/down to navigate
  if (game.state === 'playerSelect') {
    if (axisY < -0.5 || axisY > 0.5) {
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
