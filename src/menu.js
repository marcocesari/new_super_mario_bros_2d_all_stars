// ── Menu screens ──

// Gamepad mapping state
let gpConnected = false;
let gpMapping = { jump: -1, start: -1 };
let gpMapStep = 0;       // 0=jump, 1=start
let gpMapped = false;
let gpMapCooldown = 0;
let gpDetectPhase = true; // true = waiting for gamepad detection
let gpLastButtons = [];   // track button states for edge detection
const GP_MAP_LABELS = ['JUMP (A/B)', 'RESTART (Start)'];
const GP_MAP_NAMES = ['jump', 'start'];

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

  textSize(42);
  text('SUPER MARIO 2D', width / 2, 100);

  textSize(14);
  text('A p5.js game', width / 2, 140);

  textSize(22);
  drawMenuOption('I have a controller', 280, menuSelection === 0);
  drawMenuOption('Keyboard controls', 330, menuSelection === 1);

  fill(180);
  textSize(14);
  text('Use UP/DOWN arrows and ENTER to select', width / 2, 430);
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
    text('Joystick = movement (auto-detected)', width / 2, 110);
    text('Now map your buttons:', width / 2, 135);

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
    textSize(16);
    let y = 360;
    for (let i = 0; i < gpMapStep; i++) {
      fill(50, 200, 50);
      text('\u2713 ' + GP_MAP_LABELS[i] + '  =  Button ' + gpMapping[GP_MAP_NAMES[i]], width / 2, y);
      y += 25;
    }

    // Detect button press for mapping
    if (gp && gpMapCooldown <= 0) {
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

  textSize(16);
  fill(200);
  text('MOVE:  Joystick left/right', width / 2, 190);
  text('JUMP:  Button ' + gpMapping.jump, width / 2, 220);
  text('RESTART:  Button ' + gpMapping.start, width / 2, 250);

  // Live test display
  if (gp) {
    textSize(14);
    fill(150);
    text('-- Live test --', width / 2, 300);

    let axisX = gp.axes[0] || 0;
    let jumpBtn = gp.buttons[gpMapping.jump] && gp.buttons[gpMapping.jump].pressed;
    let startBtn = gp.buttons[gpMapping.start] && gp.buttons[gpMapping.start].pressed;

    // Draw joystick indicator
    let testY = 350;
    let barW = 200;
    let barX = width / 2 - barW / 2;
    fill(60);
    noStroke();
    rect(barX, testY, barW, 20, 5);
    // Joystick position dot
    let dotX = width / 2 + axisX * (barW / 2);
    fill(abs(axisX) > STICK_DEADZONE ? color(50, 255, 100) : color(150));
    ellipse(dotX, testY + 10, 16, 16);

    // Direction label
    textSize(14);
    fill(255);
    if (axisX < -STICK_DEADZONE) {
      text('LEFT', width / 2, testY + 45);
    } else if (axisX > STICK_DEADZONE) {
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
