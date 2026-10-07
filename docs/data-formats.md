# Data Formats

The specification for every game data file. This document is for developers: it is the source for the JSON Schemas (`src/data/schemas/`) and the validator (`src/data/validate.js`). Designers and artists should read the guides instead (`docs/guide-*.md`, written in task 2.14).

Requirement numbers refer to the [engine prototype PRD](../tasks/prd-engine-prototype.md).

## Conventions (all formats)

- **Units.** All positions and sizes in the world are measured in **tiles**: one tile is 1 × 1 world unit. Pixel sizes are never used in level data, because the game scales freely to the window (req 6).
- **Coordinates.** `x` increases to the right and `y` increases downwards. The top-left corner of a level is (0, 0). This matches reading the tile grid as text: row 0 is the top line.
- **References to other data files** use the file's name without folder or extension. For example, `"enemy": "beetle"` means `data/characters/beetle.json`. The folder is implied by the field name.
- **References to images** are paths relative to the `data/` folder, with the extension. For example, `"images/jungle-far.png"`.
- **Colours** are CSS hex colours: `"#7a5230"` (or `"#7a5230cc"` with transparency).
- **`formatVersion`.** Every file starts with `"formatVersion": 1`. If a format changes in a way that breaks existing files, the version goes up and the validator reports files that use an old version.
- **`$schema` (optional).** Any file may include a `"$schema"` field pointing at its schema in `src/data/schemas/`. Editors such as VS Code then check the file and suggest field names while it is being edited. The game ignores this field.
- **Unknown fields are errors.** A misspelled field name (for example `"colour"` instead of `"color"`) is reported rather than silently ignored.
- **Speeds** are in tiles per second; **accelerations** in tiles per second per second; **times** in seconds.

## Level format

**Location:** `data/levels/<name>.json`, for example `data/levels/level1.json`.
**Requirements:** 45–47, 54, 57, 61, 66–70, 73, 75.

### Design

A level is drawn as **text**: the tile grid is an array of strings, one string per row, one character per tile. A **legend** says what each character means.

Everything placed in the level goes in the grid, not just the ground and walls: the player's start point, the goal, enemies, objects, and rewards. A designer can therefore see the whole level in the file, and nothing can be placed outside the level. This makes the "entities placed outside the level" check in req 83 impossible to fail, since an entity's position *is* its place in the grid.

### Example

```json
{
  "formatVersion": 1,
  "name": "Jungle Edge",
  "grid": [
    "..............................",
    "..............................",
    "......................bbb.....",
    "..................======......",
    "..........b.b.................",
    ".........#####...........c....",
    "..P.................c....c...G",
    "######....######..########.###",
    "######....######..########.###"
  ],
  "legend": {
    "#": { "tile": { "solid": true, "color": "#6b4f2a" } },
    "=": { "tile": { "solid": true, "color": "#3f7f3f" } },
    "P": { "playerStart": true },
    "G": { "goal": true, "color": "#ff3030" },
    "b": { "reward": { "value": 1, "color": "#ffe135" } },
    "c": { "object": "crate" },
    "e": { "enemy": "beetle" }
  },
  "background": {
    "color": "#87ceeb",
    "layers": [
      { "image": "images/jungle-far.png",  "scrollFactor": 0.1 },
      { "image": "images/jungle-mid.png",  "scrollFactor": 0.4 },
      { "image": "images/jungle-near.png", "scrollFactor": 0.7 }
    ]
  },
  "cutscene": "after-level1"
}
```

