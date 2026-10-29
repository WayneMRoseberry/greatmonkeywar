// Rewards: items such as bananas that the player collects (PRD reqs 42-43).
//
// A reward is a plain { x, y, width, height, value, color } box, in tiles. It
// never changes: collecting one removes it from state.rewards.
//
// collectRewards changes `state`, which must be step()'s fresh copy of the
// previous state, never a state someone else still holds.

import { overlapsBox } from './collision.js';
import { SoundEvent } from './constants.js';

/**
 * The reward placed in grid cell (column, row), from its legend entry's
 * `reward` part ({ value, color }). Its box is the whole cell, and it is worth
 * 1 if the legend gives no value (docs/data-formats.md).
 */
export function rewardInCell(column, row, reward) {
  return { x: column, y: row, width: 1, height: 1, value: reward.value ?? 1, color: reward.color };
}

/**
 * Collecting rewards (req 43): each reward the player overlaps (sharing an
 * edge isn't enough) disappears, and its value is added to the reward count.
 * Only the player collects: objects, held or not, pass through rewards.
 */
export function collectRewards(state) {
  const { player } = state;
  const kept = [];
  for (const reward of state.rewards) {
    if (overlapsBox(player, reward)) {
      state.rewardCount += reward.value;
      state.events.push(SoundEvent.COLLECT_REWARD);
    } else {
      kept.push(reward);
    }
  }
  state.rewards = kept;
}
