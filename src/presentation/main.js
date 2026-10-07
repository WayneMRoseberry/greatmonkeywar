// Browser entry point.
//
// For now this only proves that browser mode works: it fills the window with the
// canvas and draws a placeholder rectangle. Task 7.16 replaces it with the real
// game start-up (load data, pick the platform, start the game loop).

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  draw();
}

function draw() {
  const { width, height } = canvas;
  ctx.fillStyle = '#87ceeb';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(width * 0.4, height * 0.4, width * 0.2, height * 0.2);
}

window.addEventListener('resize', resize);
resize();
