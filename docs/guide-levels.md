# Level Designer's Guide: Building Levels

This guide shows you how to build and change levels for Great Monkey War. You don't need to know how to program. Levels are plain text files that you edit in a text editor.

**Other guides:**
- [Characters and objects](guide-characters-objects.md): enemies, the hero, crates, and coconuts.
- [Cut scenes](guide-cutscenes.md): the short scenes between levels.
- [Sprites](guide-sprites.md): for artists adding animated art.

---

## Part 1: JSON in five minutes

All game data files are written in a format called **JSON**. It looks strange at first, but it only has a few rules.

### What JSON looks like

```json
{
  "name": "Jungle Edge",
  "health": 3,
  "stackable": true,
  "grid": ["....", "####"],
  "size": { "width": 1, "height": 1 }
}
```

A JSON file is a list of **fields**. Each field has a **name** in quotes, a colon `:`, and a **value**:

```
"health": 3
```

### The kinds of values

| Kind | Looks like | Example |
|---|---|---|
| Text | Inside double quotes `" "` | `"Jungle Edge"` |
| Number | Digits, with an optional decimal point. No quotes. | `3`, `0.5`, `-1` |
| Yes / no | The words `true` or `false`. No quotes. | `true` |
| List | Square brackets `[ ]`, items separated by commas | `["level1", "level2"]` |
| Group of fields | Curly braces `{ }`, fields separated by commas | `{ "width": 1, "height": 1 }` |

### The rules that trip people up

1. **Commas go *between* items, never after the last one.**
   ```
   { "width": 1, "height": 1 }      ← correct
   { "width": 1, "height": 1, }     ← wrong: comma after the last item
   { "width": 1 "height": 1 }       ← wrong: missing comma
   ```
2. **Use straight double quotes `"`.** Not single quotes `'`, and not the curly quotes `“ ”` that word processors make. Edit files in a code editor such as VS Code, not in Word.
3. **Every `{` needs a matching `}`, and every `[` needs a matching `]`.**
4. **Names are case-sensitive.** `"color"` and `"Color"` are different. Field names in our files are spelled the American way: `color`, not `colour`.
5. **There are no comments.** You can't write notes inside a JSON file.
6. **Numbers and `true`/`false` have no quotes.** `"health": "3"` is wrong; `"health": 3` is right.

