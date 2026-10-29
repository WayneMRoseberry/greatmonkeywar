# Sound Guide: Music and Sound Effects

This guide is for **sound designers** making music and sound effects, and for **level designers** choosing which sounds play where. You don't need to write code: sounds are files in the `data` folder, and short JSON files say where each one plays. If you haven't used JSON before, read [Part 1 of the levels guide](guide-levels.md#part-1-json-in-five-minutes) first.

---

## What sound the game has

- **Music** on the start screen, during each level, and during each cut scene. Music loops: when it reaches its end, it starts again.
- A **level-complete jingle**: a short piece that can play once when a level is completed.
- **Sound effects** when things happen: jumping, landing, punching, picking things up, collecting a reward, moving through a menu, and so on (the full list is [below](#sound-effects)).
- **Cut scene sounds**: sounds placed at set times in a cut scene, for example a crash timed to the action.

Players can turn all sound off and on with the **M** key; "Sound off" shows in the top-right corner while it's off.

The game comes with simple **placeholder** sounds (beeps and tones) so everything can be heard and tested. They are meant to be replaced.

---

## Part 1: Making sound files

### Format

- Save sounds as **Ogg Vorbis** (`.ogg`) or **Opus** (`.opus`). These are open formats with no licence fees. **MP3, WAV, and AAC are not accepted**: the data check reports them.
- **Mono** is fine for sound effects. Music can be mono or stereo.
- Use a sample rate of **44,100** or **48,000 Hz**.

### Exporting from Audacity

[Audacity](https://www.audacityteam.org/) is free and exports both formats:

1. **File → Export Audio…** (in older versions, **File → Export → Export as OGG**).
2. Choose **Ogg Vorbis Files** as the type (recent versions also offer **Opus Files**).
3. A **quality** of about 5 is plenty for the game; higher makes bigger files.

Most other audio editors and music tools can export Ogg Vorbis too. Look for "Ogg" or "Vorbis" in the export options.

### Where files go

- Music: `data/audio/music/`, for example `data/audio/music/jungle-theme.ogg`.
- Sound effects: `data/audio/sounds/`, for example `data/audio/sounds/hero-jump.ogg`.
- File names may use letters, numbers, `-`, and `_`. No spaces.

**Don't overwrite the placeholder files with real ones.** The placeholders can be regenerated (`npm run sounds`), which writes over files with the placeholder names, such as `audio/sounds/jump.ogg`. Give your sounds their own names (`hero-jump.ogg`), and point the JSON at them (Part 2).

### Music that loops

- Music plays round and round, so **the end must join the start smoothly**. Listen to the join by looping the file in your editor.
- Don't fade the music out at the end, and don't leave silence at the start or the end: either one leaves a gap at every loop.
- To avoid a click at the join, start and end the file at a quiet point (where the waveform crosses the middle line).
- The **level-complete jingle** plays once and doesn't loop, so it can end however you like. Keep it short: 1 to 3 seconds.

### Sound effects

- **Keep them short.** Most should be under half a second. Long effects pile up when an event happens often (like jumping).
- **Trim the silence at the start.** Any silence before the sound makes it feel late.
- An effect can play while the same effect is still playing (two quick jumps). Each plays in full; they overlap.

### Loudness

- Keep loudness **consistent** between files, so no sound jumps out. Normalising every file to the same peak level (for example −3 dB) is a good start.
- Make music a little quieter than the effects, so the effects can be heard over it.
- The game has no volume settings, so the levels in the files are the levels players hear.

---

## Part 2: Choosing which sounds play

Sound paths are written the same way as picture paths: from inside the `data` folder, with the extension. `"audio/music/jungle-theme.ogg"` means the file `data/audio/music/jungle-theme.ogg`.

Anything you leave out is silent: you can add sounds one at a time.

### The start screen and sound effects: `data/config/audio.json`

```json
{
  "formatVersion": 1,
  "startMusic": "audio/music/title-theme.ogg",
  "sounds": {
    "jump": "audio/sounds/hero-jump.ogg",
    "land": "audio/sounds/hero-land.ogg",
    "collectReward": "audio/sounds/coin.ogg"
  }
}
```

- `startMusic` plays on the start screen.
- `sounds` gives a sound to each **sound event** you list, by its name. Events you don't list are silent.

#### Sound effects

These are the event names you can use in `sounds`. Spell them exactly as shown, including the capital letters.

| Event | When it plays |
|---|---|
| `jump` | The player jumps (not when walking off a ledge). |
| `land` | The player comes down onto something solid after a jump or a fall. Not at the start of a level. |
| `punch` | The player punches, whether or not it hits anything. |
| `pickUp` | The player picks up an object. |
| `drop` | The player puts down an object they are carrying. |
| `throw` | The player throws an object. |
| `stomp` | The player defeats an enemy by landing on it. |
| `enemyDefeated` | An enemy is defeated by a punch or a thrown object. |
| `playerHurt` | The player loses health, from an enemy or by falling into a pit. |
| `playerDefeated` | The player's last health is lost and the level restarts. Plays instead of `playerHurt`. |
| `collectReward` | The player collects a reward. |
| `reachGoal` | The player reaches the goal at the end of a level. |
| `menuMove` | The player moves the selection in a menu. |
| `menuChoose` | The player chooses a menu option. |

If the same thing happens several times at once, such as collecting two rewards in the same instant, its sound plays once.

### A level's music: in the level file

Add these to a level file in `data/levels/`:

```json
"music": "audio/music/jungle-theme.ogg",
"completeJingle": "audio/music/level-done.ogg"
```

- `music` plays while the level is played. It keeps going if the player loses all their health and the level restarts.
- `completeJingle` (optional) plays once when the player reaches the goal, in place of the music. Without it, the level's music keeps playing under the level-complete panel. Choose for each level: a fanfare for a big level, or keep the music going for a quick one.
- If the next level uses the **same music file**, the music carries on without starting over.

**Tip:** `reachGoal` (a sound effect) and `completeJingle` both start the moment the player reaches the goal. If most of your levels have jingles, leave `reachGoal` out of `audio.json`, or keep it very short, so the two don't clash.

### A cut scene's music and sounds: in the cut scene file

Add these to a cut scene file in `data/cutscenes/` (see the [cut scenes guide](guide-cutscenes.md)):

```json
"music": "audio/music/campfire.ogg",
"sounds": [
  { "time": 4, "sound": "audio/sounds/crash.ogg" },
  { "time": 6.5, "sound": "audio/sounds/shout.ogg" }
]
```

- `music` plays while the cut scene shows, and stops when it ends or the player skips it.
- Each entry in `sounds` plays once, `time` seconds after the cut scene starts. Use the same times as the keyframes and narration to line sounds up with the action.
- List sounds in time order. Two sounds may have the same time.
- Sounds don't make the scene longer: a sound timed after the scene has ended never plays, and neither does one the player skips past.

---

## Part 3: Checking your work

Check your files the same way as a level: see [Checking your work](guide-levels.md#part-5-checking-your-work). Common messages:

| Message mentions… | Likely cause |
|---|---|
| "which is not a sound file path … ending in .ogg or .opus" | The path ends in `.mp3` or `.wav`, has no extension, or has a space in it. Export as Ogg Vorbis or Opus, and check the spelling. |
| "but there is no file data/audio/…" | The path doesn't match a file. Check the folder, the spelling, the capital letters, and the extension. |
| "is not a field that belongs here" (in `sounds`) | An event name is misspelled. The message lists the right names. |
| "Sounds must be listed in time order" | A cut scene's `sounds` are out of order. Sort them by `time`. |

### Hearing it in the game

- Start the game (see [Seeing your change in the game](guide-levels.md#seeing-your-change-in-the-game)).
- **In a web browser, sound stays off until you press a key or click.** Browsers do this to every page. Then the current screen's music starts. The Steam version doesn't need this.
- Press **F3** to show the debug overlay: its `Music:` line shows which music file is playing, and `Sound:` shows whether sound is `on`, `muted`, or `locked` (waiting for that first key press).
- If a file is found but can't be played (for example it's damaged, or not really Ogg Vorbis or Opus inside), the game carries on without it and writes a warning in the browser's developer console (F12), naming the file.
