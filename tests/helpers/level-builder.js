// Builds complete game data for simulation tests from a few grid strings.
//
// buildData(grid, overrides) returns data in the same shape the loader returns
// (see src/data/validate.js), holding one level named TEST_LEVEL that uses
// `grid`, plus default definitions, tuning, bindings, and display settings.
//
// Standard legend characters (see docs/data-formats.md for the level format):
//   #  solid ground          P  player start       G  goal
//   e  enemy ("beetle")      c  stackable crate    o  coconut (not stackable)
//   b  reward worth 1
//
// overrides (all optional):
//   legend:  extra or replacement legend entries
//   level:   other level fields (e.g. { cutscene: 'x' })
//   player:  fields merged into the player definition
//   enemy:   fields merged into the beetle definition
//   tuning:  fields merged into tuning
//   display: fields merged into display

export const TEST_LEVEL = 'test';

const DEFAULT_LEGEND = {
  '#': { tile: { solid: true, color: '#6b4f2a' } },
  P: { playerStart: true },
  G: { goal: true, color: '#ff3030' },
  e: { enemy: 'beetle' },
  c: { object: 'crate' },
  o: { object: 'coconut' },
  b: { reward: { value: 1, color: '#ffe135' } },
};

const DEFAULT_PLAYER = {
  formatVersion: 1, kind: 'player', name: 'Hero',
  size: { width: 0.8, height: 1.4 }, health: 3, speed: 6, punchDamage: 1, color: '#d2691e',
};

const DEFAULT_ENEMY = {
  formatVersion: 1, kind: 'enemy', name: 'Beetle',
  size: { width: 0.9, height: 0.7 }, health: 1, speed: 2, color: '#5a2d82',
};

const DEFAULT_OBJECTS = {
  crate: { formatVersion: 1, name: 'Crate', size: { width: 1, height: 1 }, stackable: true, color: '#a0522d' },
  coconut: { formatVersion: 1, name: 'Coconut', size: { width: 0.5, height: 0.5 }, color: '#6f4e37' },
};

const DEFAULT_TUNING = {
  formatVersion: 1, gravity: 35, maxFallSpeed: 20, jumpSpeed: 14,
  throwSpeed: { x: 10, y: 6 }, dropSpeed: { x: 0, y: 0 }, knockback: { x: 6, y: 6 },
  invincibilitySeconds: 1, stompBounceSpeed: 10, punchSeconds: 0.15,
};

const DEFAULT_BINDINGS = {
  formatVersion: 1,
  keyboard: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'ArrowUp', 'KeyW'], action: ['KeyE', 'KeyX'], punch: ['KeyQ', 'KeyC'],
    confirm: ['Enter', 'Space'], fullscreen: ['F11'], debug: ['F3'],
  },
  gamepad: {
    left: ['dpadLeft', 'stickLeft'], right: ['dpadRight', 'stickRight'], up: ['dpadUp', 'stickUp'],
    down: ['dpadDown', 'stickDown'], jump: ['a'], action: ['x'], punch: ['b'], confirm: ['a'],
  },
};

const DEFAULT_DISPLAY = { formatVersion: 1, visibleHeight: 12, stickDeadZone: 0.3 };

/** A deep copy, so tests can change the result without affecting other tests. */
const copy = (value) => structuredClone(value);

export function buildData(grid, overrides = {}) {
  const level = {
    formatVersion: 1,
    name: 'Test Level',
    grid: [...grid],
    legend: { ...copy(DEFAULT_LEGEND), ...copy(overrides.legend ?? {}) },
    background: { color: '#87ceeb', layers: [] },
    ...copy(overrides.level ?? {}),
  };

  return {
    levelList: { formatVersion: 1, levels: [TEST_LEVEL] },
    levels: { [TEST_LEVEL]: level },
    characters: {
      player: { ...copy(DEFAULT_PLAYER), ...copy(overrides.player ?? {}) },
      beetle: { ...copy(DEFAULT_ENEMY), ...copy(overrides.enemy ?? {}) },
    },
    objects: copy(DEFAULT_OBJECTS),
    cutscenes: {},
    sprites: {},
    tuning: { ...copy(DEFAULT_TUNING), ...copy(overrides.tuning ?? {}) },
    bindings: copy(DEFAULT_BINDINGS),
    display: { ...copy(DEFAULT_DISPLAY), ...copy(overrides.display ?? {}) },
  };
}