Don't worry about getting it perfect: the game checks every file and tells you, in plain words, what's wrong and where (see [Part 5](#part-5-checking-your-work)).

---

## Part 2: How a level works

A level is **drawn as text**. Each line of text is one row of the level, and each character is one square, called a **tile**. A **legend** says what each character means.

Here is a small, complete level:

```json
{
  "formatVersion": 1,
  "name": "Jungle Edge",
  "grid": [
    "..............................",
    "......................bbb.....",
    "..................======......",
    ".........#####...........c....",
    "..P.......e.........c....c...G",
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

Reading the grid, you can see:
- The hero `P` starts on the left, standing on ground `#`.
- A beetle `e` patrols the ground.
- There are pits: gaps in the bottom rows, such as columns 7–10. Falling in costs the hero 1 health.
- A raised block of ground `#####` to jump onto, and a green platform `======` higher up.
- Bananas `b` above the platform.
- Crates `c` to pick up, throw, or stack. The two crates on the right are stacked.
- The goal flag `G` at the far right.

### What each part means

| Part | What it does |
|---|---|
| `"formatVersion": 1` | Always exactly this. It tells the game which version of the level format the file uses. |
| `"name"` | The level's name, shown to players. |
| `"grid"` | The level itself: a list of rows, top row first. **Every row must be the same length.** |
| `"legend"` | What each character in the grid means. |
| `"background"` | The sky colour and the scrolling background pictures. |
| `"cutscene"` | *Optional.* The cut scene that plays after this level, when the player chooses Next level. Leave it out for no cut scene. |

### Where level files go

Level files live in `data/levels/`, for example `data/levels/level1.json`. The file name (without `.json`) is the level's **name** that other files use to refer to it.

---

## Part 3: The grid and the legend

### The dot

`.` always means **empty space**. You never put it in the legend.

### Legend entries

Every other character you use in the grid needs a legend entry. Pick any character except `.` or a space. Letters are case-sensitive, so `c` and `C` are different. Each entry is **exactly one** of these:

| Entry | What it places | Example |
|---|---|---|
| Tile | A square of ground, wall, or platform. `"solid": true` means things can't pass through it. | `"#": { "tile": { "solid": true, "color": "#6b4f2a" } }` |
| Player start | Where the hero starts, and where they come back after falling in a pit. **Exactly one per level.** | `"P": { "playerStart": true }` |
| Goal | Touching it finishes the level. Needs a colour. **Exactly one per level.** | `"G": { "goal": true, "color": "#ff3030" }` |
| Enemy | An enemy. The name refers to a file in `data/characters/`. It starts walking left. Add `"facing": "right"` to start it walking right instead. | `"e": { "enemy": "beetle" }` or `"r": { "enemy": "beetle", "facing": "right" }` |
| Object | Something the hero can pick up and throw. The name refers to a file in `data/objects/`. | `"c": { "object": "crate" }` |
| Reward | A collectable, such as a banana. `value` is how many points it's worth (leave it out for 1). | `"b": { "reward": { "value": 1, "color": "#ffe135" } }` |

### Colours

Colours are written as `"#"` followed by six letters and numbers, for example `"#6b4f2a"`. Each pair says how much red, green, and blue to use. Most design tools and colour pickers show colours in this form (sometimes called "hex"). Search for "colour picker" online to find one.

### Placing things

- **Things stand on the tile below them.** To put an enemy on the ground, put its letter in the row just above a `#`. If there's nothing below, it falls when the level starts.
- **Big things grow upwards.** The hero is taller than one tile. Put `P` in the row above the ground, and the hero stands on the ground with their head poking into the row above.
- **Stacking:** put crates one above the other in the grid, and they start as a stack. (Only objects marked "stackable" stack; see the [characters and objects guide](guide-characters-objects.md).)
- **Carrying needs headroom.** The hero carries an object above their head, and the object bumps into things just as the hero does. To carry an object through a gap, the gap must be at least as tall as the hero plus the object. For example, with the hero (1.4 tiles tall) and crate (1 tile tall) from the [characters and objects guide](guide-characters-objects.md), the hero needs a gap of 3 rows to carry a crate through. (A gap of 2 rows is 2 tiles, which is less than 2.4.) The hero also can't pick an object up where there's no room above their head, such as in a low tunnel or right up against a wall when the object is wider than the hero. Use this on purpose, for example a low tunnel the hero must cross without the crate.
- **Pits:** leave a gap in the bottom rows. Falling off the bottom of the level is falling into a pit.
- **Edges:** the left and right edges of the level act as walls. The top is open, so the hero can jump above the top row.

---

## Part 4: The background

```json
"background": {
  "color": "#87ceeb",
  "layers": [
    { "image": "images/jungle-far.png",  "scrollFactor": 0.1 },
    { "image": "images/jungle-mid.png",  "scrollFactor": 0.4 },
    { "image": "images/jungle-near.png", "scrollFactor": 0.7 }
  ]
}
```

- `"color"` fills the sky behind everything.
- `"layers"` are pictures that scroll at different speeds to give a feeling of depth (called **parallax**). **List the farthest layer first.**
- `"image"` is the picture's location inside the `data` folder, for example `"images/jungle-far.png"` for the file `data/images/jungle-far.png`.
- `"scrollFactor"` is how fast the layer moves, from `0` (never moves, like distant mountains) to `1` (moves with the level). Far layers use small numbers; near layers use bigger ones.
- Each layer repeats sideways to cover the whole level. To stop a layer repeating, add `"repeat": false`.
- Each layer picture is scaled to the height of the screen and sits at the bottom.
- The prototype levels use at least three layers.
- For what size to make the pictures, see [What size to make them](guide-sprites.md#what-size-to-make-them) in the sprites guide.

---

## Part 5: Checking your work

The game checks every data file and explains any problem in plain words: which file, where in the file, and what's wrong. For example:

```
levels/level1.json: row 7 has 58 tiles but row 1 has 60. All rows must be the same length.
levels/level1.json: the character "x" (at row 3, column 12) is not in the legend. Add it to "legend", or replace it with "." for empty space.
```

There are three ways to see these messages:

1. **Run the check yourself.** In a terminal in the project folder, type `npm run validate`. (A developer can set up your computer for this; see the [developer guide](developer-guide.md).)
2. **When you commit.** Saving your work to Git runs the check automatically. If there's a problem, the commit is stopped and the problems are listed.
3. **In the game.** If a data file has a problem, the game shows the messages on screen instead of starting.

**Warnings** are messages that don't stop anything, such as a legend entry you didn't use. They're there to help you tidy up.

### Seeing your change in the game

Once the check passes, play the game to see your change. The first time, a developer needs to set up your computer (see the [developer guide](developer-guide.md#setup)); after that:

1. Open a terminal in the project folder and type `npm run web`. Leave that terminal open while you play.
2. Open <http://localhost:8765> in Chrome or Edge.
3. Press **Enter** (or click **Start**) to start level 1.
4. After each change to a file, save it and press **F5** in the browser. The game starts again from the start screen with your change.

When you're finished, go back to the terminal and press **Ctrl+C** to stop it.

Tips:

- **To reach level 2 or a cut scene**, play through level 1; the cut scene plays when you choose **Next level**. To get there faster while testing, you can temporarily put your level first in `data/levels/levels.json`. Remember to put the order back.
- **Press F3** to show the debug overlay. It shows the hero's position in tiles, which helps when you place things on the grid.
- **If the screen lists problems instead of the start screen**, the check failed; fix what it lists, save, and press F5.
- **The desktop version** (`npm start`) shows the same thing. It doesn't reload, so close its window and run `npm start` again after each change.

### Help from your editor (optional)

If you use VS Code, add this line at the top of a level file, just after the first `{`:

```json
"$schema": "../../src/data/schemas/level.schema.json",
```

VS Code will then underline mistakes as you type and suggest field names. The game ignores this line.

---

## Common mistakes

| Message mentions… | Likely cause |
|---|---|
| "not valid JSON" | A missing or extra comma, quote mark, or bracket near the line it names. See [Part 1](#the-rules-that-trip-people-up). |
| "row N has … tiles but row 1 has …" | A row is longer or shorter than the first row. Pad with `.` so every row is the same length. |
| "is not in the legend" | You used a character in the grid that has no legend entry, or a typo (for example `O` instead of `o`). |
| "the level has no player start" / "has 2 goals" | Each level needs exactly one `P`-type and one `G`-type character. |
| "the player ... doesn't fit at the start" | The hero is bigger than the space around the start. The hero stands on the bottom of the start's square and is about 1½ tiles tall, so leave open space above the start, and beside it if the hero is wide. |
| "the enemy ... doesn't fit there" | An enemy is bigger than the space where you placed it. It stands on the bottom of its square, so leave open space above it if it is tall, and beside it if it is wide. The message gives the row and column of the enemy and of the tile in the way. |
| "the object ... doesn't fit there" | The same, for an object such as a crate or plank that is bigger than the space where you placed it. Leave open space above a tall object and beside a wide one. |
| "... would overlap each other" | Two objects are placed so close that they overlap, for example a plank wider than one tile right next to a crate. Leave an empty square between them, or make one smaller. Objects that only touch, such as crates stacked one on another, are fine. |
| "is not a field that belongs here" | A field name is misspelled, for example `"colour"` instead of `"color"`. |
| "there is no file data/…" | A name or image path doesn't match a real file. Check the spelling, and that names don't include `.json`. |

---

## Adding a new level

1. Copy an existing level file in `data/levels/` and rename the copy, for example `level3.json`. Use only letters, numbers, `-`, and `_` in file names.
2. Edit the grid, legend, and background.
3. Add the level to the level list, `data/levels/levels.json`, in the order players should meet it:
   ```json
   {
     "formatVersion": 1,
     "levels": ["level1", "level2", "level3"]
   }
   ```
4. Check your work ([Part 5](#part-5-checking-your-work)).
