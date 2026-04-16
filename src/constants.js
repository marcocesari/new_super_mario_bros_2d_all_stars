// ── Core constants ──
// Bump on each iteration so the user can tell which build the menu is running.
const GAME_VERSION = 'v2026-04-16.7';

const SCALE = 3;
const TILE = 16;
const TILE_DRAW = TILE * SCALE;
const GRAVITY = 0.6;
const SPRITE_STRIDE = 18; // sprite grid cell size (pixels) in mario_and_items.png and enemies.png

// ── Physics ──
const PLAYER_SPEED = 3;
const RIDING_SPEED = 4.5;
const JUMP_FORCE = -17;
const STOMP_BOUNCE = -8;

// ── Timers (in frames at 60fps) ──
const INVINCIBILITY_FRAMES = 120;
const DEATH_TIMER_FRAMES = 90;
const GROW_TIMER_FRAMES = 60;
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
