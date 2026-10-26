// Sizing the canvas to the window (PRD req 6). The window and document are
// passed in, so tests use fakes.

/**
 * The canvas's size in device pixels for a window of `cssWidth` × `cssHeight`
 * CSS pixels: times the device pixel ratio (1 if missing), rounded, so the
 * canvas stays sharp on high-density screens.
 */
export function canvasPixelSize(cssWidth, cssHeight, devicePixelRatio) {
  const ratio = devicePixelRatio || 1;
  return { width: Math.round(cssWidth * ratio), height: Math.round(cssHeight * ratio) };
}

/** Sets `canvas`'s pixel size to fill the window `win`, and returns that size. */
export function fitCanvas(canvas, win) {
  const size = canvasPixelSize(win.innerWidth, win.innerHeight, win.devicePixelRatio);
  canvas.width = size.width;
  canvas.height = size.height;
  return size;
}

/**
 * Keeps `canvas` fitted to the window: fits it now, and again whenever the
 * window is resized or fullscreen is switched on or off (`doc`'s
 * fullscreenchange), each time calling onResize(size). Returns a function
 * that stops watching.
 */
export function watchCanvasSize(canvas, win, doc, onResize) {
  const refit = () => onResize(fitCanvas(canvas, win));
  win.addEventListener('resize', refit);
  doc.addEventListener('fullscreenchange', refit);
  refit();
  return () => {
    win.removeEventListener('resize', refit);
    doc.removeEventListener('fullscreenchange', refit);
  };
}
