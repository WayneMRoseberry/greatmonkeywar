// Loads all game data in the browser and validates it with the same rules as
// `npm run validate` (PRD requirement 85).
//
// A browser can't list the files in a folder, so loading starts from the
// required files (validate.js REQUIRED_FILES) and follows references between
// files: level list → levels → characters, objects, cut scenes, images →
// sprite sheets → sprite images. Files that nothing refers to are not loaded.
//
// loadGameData(options) resolves to
//   { ok, errors, warnings, data, images }
//   ok:     true if there are no errors
//   data:   parsed data grouped by kind (see validate.js)
//   images: { 'sprites/player.png': <loaded image>, ... } ready for drawing
// It never throws for bad or missing data; problems are reported in `errors`.

import { validateData, classifyFile, REQUIRED_FILES } from './validate.js';

const NAME = /^[A-Za-z0-9_-]+$/;
const IMAGE_PATH = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.(png|jpg|jpeg)$/;

/** Fetches a text file; resolves to null if it doesn't exist or can't be read. */
async function browserFetchText(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

/** Loads an image; resolves to { image, width, height }, or null if it can't be loaded. */
function browserLoadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** The data and image files that a parsed data file refers to. */
export function referencesOf(kind, value) {
  const json = [];
  const images = [];
  const name = (folder, n) => { if (typeof n === 'string' && NAME.test(n)) json.push(`${folder}/${n}.json`); };
  const image = (p) => { if (typeof p === 'string' && IMAGE_PATH.test(p)) images.push(p); };

  if (kind === 'level-list') {
    for (const level of value?.levels ?? []) name('levels', level);
  } else if (kind === 'level') {
    for (const entry of Object.values(value?.legend ?? {})) {
      name('characters', entry?.enemy);
      name('objects', entry?.object);
    }
    name('cutscenes', value?.cutscene);
    for (const layer of value?.background?.layers ?? []) image(layer?.image);
  } else if (kind === 'character' || kind === 'object') {
    name('sprites', value?.sprite);
  } else if (kind === 'cutscene') {
    for (const actor of value?.actors ?? []) name('characters', actor?.character);
    image(value?.background);
  } else if (kind === 'sprite') {
    image(value?.image);
  }
  return { json, images };
}

function tryParse(text) {
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return undefined; // validateData reports the syntax error.
  }
}

export async function loadGameData({
  baseUrl = 'data/',
  fetchText = browserFetchText,
  loadImage = browserLoadImage,
} = {}) {
  const files = {};
  const imageInfo = {};
  const images = {};
  const requested = new Set();

  // Load in waves: each wave fetches everything the previous wave referred to.
  let wave = [...REQUIRED_FILES];
  while (wave.length > 0) {
    const fresh = [...new Set(wave)].filter((p) => !requested.has(p));
    fresh.forEach((p) => requested.add(p));

    const results = await Promise.all(fresh.map(async (path) => {
      if (/\.json$/.test(path)) return { path, text: await fetchText(baseUrl + path) };
      return { path, loaded: await loadImage(baseUrl + path) };
    }));

    wave = [];
    for (const { path, text, loaded } of results) {
      if (text !== undefined) {
        if (text === null) continue; // Missing; validateData reports it if it matters.
        files[path] = text;
        const refs = referencesOf(classifyFile(path), tryParse(text));
        wave.push(...refs.json, ...refs.images);
      } else if (loaded) {
        imageInfo[path] = { width: loaded.width, height: loaded.height };
        images[path] = loaded.image;
      }
    }
  }

  const { errors, warnings, data } = validateData({ files, images: imageInfo });
  return { ok: errors.length === 0, errors, warnings, data, images };
}
