// Starting Steam (tasks 8.5, 8.6; PRD reqs 8-10). The steamworks.js module is
// passed in (null if it failed to load), so tests use a fake.

import { SteamStatus } from '../src/platform/platform.js';

/** Valve's public test app ID (Spacewar), used during development (req 8). */
export const STEAM_APP_ID = 480;

const UNKNOWN_NAME = '(unknown)';

/** The reason logged when the steamworks.js module couldn't be loaded. */
export const STEAMWORKS_NOT_LOADED = 'the steamworks.js module could not be loaded';

/** The message logged when Steam connects as `userName`. */
export const steamConnectedMessage = (userName) => `Steam connected (app ID ${STEAM_APP_ID}) as ${userName}.`;

/** The message logged when Steam is unavailable, giving the reason (req 9). */
export const steamUnavailableMessage = (reason) =>
  `Steam is unavailable (${reason}); the game runs without Steam. Is Steam running?`;

/**
 * Starts Steam and returns { status, userName } for the platform. If Steam
 * isn't running, start-up fails, or the module couldn't load, it logs a clear
 * message and returns Steam as unavailable; it never throws, so the game
 * always starts (req 9).
 */
export function startSteam(steamworks, log) {
  try {
    if (!steamworks) throw new Error(STEAMWORKS_NOT_LOADED);
    const client = steamworks.init(STEAM_APP_ID);
    let userName;
    try {
      userName = client.localplayer.getName();
    } catch {
      userName = UNKNOWN_NAME;
    }
    log(steamConnectedMessage(userName));
    return { status: SteamStatus.CONNECTED, userName };
  } catch (error) {
    log(steamUnavailableMessage(error.message));
    return { status: SteamStatus.UNAVAILABLE, userName: null };
  }
}
