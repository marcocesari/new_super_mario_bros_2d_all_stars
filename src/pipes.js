// ── Warp pipes & underground bonus rooms ──
//
// A 'v' above a pipe in a level map makes it an entrance: standing on it and
// holding DOWN (arrow key, S for P2, stick/d-pad down, or the touch joystick
// pulled down) sinks the player into the pipe and drops them into the
// level's underground room. The room's own 'v' pipe brings them back up out
// of the level's '^' pipe, far along the course.

const PIPE_SINK_FRAMES = 60;               // ~1s, about the length of the pipe SFX
const PIPE_HOLD_FRAMES = 12;               // brief pause fully inside the pipe
const PIPE_SINK_DIST = 2 * TILE_DRAW + 16; // deep enough to hide Mario-on-Yoshi too
const PIPE_EDGE_MARGIN = 12;               // how close to the pipe's rim you may stand

let pipeEntrances = [];   // [{ col, row }] left column + top row of each 'v' pipe
let pipeExit = null;      // { col, row } of the '^' pipe in the current map
let pipeWarp = null;      // active enter/emerge animation, or null
let inUnderground = false;
let savedOverworld = null;   // overworld state stashed while underground
let savedUnderground = null; // underground state, so collected coins stay gone

let _drawingPipePlayers = false;

// ── Map parsing ──

// Find the pipe directly beneath a marker. Returns its left column and top
// row, or null if the marker isn't sitting on a pipe.
function _findPipeBelow(row, col) {
  for (let r = row + 1; r < levelRows; r++) {
    let t = levelData[r][col];
    if (t === 'pipeTopL' || t === 'pipeBodyL') return { col: col, row: r };
    if (t === 'pipeTopR' || t === 'pipeBodyR') return { col: col - 1, row: r };
    if (t) return null;
  }
  return null;
}

// Called after levelData has been built from mapStrings.
function scanPipeMarkers(mapStrings) {
  pipeEntrances = [];
  pipeExit = null;
  for (let r = 0; r < mapStrings.length; r++) {
    for (let c = 0; c < mapStrings[r].length; c++) {
      let ch = mapStrings[r][c];
      if (ch !== 'v' && ch !== '^') continue;
      let pipe = _findPipeBelow(r, c);
      if (!pipe) continue;
      if (ch === 'v') pipeEntrances.push(pipe);
      else pipeExit = pipe;
    }
  }
}

function resetPipeState() {
  pipeWarp = null;
  inUnderground = false;
  savedOverworld = null;
  savedUnderground = null;
}

// ── Input ──

// Strongest odd-indexed axis (1, 3…) — the vertical stick on most pads.
function _readGamepadAxisY(gp) {
  let strongest = 0;
  for (let i = 1; i < gp.axes.length; i += 2) {
    let v = gp.axes[i];
    if (typeof v !== 'number' || isNaN(v)) continue;
    if (abs(v) > abs(strongest)) strongest = v;
  }
  return strongest;
}

function isDownHeld(player) {
  if (player === mario) {
    if (keyIsDown(DOWN_ARROW) || touchDownHeld) return true;
    let gp = getGamepad();
    if (gp && gpMapped) {
      if (gp.buttons[13] && gp.buttons[13].pressed) return true;
      if (_readGamepadAxisY(gp) > 0.5) return true;
    }
    return false;
  }
  return keyIsDown(KEY_S);
}

// The entrance pipe the player is standing on top of, or null.
function pipeUnderPlayer(player) {
  if (!player || player.dead || player.growing || player.inPipe || !player.onGround) return null;
  let feet = player.worldY + player.oy + player.hh;
  let cx = player.worldX + player.ox + player.hw / 2;
  for (let p of pipeEntrances) {
    if (abs(feet - p.row * TILE_DRAW) > 4) continue;
    let left = p.col * TILE_DRAW;
    let right = left + 2 * TILE_DRAW;
    if (cx >= left + PIPE_EDGE_MARGIN && cx <= right - PIPE_EDGE_MARGIN) return p;
  }
  return null;
}

// Called at the start of updatePlayer. Returns true if the player just
// started going down a pipe (and so should skip the rest of the update).
function tryEnterPipe(player) {
  if (pipeWarp || !isDownHeld(player)) return false;
  let pipe = pipeUnderPlayer(player);
  if (!pipe) return false;

  _centerOnPipe(player, pipe);
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.inPipe = true;
  player.state = 'idle';
  player.animFrame = 0;
  pipeWarp = { phase: 'enter', player: player, timer: 0, startY: player.worldY };
  playPipeSound();
  return true;
}

function _centerOnPipe(player, pipe) {
  player.worldX = (pipe.col + 1) * TILE_DRAW - player.ox - player.hw / 2;
}

function playPipeSound() {
  let s = sounds.pipe;
  if (!s) return;
  try { s.setVolume(1.2); } catch (e) {}
  playSoundSafe(s);
}

// ── Per-frame animation (everything else is frozen while this runs) ──

