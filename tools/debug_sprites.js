let spriteSheet;
const ZOOM = 4;
let offsetX = 0, offsetY = 0;
let dragging = false;
let dragStartX, dragStartY, offsetStartX, offsetStartY;

let gridW = 16;
let gridH = 16;
let gridOffX = 0;
let gridOffY = 0;

function preload() {
  spriteSheet = loadImage('assets/blocks.png');
}

function setup() {
  createCanvas(800, 1000);
  noSmooth();
}

function draw() {
  background(40);

  push();
  translate(offsetX, offsetY);
  scale(ZOOM);

  image(spriteSheet, 0, 0);

  stroke(255, 0, 0, 120);
  strokeWeight(1 / ZOOM);

  for (let x = gridOffX; x <= spriteSheet.width; x += gridW) {
    line(x, 0, x, spriteSheet.height);
  }
  for (let y = gridOffY; y <= spriteSheet.height; y += gridH) {
    line(0, y, spriteSheet.width, y);
  }

  pop();

  let sx = floor((mouseX - offsetX) / ZOOM);
  let sy = floor((mouseY - offsetY) / ZOOM);
  let cellCol = floor((sx - gridOffX) / gridW);
  let cellRow = floor((sy - gridOffY) / gridH);
  fill(255);
  noStroke();
  textSize(14);
  text(`Pixel: (${sx}, ${sy})  |  Cell: (col=${cellCol}, row=${cellRow})  |  Grid: ${gridW}x${gridH}`, 10, height - 40);
  text(`Q/A: grid width  |  W/S: grid height  |  Arrows: grid offset  |  Drag: pan`, 10, height - 20);
}

function keyPressed() {
  if (key === 'q') gridW++;
  if (key === 'a' && gridW > 1) gridW--;
  if (key === 'w') gridH++;
  if (key === 's' && gridH > 1) gridH--;
  if (keyCode === RIGHT_ARROW) gridOffX++;
  if (keyCode === LEFT_ARROW) gridOffX--;
  if (keyCode === UP_ARROW) gridOffY--;
  if (keyCode === DOWN_ARROW) gridOffY++;
}

function mousePressed() {
  dragging = true;
  dragStartX = mouseX;
  dragStartY = mouseY;
  offsetStartX = offsetX;
  offsetStartY = offsetY;
}

function mouseDragged() {
  if (dragging) {
    offsetX = offsetStartX + (mouseX - dragStartX);
    offsetY = offsetStartY + (mouseY - dragStartY);
  }
}

function mouseReleased() {
  dragging = false;
}
