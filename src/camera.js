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

  let viewW = width / (viewScale || 1);
  // Center on Mario's body center (worldX is his left edge), not his left edge
  let leaderCenterX = leader.worldX + leader.ox + leader.hw / 2;
  let targetX = leaderCenterX - viewW / 2;
  cameraX = constrain(targetX, 0, max(0, levelCols * TILE_DRAW - viewW));
}
