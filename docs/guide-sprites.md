# Artist's Guide: Sprites and Animation

This guide shows you how to get animated art into Great Monkey War. You'll make an image and a small text file describing it. You don't need to write code. If you haven't used JSON before, read [Part 1 of the levels guide](guide-levels.md#part-1-json-in-five-minutes) first.

Until art is added, everything in the game is drawn as simple coloured shapes. You can replace any character or object with art, one at a time.

---

## How it works

A **sprite sheet** is a single image containing every frame of a character's animations, laid out in a grid. Next to it goes a description file saying how big each frame is and which frames make up each animation.

For a character called "player" you'd make:
- `data/sprites/player.png`: the image.
- `data/sprites/player.json`: the description.

Then you'd connect it to the character by adding `"sprite": "player"` to `data/characters/player.json` (see the [characters and objects guide](guide-characters-objects.md)).

---

## Making the image

- **Format:** PNG, with a transparent background.
- **Layout:** every frame is the same size, arranged in a grid starting at the top-left corner, with no gaps or borders between frames. Use as many rows and columns as you like.
- **Facing:** draw characters **facing right**. The game flips them when they face left.
- **Feet at the bottom:** the bottom-centre of each frame is where the character stands. Line up the feet at the bottom middle of every frame, or the character will appear to slide or float.

### Frame numbers

Frames are numbered from **0**, left to right, then top to bottom. For a sheet 4 frames wide and 2 frames tall:

```
+----+----+----+----+
|  0 |  1 |  2 |  3 |
+----+----+----+----+
|  4 |  5 |  6 |  7 |
+----+----+----+----+
```

---

## The description file

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

| Field | Needed? | What it means |
|---|---|---|
| `formatVersion` | Yes | Always `1`. |
| `image` | Yes | Where the image is, inside the `data` folder. `"sprites/player.png"` means `data/sprites/player.png`. |
| `frameWidth`, `frameHeight` | Yes | The size of **one frame**, in pixels. |
| `pixelsPerTile` | Yes | How many pixels of your art make one square of the game world (one **tile**). See below. |
| `animations` | Yes | The animations, each with a name. Must include `idle`. |

Each animation has:

| Field | Needed? | What it means |
|---|---|---|
| `frames` | Yes | The frame numbers to play, in order. A frame can be used more than once, for example `[0, 1, 2, 1]`. |
| `fps` | Yes | Frames per second: how fast the animation plays. `10` is a lively run; `4` is a gentle idle. |
| `loop` | Optional | `true` (the default) starts the animation over when it ends. `false` stops on the last frame, which is good for jumps. |

---

## How big the art appears in the game

The game scales to any window size, so art is sized in **tiles**, not screen pixels. One tile is one square of a level's grid.

`pixelsPerTile` sets the scale. With `"pixelsPerTile": 32`:
- a 32 × 48 pixel frame is drawn 1 tile wide and 1.5 tiles tall;
- a 64 × 64 pixel frame is drawn 2 tiles wide and 2 tiles tall.

Pick one `pixelsPerTile` value for all the art in the game, so everything matches. Because the game scales freely, art may be drawn larger or smaller than its real size, so it shouldn't rely on being shown at exactly one size.

### Art and the character's size

Each character also has a `size` in its character file. That's the box used for bumping into things. The art is drawn with its bottom-centre at the bottom-centre of that box, and it can be bigger than the box. For example, a hero with a wide stance or long arms can be drawn wider than their bumping box.

**The punch reaches to the edge of the hero's art.** If the hero's frames are wider than their `size`, their punch reaches further. If they have no art, the punch only reaches enemies that are touching them.

---

## Animation names the game uses

The game picks an animation by name, based on what the character is doing:

| Name | When it plays |
|---|---|
| `idle` | Standing still. **Required.** |
| `run` | Moving along the ground. |
| `jump` | Going up. |
| `fall` | Coming down. |
| `carry` | Holding an object. |
| `punch` | Punching. |
| `hurt` | Just been hit. |

Only `idle` is required. Any animation you haven't made yet shows `idle` instead, so you can add them one at a time. The prototype hero needs at least `idle` and `run`.

