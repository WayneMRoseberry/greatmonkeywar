// Cut scene timing (PRD reqs 62-63): what a cut scene shows at a given time,
// computed from its data alone, so it is easy to test and to skip.
//
// Stage positions are in tiles; (x, y) is an actor's bottom-centre, with
// (0, 0) the stage's top-left corner (docs/data-formats.md, "Cut scene format").

import { Facing } from './constants.js';

const DEFAULT_ANIMATION = 'idle';

/** The cut scene's length in seconds: the latest of every actor's last keyframe and every narration line's end. */
export function cutsceneLength(scene) {
  const keyframeEnds = scene.actors.map((actor) => actor.keyframes.at(-1).time);
  const narrationEnds = scene.narration.map((line) => line.end);
  return Math.max(0, ...keyframeEnds, ...narrationEnds);
}

/**
 * One actor at `time`: { character, facing, x, y, visible, animation, animationTime }.
 * Before its first keyframe it isn't visible (and stands at that keyframe).
 * Between two keyframes it moves in a straight line at an even speed; after
 * its last it stays there. Its animation is the one named by the latest
 * keyframe so far that names one ("idle" if none has), and animationTime is
 * how long that animation has been playing.
 */
function actorAt(actor, time) {
  const { keyframes } = actor;
  let animation = DEFAULT_ANIMATION;
  let animationStart = keyframes[0].time;
  let reached = -1;   // index of the latest keyframe at or before `time`
  keyframes.forEach((keyframe, i) => {
    if (keyframe.time > time) return;
    reached = i;
    if (keyframe.animation !== undefined) {
      animation = keyframe.animation;
      animationStart = keyframe.time;
    }
  });

  const from = keyframes[Math.max(reached, 0)];
  const to = keyframes[reached + 1];
  let { x, y } = from;
  if (reached >= 0 && to) {
    const fraction = (time - from.time) / (to.time - from.time);
    x = from.x + fraction * (to.x - from.x);
    y = from.y + fraction * (to.y - from.y);
  }
  return {
    character: actor.character,
    facing: actor.facing ?? Facing.RIGHT,
    x,
    y,
    visible: reached >= 0,
    animation,
    animationTime: Math.max(0, time - animationStart),
  };
}

/**
 * What the cut scene shows `time` seconds in: { actors, narration, ended }.
 * `narration` is the text of each line with start <= time < end, in order;
 * `ended` is true once `time` has reached the scene's length (req 63).
 */
export function cutsceneAt(scene, time) {
  return {
    actors: scene.actors.map((actor) => actorAt(actor, time)),
    narration: scene.narration.filter((line) => line.start <= time && time < line.end).map((line) => line.text),
    ended: time >= cutsceneLength(scene),
  };
}
