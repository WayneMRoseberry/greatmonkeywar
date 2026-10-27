// A recording fake canvas for tests of drawing code (task 7.1).
//
// createFakeContext() stands in for a CanvasRenderingContext2D: every drawing
// call is recorded in `calls` as { op, args, style }, where `style` is a copy
// of the drawing state (fill and stroke style, alpha, line width, font, text
// alignment, and the transform as [a, b, c, d, e, f]) when the call was made.
// save() and restore() push and pop that state, as on a real canvas.
// createFakeCanvas(width, height) is a canvas element with that context.

const DEFAULT_STYLE = {
  fillStyle: '#000000',
  strokeStyle: '#000000',
  globalAlpha: 1,
  lineWidth: 1,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  transform: [1, 0, 0, 1, 0, 0],
};

const STYLE_FIELDS = Object.keys(DEFAULT_STYLE).filter((name) => name !== 'transform');
const DRAWING_OPS = ['fillRect', 'strokeRect', 'clearRect', 'drawImage', 'fillText', 'strokeText', 'fill', 'stroke',
  'beginPath', 'closePath', 'moveTo', 'lineTo', 'rect', 'arc'];

/** Multiplies transform `m` by `n` (both [a, b, c, d, e, f]), as the canvas does. */
function multiply([a, b, c, d, e, f], [a2, b2, c2, d2, e2, f2]) {
  return [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f];
}

export function createFakeContext() {
  let state = { ...DEFAULT_STYLE, transform: [...DEFAULT_STYLE.transform] };
  const stack = [];
  const calls = [];
  const snapshot = () => ({ ...state, transform: [...state.transform] });

  const ctx = {
    calls,
    /** The recorded calls of one kind. */
    callsOf: (op) => calls.filter((call) => call.op === op),
    /** The text drawn with fillText, in order. */
    texts: () => calls.filter((call) => call.op === 'fillText').map((call) => call.args[0]),
    save() { stack.push(snapshot()); },
    restore() { if (stack.length > 0) state = stack.pop(); },
    translate(x, y) { state.transform = multiply(state.transform, [1, 0, 0, 1, x, y]); },
    scale(x, y) { state.transform = multiply(state.transform, [x, 0, 0, y, 0, 0]); },
    setTransform(a, b, c, d, e, f) { state.transform = [a, b, c, d, e, f]; },
    /** A rough width: 0.6 of the font size per character, enough for layout tests. */
    measureText(text) {
      const size = Number.parseFloat(state.font) || 10;
      return { width: String(text).length * size * 0.6 };
    },
  };
  for (const op of DRAWING_OPS) {
    ctx[op] = (...args) => { calls.push({ op, args, style: snapshot() }); };
  }
  for (const name of STYLE_FIELDS) {
    Object.defineProperty(ctx, name, { get: () => state[name], set: (value) => { state[name] = value; }, enumerable: true });
  }
  return ctx;
}

export function createFakeCanvas(width = 0, height = 0) {
  const context = createFakeContext();
  return { width, height, style: {}, getContext: () => context };
}