function updatePipeWarp() {
  let w = pipeWarp;
  let p = w.player;
  w.timer++;
  let t = min(1, w.timer / PIPE_SINK_FRAMES);

  if (w.phase === 'enter') {
    p.worldY = w.startY + PIPE_SINK_DIST * t;
    if (w.timer >= PIPE_SINK_FRAMES + PIPE_HOLD_FRAMES) {
      if (inUnderground) leaveUnderground(p);
      else enterUnderground();
    }
  } else {
    p.worldY = w.startY - PIPE_SINK_DIST * t;
    if (w.timer >= PIPE_SINK_FRAMES) {
      p.inPipe = false;
      p.onGround = true;
      p.vy = 0;
      pipeWarp = null;
    }
  }
}

// ── Room switching ──

function _captureRoomState() {
  return {
    levelData, levelRows, levelCols,
    enemies, popups, coinPopups, yoshiEggs,
    yoshis: yoshis.filter(y => !y.mounted),   // ridden Yoshis travel with the player
    pipeEntrances, pipeExit,
  };
}

function _restoreRoomState(s) {
  let ridden = yoshis.filter(y => y.mounted);
  levelData = s.levelData;
  levelRows = s.levelRows;
  levelCols = s.levelCols;
  enemies = s.enemies;
  popups = s.popups;
  coinPopups = s.coinPopups;
  yoshiEggs = s.yoshiEggs;
  yoshis = s.yoshis.concat(ridden);
  pipeEntrances = s.pipeEntrances;
  pipeExit = s.pipeExit;
}

function enterUnderground() {
  savedOverworld = _captureRoomState();
  if (savedUnderground) {
    _restoreRoomState(savedUnderground);
  } else {
    let ridden = yoshis.filter(y => y.mounted);
    buildLevelGrid(LEVEL_UNDERGROUNDS[game.currentLevel]);
    popups = [];
    coinPopups = [];
    yoshiEggs = [];
    yoshis = ridden;
  }
  inUnderground = true;
  pipeWarp = null;

  // Drop in from the ceiling at the left of the room.
  players.forEach((pl, i) => {
    pl.inPipe = false;
    pl.worldX = (2 + i) * TILE_DRAW;
    pl.worldY = TILE_DRAW;
    pl.vx = 0;
    pl.vy = 0;
    pl.onGround = false;
  });
  updateCamera();
}

function leaveUnderground(trigger) {
  savedUnderground = _captureRoomState();
  _restoreRoomState(savedOverworld);
  savedOverworld = null;
  inUnderground = false;
  pipeWarp = null;

  let exit = pipeExit || pipeEntrances[0];
  if (!exit) {
    // No exit pipe in this map — just drop the players back at the start.
    for (let pl of players) {
      pl.inPipe = false;
      pl.worldX = 3 * TILE_DRAW;
      pl.worldY = 7 * TILE_DRAW;
      pl.onGround = false;
    }
    updateCamera();
    return;
  }

  // The partner (2P) waits beside the pipe; the player who went down pops out of it.
  for (let pl of players) {
    if (pl === trigger) continue;
    pl.inPipe = false;
    pl.worldX = (exit.col - 1) * TILE_DRAW;
    pl.worldY = (exit.row - 1) * TILE_DRAW - pl.oy - pl.hh;
    pl.vx = 0;
    pl.vy = 0;
    pl.onGround = false;
  }

  _centerOnPipe(trigger, exit);
  let restY = exit.row * TILE_DRAW - trigger.oy - trigger.hh;
  trigger.worldY = restY + PIPE_SINK_DIST;
  trigger.vx = 0;
  trigger.vy = 0;
  trigger.onGround = false;
  trigger.inPipe = true;
  trigger.state = 'idle';
  pipeWarp = { phase: 'emerge', player: trigger, timer: 0, startY: trigger.worldY };
  updateCamera();
  playPipeSound();
}

// ── Drawing ──

// Players inside a pipe are drawn BEFORE the level tiles, so the pipe covers
// whatever part of them has already sunk below its rim.
function drawPipePlayers() {
  _drawingPipePlayers = true;
  for (let p of players) {
    if (p.inPipe) drawPlayer(p, p === luigi);
  }
  _drawingPipePlayers = false;
}

// A bouncing yellow "V" arrow above every warp-entrance pipe, so players can
// see which pipes can be entered with DOWN.
function drawPipeMarkers() {
  let bob = sin(frameCount * 0.12) * 6;
  for (let p of pipeEntrances) {
    let cx = (p.col + 1) * TILE_DRAW - cameraX;   // centre of the 2-wide pipe
    let tipY = p.row * TILE_DRAW - 14 + bob;     // arrow tip just above the rim
    let w = 30, h = 26, t = 9;                   // width, height, stroke thickness
    push();
    stroke(0);
    strokeWeight(4);
    strokeJoin(ROUND);
    fill(255, 216, 0);
    // Chunky "V" shape pointing down into the pipe
    beginShape();
    vertex(cx - w / 2, tipY - h);
    vertex(cx - w / 2 + t, tipY - h);
    vertex(cx, tipY - t * 1.2);
    vertex(cx + w / 2 - t, tipY - h);
    vertex(cx + w / 2, tipY - h);
    vertex(cx, tipY);
    endShape(CLOSE);
    pop();
  }
}
