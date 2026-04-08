// ── Camera ──

function updateCamera() {
  // Follow the rightmost alive player
  let leader = null;
  for (let p of players) {
    if (!p.dead) {
      if (!leader || p.worldX > leader.worldX) {
        leader = p;
      }
    }
  }
  if (!leader) leader = mario; // fallback

  let targetX = leader.worldX - width / 3;
  cameraX = constrain(targetX, 0, levelCols * TILE_DRAW - width);
}
