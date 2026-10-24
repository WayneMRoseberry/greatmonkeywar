// Carriable objects: crates, coconuts, and the like (PRD reqs 28-37).
//
// Assumes valid data: objects are built by createLevelState (state.js), which
// fails with a LevelDataError if an object's definition is missing, so every
// object's `type` names a definition in data.objects.

/**
 * An object's changing state: the one central declaration of its properties.
 * Instances are sealed, as Player's are: assigning a property that isn't
 * declared here throws a TypeError.
 *
 * Positions and sizes are in tiles; speeds in tiles per second. What doesn't
 * change (stackable, colour, sprite) stays in the object definition.
 */
export class CarriableObject {
  type = '';              // the object definition's name in data.objects, e.g. 'crate'
  x = 0;                  // left edge of the collision box
  y = 0;                  // top edge of the collision box; y increases downwards
  width = 0;              // collision box size, from the object definition
  height = 0;
  vx = 0;                 // horizontal speed: + is right, - is left
  vy = 0;                 // vertical speed: + is falling, - is rising
  resting = false;        // true when on something solid; a resting stackable object is itself solid (req 35)

  /** A CarriableObject with the given starting values; anything not given keeps its default. */
  constructor(values = {}) {
    for (const name of Object.keys(values)) {
      if (!Object.hasOwn(this, name)) throw new Error(`"${name}" is not a CarriableObject property`);
    }
    Object.assign(this, values);
    Object.seal(this);
  }

  /** A separate CarriableObject with the same values. */
  copy() {
    return new CarriableObject({ ...this });
  }
}
