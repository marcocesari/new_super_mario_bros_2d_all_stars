// ── Mario sprite frames (18x18 grid in mario_and_items.png) ──

// Small Mario: row 4, 1 cell tall (18x18)
function smallFrame(col) {
  return { x: col * SPRITE_STRIDE, y: 4 * SPRITE_STRIDE, w: SPRITE_STRIDE, h: SPRITE_STRIDE };
}

// Big Mario: rows 0-1, 2 cells tall (18x36)
function bigFrame(col) {
  return { x: col * SPRITE_STRIDE, y: 0, w: SPRITE_STRIDE, h: SPRITE_STRIDE * 2 };
}

const FRAMES_SMALL = {
  idle: [smallFrame(0)],
  walk: [smallFrame(4), smallFrame(5), smallFrame(6)],
  jump: [smallFrame(2)],
  dead: [smallFrame(3)],
};

const FRAMES_BIG = {
  idle: [bigFrame(0)],
  walk: [bigFrame(4), bigFrame(5), bigFrame(6)],
  jump: [bigFrame(2)],
  dead: [bigFrame(3)],
};

// ── Enemy sprite frames (18x18 grid in enemies.png) ──

function enemyFrame(col, row) {
  return { x: col * SPRITE_STRIDE, y: row * SPRITE_STRIDE, w: SPRITE_STRIDE, h: SPRITE_STRIDE };
}

const ENEMY_FRAMES = {
  goomba: {
    walk: [enemyFrame(0, 1), enemyFrame(1, 1)],
    squished: [enemyFrame(2, 1)],
  },
  koopa: {
    walk: [enemyFrame(3, 4), enemyFrame(4, 4)],
    shell: [enemyFrame(7, 7)],
  },
};

// ── Item popup sprite (mushroom from ? block) ──
const QUESTION_ITEM = [
  { x: 0 * SPRITE_STRIDE, y: 5 * SPRITE_STRIDE, w: SPRITE_STRIDE, h: SPRITE_STRIDE },
  { x: 1 * SPRITE_STRIDE, y: 5 * SPRITE_STRIDE, w: SPRITE_STRIDE, h: SPRITE_STRIDE },
];

// ── Block sprite lookup (16x16 grid in blocks.png) ──

function blk(col, row) {
  return { x: col * TILE, y: row * TILE, w: TILE, h: TILE };
}

const BLOCK_SPRITES = {
  brick:      blk(1, 0),
  ground:     blk(4, 0),
  groundFill: blk(4, 0),
  solidBlock: blk(1, 0),
  question:   blk(6, 1),
  hitBlock:   blk(1, 0),
  pipeTopL:   blk(16, 6),
  pipeTopR:   blk(17, 6),
  pipeBodyL:  blk(16, 7),
  pipeBodyR:  blk(17, 7),
  coin:       blk(9, 11),
  coinBlock:  blk(6, 1), // looks like ? block, gives coin
  yoshiBlock: blk(6, 1), // looks like ? block, gives yoshi egg
};

// ── Tile character → block type mapping ──
const TILE_CHARS = {
  '.': null,
  'B': 'brick',
  '#': 'ground',
  '=': 'groundFill',
  'X': 'solidBlock',
  '?': 'question',
  '[': 'pipeTopL',
  ']': 'pipeTopR',
  '{': 'pipeBodyL',
  '}': 'pipeBodyR',
  'F': 'flag',
  'c': 'coinBlock',
  'g': null, // goomba spawn (tile is empty)
  'k': null, // koopa spawn (tile is empty)
  'y': 'yoshiBlock', // yoshi egg block (looks like ? block)
};
