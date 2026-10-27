// Tests for cut scene timing (task 6.7; PRD reqs 62-63).
//
// cutsceneAt(scene, time) gives what the cut scene shows `time` seconds in,
// from the cut scene's data alone (docs/data-formats.md, "Cut scene format"):
//  - each actor's stage position (the bottom-centre of its box), moving in a
//    straight line at an even speed between keyframes; before its first
//    keyframe it is not shown, and after its last it stays where it is;
//  - each actor's animation: the one named by the latest keyframe that names
//    one, or "idle"; and how long that animation has been playing, so the
//    presentation can pick the frame;
//  - the narration lines showing: those whose start <= time < end;
//  - whether the scene has ended: once time reaches the latest of every
//    actor's last keyframe and every narration line's end.
// Decided: an actor's facing comes from its "facing" field (default right).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cutsceneAt, cutsceneLength } from '../../src/simulation/cutscene.js';
import { Facing } from '../../src/simulation/constants.js';

function assertNear(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label} was ${actual}, expected ${expected}`);
}

/** A cut scene with the given actors and narration. */
function scene({ actors = [], narration = [] } = {}) {
  return {
    formatVersion: 1, stage: { width: 16, height: 9 }, background: 'images/cutscene.png',
    backgroundColor: '#000000', actors, narration,
  };
}

const WALKER = {
  character: 'player',
  keyframes: [
    { time: 1, x: 0, y: 8, animation: 'run' },
    { time: 3, x: 8, y: 8, animation: 'idle' },
    { time: 5, x: 8, y: 4 },
  ],
};

describe('actors (req 62)', () => {
  test('before its first keyframe an actor is not shown', () => {
    const [actor] = cutsceneAt(scene({ actors: [WALKER] }), 0.5).actors;
    assert.equal(actor.visible, false);
  });

  test('at a keyframe an actor is exactly at that keyframe\'s position', () => {
    const [first, second] = WALKER.keyframes;
    const atFirst = cutsceneAt(scene({ actors: [WALKER] }), first.time).actors[0];
    assert.equal(atFirst.visible, true);
    assert.deepEqual({ x: atFirst.x, y: atFirst.y }, { x: first.x, y: first.y });
    const atSecond = cutsceneAt(scene({ actors: [WALKER] }), second.time).actors[0];
    assert.deepEqual({ x: atSecond.x, y: atSecond.y }, { x: second.x, y: second.y });
  });

  test('between keyframes it moves in a straight line at an even speed', () => {
    const [first, second] = WALKER.keyframes;
    const fraction = 0.25;
    const time = first.time + fraction * (second.time - first.time);
    const [actor] = cutsceneAt(scene({ actors: [WALKER] }), time).actors;
    assertNear(actor.x, first.x + fraction * (second.x - first.x), 'x');
    assertNear(actor.y, first.y + fraction * (second.y - first.y), 'y');
  });

  test('it moves along each leg in turn, including straight up', () => {
    const [, second, third] = WALKER.keyframes;
    const time = (second.time + third.time) / 2;
    const [actor] = cutsceneAt(scene({ actors: [WALKER] }), time).actors;
    assertNear(actor.x, second.x, 'x');
    assertNear(actor.y, (second.y + third.y) / 2, 'y');
  });

  test('after its last keyframe it stays where it is', () => {
    const last = WALKER.keyframes.at(-1);
    const [actor] = cutsceneAt(scene({ actors: [WALKER] }), last.time + 10).actors;
    assert.deepEqual({ x: actor.x, y: actor.y, visible: actor.visible }, { x: last.x, y: last.y, visible: true });
  });

  test('an actor with one keyframe stands there from that time on', () => {
    const only = { time: 2, x: 3, y: 7 };
    const still = { character: 'player', keyframes: [only] };
    assert.equal(cutsceneAt(scene({ actors: [still] }), 1).actors[0].visible, false);
    const [actor] = cutsceneAt(scene({ actors: [still] }), 4).actors;
    assert.deepEqual({ x: actor.x, y: actor.y, visible: actor.visible }, { x: only.x, y: only.y, visible: true });
  });

  test('the actor\'s character is passed on, and it faces right unless it says otherwise', () => {
    const left = { ...WALKER, facing: Facing.LEFT };
    const [right, leftActor] = cutsceneAt(scene({ actors: [WALKER, left] }), 2).actors;
    assert.equal(right.character, WALKER.character);
    assert.equal(right.facing, Facing.RIGHT);
    assert.equal(leftActor.facing, Facing.LEFT);
  });

  describe('animation', () => {
    test('the animation is the one named by the latest keyframe so far', () => {
      const [, second] = WALKER.keyframes;
      assert.equal(cutsceneAt(scene({ actors: [WALKER] }), 2).actors[0].animation, 'run');
      assert.equal(cutsceneAt(scene({ actors: [WALKER] }), second.time).actors[0].animation, 'idle');
    });

    test('a keyframe that names no animation keeps the previous one', () => {
      const last = WALKER.keyframes.at(-1);
      assert.equal(cutsceneAt(scene({ actors: [WALKER] }), last.time + 1).actors[0].animation, 'idle');
    });

    test('with no animation named yet it is "idle"', () => {
      const plain = { character: 'player', keyframes: [{ time: 0, x: 0, y: 0 }, { time: 2, x: 4, y: 0 }] };
      assert.equal(cutsceneAt(scene({ actors: [plain] }), 1).actors[0].animation, 'idle');
    });

    test('animationTime is how long the current animation has been playing', () => {
      const [first, second] = WALKER.keyframes;
      const into = 0.5;
      assertNear(cutsceneAt(scene({ actors: [WALKER] }), first.time + into).actors[0].animationTime, into, 'run time');
      assertNear(cutsceneAt(scene({ actors: [WALKER] }), second.time + into).actors[0].animationTime, into, 'idle time');
    });

    test('a keyframe that names no animation doesn\'t restart the one playing', () => {
      const [, second, third] = WALKER.keyframes;   // "idle" starts at the second; the third names none
      const time = third.time + 1;
      assertNear(cutsceneAt(scene({ actors: [WALKER] }), time).actors[0].animationTime, time - second.time, 'idle time');
    });
  });
});

describe('narration (req 62)', () => {
  const LINES = [
    { start: 0.5, end: 3, text: 'First.' },
    { start: 2, end: 4, text: 'Second, overlapping.' },
    { start: 5, end: 6, text: 'Third.' },
  ];

  test('a line shows from its start until its end', () => {
    const at = (time) => cutsceneAt(scene({ narration: LINES }), time).narration;
    assert.deepEqual(at(0.4), []);
    assert.deepEqual(at(0.5), ['First.']);
    assert.deepEqual(at(2.5), ['First.', 'Second, overlapping.']);
    assert.deepEqual(at(3), ['Second, overlapping.'], 'a line is gone at its end');
    assert.deepEqual(at(4.5), []);
    assert.deepEqual(at(5.5), ['Third.']);
  });
});

describe('the end of the scene (req 63)', () => {
  test('the length is the latest of every actor\'s last keyframe and every line\'s end', () => {
    const lineEnd = 6;
    const lastKeyframe = WALKER.keyframes.at(-1).time;
    assert.ok(lineEnd > lastKeyframe);
    const withLine = scene({ actors: [WALKER], narration: [{ start: 1, end: lineEnd, text: 'Long.' }] });
    assert.equal(cutsceneLength(withLine), lineEnd);
    assert.equal(cutsceneLength(scene({ actors: [WALKER] })), lastKeyframe);
  });

  test('it has ended once the time reaches its length, not before', () => {
    const length = cutsceneLength(scene({ actors: [WALKER] }));
    assert.equal(cutsceneAt(scene({ actors: [WALKER] }), length - 0.01).ended, false);
    assert.equal(cutsceneAt(scene({ actors: [WALKER] }), length).ended, true);
  });

  test('a scene with no actors and no narration has length 0, and has ended at once', () => {
    assert.equal(cutsceneLength(scene()), 0);
    assert.equal(cutsceneAt(scene(), 0).ended, true);
  });
});