### Fields

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1` for now. |
| `name` | yes | string | Shown to players, for example on the level-complete screen. |
| `grid` | yes | array of strings | The level, one string per row, top row first. All rows must be the same length. Width = row length, height = number of rows, in tiles. |
| `legend` | yes | object | Maps single characters to what they mean (see below). |
| `background` | yes | object | Background colour and parallax layers (see below). |
| `cutscene` | no | string | Name of a cut scene in `data/cutscenes/` that plays after this level is completed and the player chooses Next level (reqs 59, 61). |

### Grid characters

- `.` always means **empty space**. It does not need to be in the legend and cannot be redefined.
- Every other character used in the grid must be in the legend. An unknown character is a validation error (req 83).
- Legend keys must be exactly one character long.
- Any visible character can be used except `.`. Letters are case-sensitive, so `c` and `C` are different.

### Legend entries

Each legend entry has **exactly one** of these keys:

| Entry | Meaning | Extra fields |
|---|---|---|
| `{ "tile": { ... } }` | A tile. | `solid` (boolean, required): the player, enemies, and objects collide with it. `color` (required): its colour. |
| `{ "playerStart": true }` | Where the player starts and respawns (reqs 26, 57). | None. |
| `{ "goal": true }` | The goal; touching it completes the level (req 58). | `color` (required). |
| `{ "enemy": "<name>" }` | An enemy of this type, defined in `data/characters/<name>.json`. | None. Everything about the enemy comes from its definition. |
| `{ "object": "<name>" }` | A carriable object of this type, defined in `data/objects/<name>.json`. | None. |
| `{ "reward": { ... } }` | A reward item (req 42). | `value` (number, optional, default 1): how much the reward count goes up (req 43). `color` (required). |

Rules:

- Each level must contain **exactly one** `playerStart` character and **exactly one** `goal` character in the grid (req 57). Legend entries that aren't used in the grid are allowed; they produce a warning, not an error.
- The cell holding a `playerStart`, `goal`, enemy, object, or reward counts as empty space. To stand an enemy on the ground, put the enemy in the row above a solid tile.
- **Placement within a cell:** an entity is placed so that the bottom-centre of its collision box sits at the bottom-centre of its cell. An entity bigger than a tile extends upwards and sideways from there, so a 1.5-tile-tall player placed directly above the ground stands on the ground.
- Objects placed in a column, such as two crates (`c`) one above the other, start stacked if they are stackable (req 35). If they aren't stackable, they fall to the ground when the level starts.

### Background

| Field | Required | Type | Meaning |
|---|---|---|---|
| `background.color` | yes | colour | Fills the screen behind all layers, and the space around a level smaller than the window (req 67). |
| `background.layers` | yes | array | Parallax layers, drawn in order: the **first layer is the farthest away**. The prototype levels need at least three (req 69); the format allows any number, including zero. |
| `layers[].image` | yes | image path | The layer's image. |
| `layers[].scrollFactor` | yes | number from 0 to 1 | 0 = never moves; 1 = moves with the level; values in between create depth (req 68). |
| `layers[].repeat` | no | boolean, default `true` | Repeat the image horizontally to cover the whole level width (req 70). |

Each layer image is scaled so its height matches the visible area's height, keeping its proportions, and is anchored to the bottom of the screen.

### Level boundaries

- The level is exactly as wide and tall as the grid. The camera never shows outside it (req 67).
- The left and right edges of the level act as walls.
- The top edge is open: the player can jump above row 0.
- Falling below the bottom row is falling into a pit (req 26). A gap in the bottom row is a pit.

### Validation rules (summary for task 2.9)

Errors:
- missing required field, or a field of the wrong type;
- `formatVersion` is not `1`;
- `grid` is empty, or rows have different lengths;
- a grid character (other than `.`) is not in the legend;
- a legend key is not exactly one character, or is `.`;
- a legend entry has zero or more than one of `tile`, `playerStart`, `goal`, `enemy`, `object`, `reward`;
- not exactly one `playerStart` or exactly one `goal` in the grid;
- `enemy` names a character file that doesn't exist, or `object` names an object file that doesn't exist;
- `cutscene` names a cut scene file that doesn't exist;
- a layer `image` file doesn't exist;
- `scrollFactor` outside 0–1; a reward `value` that isn't a positive number; an invalid colour.

Warnings (shown, but do not block):
- a legend entry that isn't used in the grid.

## Level list format

**Location:** `data/levels/levels.json` (always this name).
**Requirements:** 54–55, 59.

```json
{
  "formatVersion": 1,
  "levels": ["level1", "level2"]
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `levels` | yes | array of strings, at least one | Level names (files in `data/levels/`), in play order. Start begins the first level (req 56); the last level offers only Exit game (req 58). |

Validation: each name must match an existing level file; a name must not appear twice; `levels` itself is not a valid level name.

## Character definition format

**Location:** `data/characters/<name>.json`. The player is always `data/characters/player.json`.
**Requirements:** 20–25, 38–40, 48–50, 73.

```json
{
  "formatVersion": 1,
  "kind": "player",
  "name": "Hero",
  "size": { "width": 0.8, "height": 1.4 },
  "health": 3,
  "speed": 6,
  "punchDamage": 1,
  "color": "#d2691e",
  "sprite": "player"
}
```

```json
{
  "formatVersion": 1,
  "kind": "enemy",
  "name": "Beetle",
  "size": { "width": 0.9, "height": 0.7 },
  "health": 1,
  "speed": 2,
  "color": "#5a2d82"
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `kind` | yes | `"player"` or `"enemy"` | What this character is. `player.json` must be `"player"`; every other file must be `"enemy"`. |
| `name` | yes | string | Display name (debug overlay, documentation). |
| `size` | yes | `{ width, height }`, in tiles, each > 0 | The collision box. |
| `health` | yes | whole number ≥ 1 | Starting health (reqs 24, 40). |
| `speed` | yes | number > 0, tiles/second | Player: running speed. Enemy: patrol speed. |
| `punchDamage` | player only; optional | whole number ≥ 1, default 1 | Health a punch removes from an enemy (req 40). Not allowed on enemies. |
| `color` | yes | colour | The shape colour, used when there is no sprite or the sprite is missing (reqs 76, 79). |
| `sprite` | no | string | Sprite sheet name in `data/sprites/`. |

**Animations.** When a character has a sprite, the engine plays the animation whose name matches the character's state: `idle`, `run`, `jump`, `fall`, `carry`, `punch`, `hurt`. Only `idle` is required in the sprite sheet. Any other missing animation falls back to `idle`, so the player sprite needs `idle` and `run` to meet req 78.

**Facing.** Sprites are drawn facing right and are flipped horizontally when the character faces left.

## Object definition format

**Location:** `data/objects/<name>.json`.
**Requirements:** 28–37, 73.

```json
{
  "formatVersion": 1,
  "name": "Crate",
  "size": { "width": 1, "height": 1 },
  "stackable": true,
  "color": "#a0522d"
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `name` | yes | string | Display name. |
| `size` | yes | `{ width, height }`, in tiles, each > 0 | The collision box. |
| `stackable` | no | boolean, default `false` | When `true`, the object at rest is a solid surface for other objects, the player, and enemies (req 35). |
| `color` | yes | colour | Shape colour. |
| `sprite` | no | string | Sprite sheet name in `data/sprites/`. Uses the `idle` animation. |

All objects can be picked up, dropped, and thrown in the prototype.

## Cut scene format

**Location:** `data/cutscenes/<name>.json`.
**Requirements:** 61–65.

```json
{
  "formatVersion": 1,
  "stage": { "width": 16, "height": 9 },
  "background": "images/cutscene-camp.png",
  "backgroundColor": "#000000",
  "actors": [
    {
      "character": "player",
      "keyframes": [
        { "time": 0, "x": -1, "y": 8, "animation": "run" },
        { "time": 3, "x": 7,  "y": 8, "animation": "idle" },
        { "time": 5, "x": 7,  "y": 8 }
      ]
    }
  ],
  "narration": [
    { "start": 0.5, "end": 3,   "text": "Our hero escapes the jungle edge..." },
    { "start": 3,   "end": 5.5, "text": "...and stops to catch their breath." }
  ]
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `stage` | yes | `{ width, height }`, in tiles, each > 0 | The cut scene's fixed-size stage. It is scaled to fit inside the window, keeping its proportions, and centred; extra space is filled with `backgroundColor` (req 65). |
| `background` | yes | image path | Background art, scaled to cover the stage exactly. |
| `backgroundColor` | yes | colour | Fills the window around the stage. |
| `actors` | yes | array (may be empty) | The animated action. |
| `actors[].character` | yes | string | A character definition name. Its size, colour, and sprite are used. |
| `actors[].facing` | no | `"left"` or `"right"`, default `"right"` | Which way the actor faces. |
| `actors[].keyframes` | yes | array, at least one | Where the actor is at given times. |
| `keyframes[].time` | yes | number ≥ 0, seconds | When the actor reaches this point. Each keyframe's time must be greater than the one before. |
| `keyframes[].x`, `keyframes[].y` | yes | numbers, tiles | Stage position of the actor's bottom-centre. (0, 0) is the stage's top-left corner. Values outside the stage are allowed, so actors can walk in from off-screen. |
| `keyframes[].animation` | no | string | Animation to play from this keyframe on. If missing, the previous animation continues (`idle` for the first keyframe). |
| `narration` | yes | array (may be empty) | Lines of narration text. |
| `narration[].start`, `narration[].end` | yes | numbers ≥ 0, seconds | When the line appears and disappears. `end` must be greater than `start`, and lines must be listed in order of `start`. |
| `narration[].text` | yes | string, not empty | The text shown. |

Timing rules:
- Between two keyframes, the actor moves in a straight line at an even speed. Before its first keyframe an actor is not shown; after its last keyframe it stays where it is.
- The cut scene ends at the latest of every actor's last keyframe time and every narration line's end (req 63). The player can skip at any time with confirm.

## Sprite sheet format

**Location:** `data/sprites/<name>.json`, normally with its image next to it, for example `data/sprites/player.png`.
**Requirements:** 39, 64, 76–80.

```json
{
  "formatVersion": 1,
  "image": "sprites/player.png",
  "frameWidth": 32,
  "frameHeight": 48,
  "pixelsPerTile": 32,
  "animations": {
    "idle": { "frames": [0, 1], "fps": 4 },
    "run":  { "frames": [2, 3, 4, 5], "fps": 10 },
    "jump": { "frames": [6], "fps": 1, "loop": false }
  }
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `image` | yes | image path | The sprite sheet image (PNG). |
| `frameWidth`, `frameHeight` | yes | whole numbers ≥ 1, **pixels** | Size of one frame in the image. This is the one place sizes are in pixels. |
| `pixelsPerTile` | yes | number > 0 | How many image pixels make one tile in the game. A 32 × 48 frame at 32 pixels per tile is drawn 1 tile wide and 1.5 tiles tall. |
| `animations` | yes | object, must include `idle` | Named animations. |
| `animations.<name>.frames` | yes | array of whole numbers ≥ 0, at least one | Frame numbers, played in order. |
| `animations.<name>.fps` | yes | number > 0 | Frames per second. |
| `animations.<name>.loop` | no | boolean, default `true` | `false` holds the last frame instead of starting over. |

**Frame numbering.** Frames are numbered from 0, left to right and then top to bottom, in a grid of `frameWidth` × `frameHeight` cells starting at the image's top-left corner.

**Placement.** The drawn frame's bottom-centre is placed at the bottom-centre of the entity's collision box, so a frame can be larger than the collision box. The punch reaches to the edge of the drawn frame on the side the player faces (req 39).

Validation: the image file must exist, and every frame number must fit inside the image. Checking frames needs the image's pixel size, which the validator's caller provides.

## Config files

### Tuning

**Location:** `data/config/tuning.json`. Gameplay physics values shared by all characters and objects (req 73). Values that differ per character (speed, health, punch damage) are in character definitions instead.

```json
{
  "formatVersion": 1,
  "gravity": 35,
  "maxFallSpeed": 20,
  "jumpSpeed": 14,
  "throwSpeed": { "x": 10, "y": 6 },
  "dropSpeed": { "x": 0, "y": 0 },
  "knockback": { "x": 6, "y": 6 },
  "invincibilitySeconds": 1,
  "stompBounceSpeed": 10,
  "punchSeconds": 0.15
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `gravity` | yes | number > 0, tiles/s² | Downward acceleration for everything that falls. |
| `maxFallSpeed` | yes | number > 0, tiles/s | Falling never gets faster than this. |
| `jumpSpeed` | yes | number > 0, tiles/s | The player's upward speed at the start of a jump (req 21). |
| `throwSpeed` | yes | `{ x, y }`, tiles/s, each ≥ 0 | A thrown object's starting speed: `x` forward in the facing direction, `y` upward (req 31). |
| `dropSpeed` | yes | `{ x, y }`, tiles/s, each ≥ 0 | A dropped object's starting speed, normally zero (req 32). |
| `knockback` | yes | `{ x, y }`, tiles/s, each ≥ 0 | Speed given to the player when damaged: `x` away from what hurt them, `y` upward (req 25). |
| `invincibilitySeconds` | yes | number ≥ 0 | How long after taking damage the player can't be damaged again (req 25). |
| `stompBounceSpeed` | yes | number > 0, tiles/s | The player's upward speed after stomping an enemy (req 52). |
| `punchSeconds` | yes | number > 0 | How long a punch's flash is shown. The hit itself happens once, on the press. |

In this file `y` means "upward", so every value is positive. (In world coordinates `y` increases downwards; the engine converts.)

### Bindings

**Location:** `data/config/bindings.json`. Keyboard and gamepad bindings for every input (reqs 14–18).

```json
{
  "formatVersion": 1,
  "keyboard": {
    "left":       ["ArrowLeft", "KeyA"],
    "right":      ["ArrowRight", "KeyD"],
    "up":         ["ArrowUp", "KeyW"],
    "down":       ["ArrowDown", "KeyS"],
    "jump":       ["Space", "ArrowUp", "KeyW"],
    "action":     ["KeyE", "KeyX"],
    "punch":      ["KeyQ", "KeyC"],
    "confirm":    ["Enter", "Space"],
    "fullscreen": ["F11"],
    "debug":      ["F3"]
  },
  "gamepad": {
    "left":    ["dpadLeft", "stickLeft"],
    "right":   ["dpadRight", "stickRight"],
    "up":      ["dpadUp", "stickUp"],
    "down":    ["dpadDown", "stickDown"],
    "jump":    ["a"],
    "action":  ["x"],
    "punch":   ["b"],
    "confirm": ["a"]
  }
}
```

- **Inputs.** `left`, `right`, `up`, `down`, `jump`, `action`, `punch`, and `confirm` make up the input state passed to the simulation (req 18). `fullscreen` and `debug` are keyboard-only and handled by the presentation layer. `up` and `down` move menu selections; drop is `down` + `action`.
- **Required.** Every input must be listed under `keyboard`. Every input except `fullscreen` and `debug` must be listed under `gamepad`. Each list must have at least one entry.
- **Keyboard names** are the browser's physical key codes (`KeyboardEvent.code`), for example `KeyA`, `ArrowLeft`, `Space`, `Enter`, `F3`. Because they name physical key positions, W/A/S/D stay in the same place on non-QWERTY keyboards.
- **Gamepad names** use the standard (Xbox-style) layout. Buttons: `a`, `b`, `x`, `y`, `lb`, `rb`, `lt`, `rt`, `back`, `start`, `ls`, `rs`, `dpadUp`, `dpadDown`, `dpadLeft`, `dpadRight`. Left-stick directions: `stickLeft`, `stickRight`, `stickUp`, `stickDown`.
- The same key or button may be bound to more than one input (for example `Space` is both `jump` and `confirm`). Which one applies depends on the screen.

### Display

**Location:** `data/config/display.json`.

```json
{
  "formatVersion": 1,
  "visibleHeight": 12,
  "stickDeadZone": 0.3
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `formatVersion` | yes | number | Always `1`. |
| `visibleHeight` | yes | number > 0, tiles | How much of the world is visible vertically. A wider window shows more horizontally (req 6). |
| `stickDeadZone` | yes | number ≥ 0 and < 1 | How far the analog stick must move (0 = centre, 1 = fully pushed) before it counts (req 16). |

## Schemas and the validator

Each format has a JSON Schema in `src/data/schemas/`:

| Format | Schema |
|---|---|
| Level | `level.schema.json` |
| Level list | `level-list.schema.json` |
| Character definition | `character.schema.json` |
| Object definition | `object.schema.json` |
| Cut scene | `cutscene.schema.json` |
| Sprite sheet | `sprite.schema.json` |
| Tuning | `tuning.schema.json` |
| Bindings | `bindings.schema.json` |
| Display | `display.schema.json` |

The schemas check each file's **structure**: fields, types, and ranges. Rules that span files or compare fields are custom checks in `src/data/validate.js`. Examples are row lengths, references to other files, exactly one player start, increasing times, `punchDamage` only on the player, and frame numbers fitting the image.

The game also validates data in the browser, where npm packages can't be loaded without a build step. The validator therefore uses its own small schema checker, and schemas may only use these JSON Schema keywords:

`$schema`, `$id`, `$ref` (only to `#/$defs/...`), `$defs`, `title`, `description`, `type`, `properties`, `required`, `additionalProperties`, `propertyNames`, `items`, `minItems`, `uniqueItems`, `enum`, `const`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `pattern`, `default`.

A unit test (`tests/data/schemas.test.js`) enforces this list.