Objects use only `idle`. Cut scenes can use any animation name that's in the sprite sheet (see the [cut scenes guide](guide-cutscenes.md)).

---

## Background, cut scene, and start screen pictures

Background layers, cut scene backgrounds, and the start screen background are ordinary pictures, not sprite sheets, so they don't need a description file:

- Put them in `data/images/`. PNG or JPG are both fine.
- **Background layers** are scaled to the height of the screen and repeat sideways, so make them tall enough to look sharp and with left and right edges that join up seamlessly. Use transparency in all but the farthest layer so the layers behind show through.
- **Cut scene backgrounds** fill the cut scene's stage, so make them the same shape as the stage (for example 16:9).
- **The start screen background** is set by `"startBackground"` in `data/config/display.json` (for example `"images/start-screen.png"`). It covers the whole window; on a window that isn't 16:9 its edges are cut off, so keep anything important away from the edges. The game's name is drawn in white about a third of the way down, and the menu just below the middle, so keep those areas fairly plain and dark enough for white text to stand out.

### What size to make them

A background layer is always drawn **exactly as tall as the game window**, in real screen pixels, whatever size you make it. The game shows 12 tiles from top to bottom, so on a full HD screen (1920 × 1080) the window is 1080 pixels tall and each tile is 90 pixels.

| Picture | Recommended size | Why |
|---|---|---|
| Background layer | **1080 pixels tall**, at least **1920 wide**; **3840 wide** (or more) for near layers | 1080 tall looks sharp on a full HD screen. At 1920 wide, one copy covers a 16:9 screen, so it repeats once per screen. Near layers scroll fastest, so make them wider and the repeat is harder to notice. |
| Background layer, sharp on 4K screens | 2160 pixels tall, twice the widths above | Only if you want 4K screens to look as crisp as full HD. Files get about four times bigger. |
| Cut scene background | **1920 × 1080** (for a 16:9 stage) | The stage fills a full HD screen. Use the same shape as the stage in your cut scene file. |
| Start screen background | **1920 × 1080** | It covers a full HD window exactly. |

Things to know:

- **Any size works; it just gets stretched or squashed to fit.** A picture shorter than the window is enlarged and looks soft; the placeholder art (512 × 256 layers, a 320 × 180 cut scene picture) is enlarged about four times at full HD, which is why it looks blurry. A picture taller than the window is shrunk, which looks fine but makes files bigger than they need to be.
- **The shape is kept.** A layer is never stretched sideways. A 3840 × 1080 layer always shows twice as wide as it is tall.
- **A layer's width sets how often it repeats.** A 1920 × 1080 layer covers one 16:9 screen before repeating; a 3840 × 1080 layer covers two. A layer narrower than the screen repeats more than once across it.
- **The bottom of each layer sits at the bottom of the screen**, behind the level's ground. In the prototype levels the ground is the bottom 2 of the 12 tiles (180 pixels of a 1080-pixel layer), so whatever you draw there is mostly hidden. Put the parts you want seen higher up.
- **Wider screens show more.** On an ultrawide (21:9) screen, a 1080-pixel-tall window is about 2520 pixels wide, so a 1920-wide layer repeats partly on screen. That's fine if the edges join up seamlessly.

## Sound and video

The prototype has no sound yet. When it does, use **Ogg** or **Opus** for audio and **WebM** for video (not MP3, AAC, or MP4).

---

## Checking your work

Check your sprite sheet the same way as a level: see [Checking your work](guide-levels.md#part-5-checking-your-work). Then see it animate in the game: see [Seeing your change in the game](guide-levels.md#seeing-your-change-in-the-game). Common messages:

| Message mentions… | Likely cause |
|---|---|
| "uses frame 9, but the image only has 8 frames" | An animation uses a frame number past the end of the sheet. Remember frames start at 0. |
| "bigger than the whole image" | `frameWidth` or `frameHeight` is larger than the image. Check the numbers against your art. |
| "\"idle\" is missing from animations" | Every sprite sheet needs an `idle` animation. |
| "there is no file data/sprites/…png" | The `image` path doesn't match the image file. Check the spelling and that it ends in `.png`. |
