// ── Core constants ──
// Bump on each iteration so the user can tell which build the menu is running.
const GAME_VERSION = 'v2026-04-16.7';

const SCALE = 3;
const TILE = 16;
const TILE_DRAW = TILE * SCALE;
const GRAVITY = 0.6;
const SPRITE_STRIDE = 18; // sprite grid cell size (pixels) in mario_and_items.png and enemies.png

// ── Physics ──
const PLAYER_SPEED = 4.2;
const RIDING_SPEED = 4.5;
const JUMP_FORCE = -17;
const STOMP_BOUNCE = -8;

// ── Timers (in frames at 60fps) ──
const INVINCIBILITY_FRAMES = 120;
const DEATH_TIMER_FRAMES = 90;
// The power-up file is 989ms long, but its last 91ms are digital silence — the
// final note ends at 898ms. The grow animation is timed in milliseconds off
// millis(), not in frames, so it lands exactly there: at 60fps a frame is
// 16.67ms, so an integer frame countdown could only reach 883ms or 900ms.
const GROW_DURATION_MS = 898;

// Grow-animation sprite phases, synced by ear to power_up_sound.mp3.
//
// The sound is three ascending arpeggio runs — the "tu, tu, tu" pulse. Each run
// restarts on a low note before sweeping up, and that pitch reset is what reads
// as the gap between pulses (the waveform itself never goes quiet — it's a
// constant-volume square wave from 16ms to 898ms).
//
// So: small Mario on each run's low reset notes, big Mario on the ascending
// body. Three flashes total. The last window's end is open-ended so the
// animation settles on big and finishGrowingPlayer() causes no visible flip.
const GROW_BIG_WINDOWS_MS = [
  [ 85, 249],      // run 1 (C):  C5 E5 G5 C6 G5  — low reset was C5 G4
  [319, 584],      // run 2 (Ab): D#5 … G#6       — low reset was G#4 C5
  [649, Infinity], // run 3 (Bb): F5 … A#6        — low reset was A#4 D5
];
const STOMP_TIMER_FRAMES = 30;
const RESPAWN_TIMER_FRAMES = 120;

// ── Hitbox dimensions ──
const SMALL_OX = 2 * SCALE, SMALL_OY = 2 * SCALE;
const SMALL_W = 14 * SCALE, SMALL_H = 16 * SCALE;
const BIG_OX = 2 * SCALE, BIG_OY = 4 * SCALE;
const BIG_W = 14 * SCALE, BIG_H = 32 * SCALE;

// ── Keycodes ──
const KEY_A = 65;
const KEY_D = 68;
const KEY_W = 87;
