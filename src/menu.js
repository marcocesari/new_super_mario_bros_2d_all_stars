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

// ── Shared menu option renderer ──

function drawMenuOption(label, y, isSelected) {
  if (isSelected) {
    fill(255, 220, 50);
    text('> ' + label + ' <', width / 2, y);
  } else {
    fill(255);
    text('  ' + label + '  ', width / 2, y);
  }
}

// ── Main menu ──

function drawMenu() {
  background(0);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);

  textSize(28);
  text('NEW SUPER MARIO BROS 2D ALL STARS', width / 2, 50);

  if (isTouchDevice) {
    textSize(20);
    fill(255, 220, 50);
    text('Touch the screen to start playing', width / 2, 110);
  }

  textSize(22);
  drawMenuOption('I have a controller', 180, menuSelection === 0);
  drawMenuOption('Keyboard controls',   220, menuSelection === 1);

  fill(180);
  textSize(14);
  text('Use UP/DOWN arrows and ENTER to select', width / 2, 280);

  // Build version — small, top-left, visible on every viewport.
  push();
  textAlign(LEFT, TOP);
  textSize(11);
  fill(150);
  text(GAME_VERSION, 8, 8);
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
