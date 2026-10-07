# Designer's Guide: Characters and Objects

This guide shows you how to create and tune the hero, enemies, and the objects the hero can pick up. If you haven't used JSON before, read [Part 1 of the levels guide](guide-levels.md#part-1-json-in-five-minutes) first.

---

## Characters

Characters are the hero and the enemies. Each has its own file in `data/characters/`.

- The hero is always `data/characters/player.json`.
- Each enemy type has its own file, for example `data/characters/beetle.json`. The file name (without `.json`) is the name you use in a level's legend: `"e": { "enemy": "beetle" }`.

### The hero

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

### An enemy

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

### What each field means

| Field | Needed? | What it does |
|---|---|---|
| `formatVersion` | Yes | Always `1`. |
| `kind` | Yes | `"player"` for the hero (only in `player.json`); `"enemy"` for everything else. |
| `name` | Yes | A display name, used in the debug screen. |
| `size` | Yes | How big the character is for bumping into things, in **tiles**. One tile is one square of the level grid. `{ "width": 0.8, "height": 1.4 }` is a little narrower than a tile and almost one and a half tiles tall. |
| `health` | Yes | How many hits the character can take. A whole number, at least 1. |
| `speed` | Yes | How fast it moves, in tiles per second. For the hero, this is running speed; for an enemy, its walking (patrol) speed. |
| `punchDamage` | Hero only, optional | How much health one punch takes off an enemy. Leave it out for 1. Enemies can't have this. |
| `color` | Yes | The character's colour when it's drawn as a simple shape. Also used if its art is missing. See [colours](guide-levels.md#colours). |
| `sprite` | Optional | The character's animated art: the name of a sprite sheet in `data/sprites/`. Leave it out to draw the character as a coloured shape. See the [sprites guide](guide-sprites.md). |

### How health and damage work

- The hero loses 1 health when an enemy touches them, or when they fall into a pit. At 0 health, the level restarts.
- A **punch** takes `punchDamage` off an enemy's `health`. An enemy with `"health": 2` and a hero with `"punchDamage": 1` needs two punches.
- **Jumping on** an enemy, or hitting it with a **thrown object**, defeats it straight away, whatever its health.

### Tuning tips

- To make an enemy tougher, raise its `health`.
- To make the hero faster, raise their `speed`. Try small steps: `6` to `7`.
- Making a character bigger than the gaps in your levels can block it from getting through. Check your levels after changing `size`.
- How high the hero jumps, how strong gravity is, and how far things are thrown are shared by everyone. They're set in `data/config/tuning.json` (ask a developer before changing these).

---

## Objects

Objects are things the hero can **pick up, carry, drop, and throw**, such as crates and coconuts. Each kind of object has its own file in `data/objects/`, for example `data/objects/crate.json`. The file name is the name you use in a level's legend: `"c": { "object": "crate" }`.

```json
{
  "formatVersion": 1,
  "name": "Crate",
  "size": { "width": 1, "height": 1 },
  "stackable": true,
  "color": "#a0522d"
}
```

| Field | Needed? | What it does |
|---|---|---|
| `formatVersion` | Yes | Always `1`. |
| `name` | Yes | A display name. |
| `size` | Yes | Its size in tiles. |
| `stackable` | Optional | `true` means the object can be stacked: things can rest on top of it, and the hero and enemies can stand and walk on it. Players can use stackable objects to build stairs and platforms. Leave it out (or use `false`) for objects like coconuts that can't be stood on. |
| `color` | Yes | Its colour when drawn as a simple shape. |
| `sprite` | Optional | Art for the object: the name of a sprite sheet in `data/sprites/`. |

### Things to know about objects

- Thrown objects defeat any enemy they hit, then fall to the ground so they can be picked up again.
- If the hero picks up a crate that has other crates on top of it, the ones on top fall.
- The hero can't pick up the crate they're standing on.
- Enemies treat the edge of a stack like the edge of a platform, and turn around.

---

## Checking your work

After changing a character or object, check your work the same way as for levels: see [Checking your work](guide-levels.md#part-5-checking-your-work). Common messages:

| Message mentions… | Likely cause |
|---|---|
| "should be a whole number" | `health` and `punchDamage` must be whole numbers, like `2`, not `2.5` or `"2"`. |
| "is only for the player" | `punchDamage` is in an enemy file. Remove it. |
| "there is no file data/characters/…" | A level uses an enemy name with no matching file. Check the spelling. |
| "there is no file data/sprites/…" | The `sprite` name doesn't match a sprite sheet. |
