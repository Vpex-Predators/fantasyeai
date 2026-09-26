// Roster `position` is the ESPN lineup slot (QB, FLEX, BE, IR). Every bench
// player is slot BE and every IR player is slot IR, so comparing slots can
// never find a backup for an injured starter. Decisions use the real NFL
// position, and only players who can actually play this week count.

const OUT_FOR_WEEK = new Set(['O', 'OUT', 'IR', 'INJURY_RESERVE', 'SUSPENSION', 'PUP', 'NFI', 'SSPD']);
const IR_SLOT = 21;

export function rosterPosition(player) {
  return String((player && (player.realPosition || player.position)) || '');
}

export function canBackupThisWeek(player) {
  if (!player || player.slot === IR_SLOT) return false;
  return !OUT_FOR_WEEK.has(String(player.injuryStatus || '').toUpperCase());
}

// True when someone on the bench plays the starter's real position and is
// not already ruled out or sitting in the IR slot.
export function hasPositionalBackup(starter, bench) {
  const pos = rosterPosition(starter);
  if (!pos) return false;
  return (bench || []).some(player => canBackupThisWeek(player) && rosterPosition(player) === pos);
}
