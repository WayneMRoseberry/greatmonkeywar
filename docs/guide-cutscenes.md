# Designer's Guide: Cut Scenes

A **cut scene** is a short scene that plays between levels. It has a background picture, characters that move and animate, and lines of narration text. This guide shows you how to write one. If you haven't used JSON before, read [Part 1 of the levels guide](guide-levels.md#part-1-json-in-five-minutes) first.

---

## Where cut scenes go

- Cut scene files live in `data/cutscenes/`, for example `data/cutscenes/after-level1.json`.
- A level plays a cut scene by naming it: add `"cutscene": "after-level1"` to the level file. The cut scene plays after the player finishes that level and chooses **Next level**.
- Players can skip a cut scene at any time by pressing confirm (Enter, Space, or the A button).

---

## An example

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

What happens: the hero runs in from off the left edge of the screen, reaching the middle after 3 seconds, then stands still. Meanwhile two lines of narration appear one after the other. The scene ends at 5.5 seconds, when the last line disappears.

---

## The stage

```json
"stage": { "width": 16, "height": 9 },
"background": "images/cutscene-camp.png",
"backgroundColor": "#000000",
```

- The **stage** is the area the scene happens in, measured in **tiles** (the same size as the squares in a level). `16` by `9` is a wide-screen shape.
- The stage is scaled up or down to fit the player's window, keeping its shape. If the window is a different shape, the space around the stage is filled with `backgroundColor`.
- `background` is the picture that fills the stage. It's a path inside the `data` folder, for example `"images/cutscene-camp.png"` for the file `data/images/cutscene-camp.png`. Ask your artist to make it the same shape as the stage (16:9 here) so it doesn't look stretched.

### Positions on the stage

- `x` is how far across from the **left** edge, in tiles.
- `y` is how far down from the **top** edge, in tiles.
- So on a 16 × 9 stage, `"x": 0, "y": 0` is the top-left corner and `"x": 16, "y": 9` is the bottom-right.
- An actor's position is the point **between its feet**. To stand an actor on the bottom of the stage, use the stage's height as `y` (`"y": 9`), or a little less if the background has ground drawn above the bottom edge.
- Positions can be off the stage (for example `"x": -1`), so actors can walk in from off screen.

---

## Actors

Each actor is a character that appears in the scene.

| Field | Needed? | What it does |
|---|---|---|
| `character` | Yes | Which character this is: the name of a file in `data/characters/`, for example `"player"` or `"beetle"`. The actor uses that character's size, colour, and art. |
| `facing` | Optional | `"left"` or `"right"` (the default). |
| `keyframes` | Yes | Where the actor is at different times (see below). |

### Keyframes: moving actors

A **keyframe** says "at this time, the actor is here". Between keyframes, the actor glides in a straight line at a steady speed.

| Field | Needed? | What it does |
|---|---|---|
| `time` | Yes | The time in seconds from the start of the scene. Each keyframe must be **later** than the one before it. |
| `x`, `y` | Yes | Where the actor is at that time. |
| `animation` | Optional | Which animation to play from this keyframe on, for example `"run"` or `"idle"`. If left out, the actor keeps playing its current animation (or `"idle"` at the start). The names come from the character's [sprite sheet](guide-sprites.md). |

Things to know:
- An actor doesn't appear until its first keyframe's time.
- After its last keyframe, an actor stays where it is until the scene ends.
- To make an actor stand still for a while, use two keyframes with the same position at different times.
- If you name an animation that the character's art doesn't have, you get a warning and the actor shows its `"idle"` animation instead.

---

## Narration

Narration is text that appears on screen to tell the story.

| Field | Needed? | What it does |
|---|---|---|
| `start` | Yes | When the line appears, in seconds. |
| `end` | Yes | When it disappears. Must be later than `start`. |
| `text` | Yes | The words shown. |

- List lines in the order they start.
- Give players time to read: about 3 seconds for a short sentence.
- Lines can overlap in time, but they're easier to read if they don't.

---

## When the scene ends

The scene ends when the last thing in it finishes: the latest keyframe of any actor, or the end of the last narration line, whichever is later. The next level then starts.

---

## Checking your work

Check your cut scene the same way as a level: see [Checking your work](guide-levels.md#part-5-checking-your-work). Common messages:

| Message mentions… | Likely cause |
|---|---|
| "must be later than the keyframe before it" | Keyframe times must go up: 0, then 3, then 5. |
| "must be listed in time order" | Narration lines are out of order. Sort them by `start`. |
| "\"end\" … must be later than \"start\"" | A narration line ends before (or as) it starts. |
| "there is no file data/characters/…" | An actor's `character` doesn't match a character file. |
| "there is no file data/images/…" | The `background` path doesn't match a picture. Check the folder and the file's extension (`.png` or `.jpg`). |
