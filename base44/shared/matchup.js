// ESPN schedule entries for a bye (odd leagues, and playoff byes for the top
// seeds) include only one side — usually `home`, with `away` omitted entirely.
// Reading `.away.teamId` throws, and treating the lone side as a finished
// game records a 0-point result.

export function sideTeamId(side) {
  if (!side || side.teamId == null) return null;
  return String(side.teamId);
}

// True only when both franchises are present. Byes are not games.
export function isHeadToHead(matchup) {
  if (!matchup) return false;
  return !!(sideTeamId(matchup.home) && sideTeamId(matchup.away));
}

// The other franchise in this matchup, or null when this is a bye / the
// team is not in the entry. Never touches a missing side.
export function matchupOpponentId(matchup, myId) {
  if (!matchup) return null;
  const homeId = sideTeamId(matchup.home);
  const awayId = sideTeamId(matchup.away);
  const me = String(myId);
  if (homeId === me) return awayId;
  if (awayId === me) return homeId;
  return null;
}
