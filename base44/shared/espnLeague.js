import { secrets } from 'base44:runtime';

export const DEFAULT_LEAGUE_ID = '1435304362';

export function defaultSeason() {
  const now = new Date();
  // NFL season year: from August onward the new season is underway
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export async function espnFetch(url, extraHeaders = {}) {
  const espnS2 = secrets.get('ESPN_S2');
  const swid = secrets.get('ESPN_SWID');
  if (!espnS2 || !swid) {
    throw new Error('ESPN cookies are not configured on the server (ESPN_S2 / ESPN_SWID secrets).');
  }
  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://fantasy.espn.com/',
      ...extraHeaders
    }
  });
  if (!res.ok) {
    let msg = `ESPN returned an error (${res.status}).`;
    if (res.status === 401 || res.status === 403) {
      msg = 'ESPN rejected the stored cookies. Refresh the ESPN_S2 and ESPN_SWID secrets with fresh values from fantasy.espn.com.';
    } else if (res.status === 404) {
      msg = 'League not found on ESPN. Double-check the league ID and season year.';
    }
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// Short-lived shared cache: dashboard, war room and waiver scans inside the
// same minute reuse one ESPN response instead of re-fetching the whole league.
const CACHE_TTL_MS = 60 * 1000;
const espnCache = new Map();

export async function fetchLeague(season, leagueId, views) {
  const key = `league|${season}|${leagueId}|${views.join(',')}`;
  const cached = espnCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=${views.join('&view=')}`;
  const data = await espnFetch(url);
  const league = (data.leagues && data.leagues[0]) || ((data.teams || data.settings || data.id) ? data : null);
  if (!league) throw new Error('ESPN responded, but no league data was returned.');
  espnCache.set(key, { at: Date.now(), data: league });
  return league;
}

// The league lives under the season ESPN currently serves it for — if the
// rollover hasn't happened yet, the previous season still holds the data.
export async function fetchLeagueCurrent(views, leagueId = DEFAULT_LEAGUE_ID) {
  const seasons = [defaultSeason(), defaultSeason() - 1];
  let lastError = null;
  for (const season of seasons) {
    try {
      const league = await fetchLeague(season, leagueId, views);
      return { league, season };
    } catch (e) {
      if (e && e.status === 404) { lastError = e; continue; }
      throw e;
    }
  }
  throw lastError || new Error('League not found on ESPN.');
}

export const SLOT_LABELS = { 0: 'QB', 2: 'RB', 3: 'RB/WR', 4: 'WR', 5: 'WR/TE', 6: 'TE', 7: 'OP', 16: 'DST', 17: 'K', 20: 'BE', 21: 'IR', 23: 'FLEX' };
export const BENCH_SLOTS = [20, 21];
export const POSITION_BY_ID = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
const SLOT_ONLY_LABELS = new Set(['BE', 'IR', 'FLEX', 'FLX', 'OP', 'RB/WR', 'WR/TE']);
export const INJURY_LABELS = {
  QUESTIONABLE: 'questionable', Q: 'questionable',
  OUT: 'out', O: 'out',
  DOUBTFUL: 'doubtful', D: 'doubtful',
  INJURY_RESERVE: 'on IR', IR: 'on IR', PUP: 'on IR', NFI: 'on IR',
  SUSPENSION: 'suspended', SSPD: 'suspended', SSD: 'suspended'
};

// ESPN slot labels (BE / FLEX / OP) are not real positions — use defaultPosition.
export function realPos(p) {
  const raw = (p && p.realPosition) || (p && !SLOT_ONLY_LABELS.has(p.position) ? p.position : '') || '';
  const key = String(raw).toUpperCase().replace('/', '');
  return key === 'DST' || key === 'D ST' ? 'DST' : key;
}

export function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

export function statValue(player, sourceId, periodId) {
  const stats = player && Array.isArray(player.stats) ? player.stats : [];
  const entry = stats.find(s => s.statSourceId === sourceId && s.scoringPeriodId === periodId);
  return entry ? (entry.appliedTotal ?? 0) : 0;
}

// Free agents on the league wire — ESPN requires the X-Fantasy-Filter header for this view.
export async function fetchFreeAgents(season, leagueId, currentPeriod, limit = 50) {
  const faFilter = JSON.stringify({
    players: {
      limit,
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
      filterStatus: { value: ['FREEAGENT', 'WAIVERS'] }
    }
  });
  const cacheKey = `fa|${season}|${leagueId}|${currentPeriod}|${limit}`;
  const cached = espnCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const data = await espnFetch(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=kona_player_info&scoringPeriodId=${currentPeriod}`,
    { 'X-Fantasy-Filter': faFilter }
  );
  // These entries carry the player directly on `player` (no playerPoolEntry wrapper).
  const parsed = ((data.players || []).map(entry => {
    const player = (entry.playerPoolEntry && entry.playerPoolEntry.player) || entry.player || {};
    return {
      id: String(player.id ?? ''),
      name: player.fullName || 'Unknown',
      position: POSITION_BY_ID[player.defaultPositionId] || player.defaultPosition || '',
      injuryStatus: player.injuryStatus || 'ACTIVE',
      percentOwned: (player.ownership && player.ownership.percentOwned) || (entry.playerPoolEntry && entry.playerPoolEntry.percentOwned) || 0,
      seasonProj: round1(statValue(player, 1, 0) || statValue(player, 0, 0)),
      weeklyProj: round1(statValue(player, 1, currentPeriod))
    };
  }).filter(p => p.id));
  espnCache.set(cacheKey, { at: Date.now(), data: parsed });
  return parsed;
}

// Every transaction of the season: ESPN's mTransactions2 view only returns the
// requested scoring period, so query weeks 1..currentPeriod and dedupe by id.
export async function fetchSeasonTransactions(season, leagueId, currentPeriod, seed = []) {
  const periods = Array.from({ length: Math.max(1, currentPeriod) }, (_, i) => i + 1);
  const perWeek = await Promise.all(periods.map(async period => {
    const cacheKey = `tx|${season}|${leagueId}|${period}`;
    const cached = espnCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
    try {
      const data = await espnFetch(
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTransactions2&scoringPeriodId=${period}`
      );
      const list = data.transactions || (data.leagues && data.leagues[0] && data.leagues[0].transactions) || [];
      espnCache.set(cacheKey, { at: Date.now(), data: list });
      return list;
    } catch (e) {
      return []; // one missing week must not sink the whole scan
    }
  }));
  const byId = new Map();
  for (const t of [...seed, ...perWeek.flat()]) {
    const key = t.id || `${t.teamId}|${t.proposedDate}|${t.type}`;
    if (!byId.has(key)) byId.set(key, t);
  }
  return [...byId.values()];
}

// Display names for a small set of player ids — transaction history often
// references players no longer on any roster. Best effort; callers catch.
export async function fetchPlayerNames(season, leagueId, ids) {
  if (!ids || !ids.length) return {};
  const bounded = ids.slice(0, 50).map(String);
  const cacheKey = `names|${season}|${leagueId}|${bounded.join(',')}`;
  const cached = espnCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  const filter = JSON.stringify({ players: { filterIds: { value: bounded } } });
  const data = await espnFetch(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=kona_player_info`,
    { 'X-Fantasy-Filter': filter }
  );
  const names = {};
  for (const entry of (data.players || [])) {
    const player = (entry.playerPoolEntry && entry.playerPoolEntry.player) || entry.player || {};
    if (player.id) names[String(player.id)] = player.fullName || 'Unknown';
  }
  espnCache.set(cacheKey, { at: Date.now(), data: names });
  return names;
}

// Actual points for the current scoring period — present once the player's game
// has kicked off (live or final); null before it. Totals "lock in" on these.
export function livePointsFor(player, period) {
  const stats = (player && Array.isArray(player.stats)) ? player.stats : [];
  const entry = stats.find(s => s.statSourceId === 0 && s.scoringPeriodId === period && s.appliedTotal != null);
  return entry ? round1(entry.appliedTotal) : null;
}

export function weeklyTrend(player, maxPeriod) {
  const actuals = (player && Array.isArray(player.stats) ? player.stats : [])
    .filter(s => s.statSourceId === 0 && s.scoringPeriodId > 0 && s.scoringPeriodId <= maxPeriod)
    .sort((a, b) => a.scoringPeriodId - b.scoringPeriodId)
    .map(s => ({ week: s.scoringPeriodId, points: round1(s.appliedTotal) }));
  return actuals;
}

export function parseTeamSummary(t) {
  const overall = (t.record && t.record.overall) || {};
  return {
    id: String(t.id),
    name: [t.location, t.nickname].filter(Boolean).join(' ') || t.name || `Team ${t.id}`,
    wins: overall.wins ?? 0,
    losses: overall.losses ?? 0,
    ties: overall.ties ?? 0,
    pointsFor: round1(overall.pointsFor),
    pointsAgainst: round1(overall.pointsAgainst)
  };
}

export function parseRosterPlayer(entry, currentPeriod) {
  const player = (entry.playerPoolEntry && entry.playerPoolEntry.player) || {};
  const slot = entry.lineupSlotId;
  const actuals = weeklyTrend(player, currentPeriod);
  const seasonActual = statValue(player, 0, 0);
  return {
    id: String(player.id ?? ''),
    name: player.fullName || 'Unknown player',
    position: SLOT_LABELS[slot] || player.defaultPosition || 'Player',
    realPosition: POSITION_BY_ID[player.defaultPositionId] || player.defaultPosition || '',
    slot,
    isStarter: !BENCH_SLOTS.includes(slot),
    injuryStatus: player.injuryStatus || 'ACTIVE',
    livePoints: livePointsFor(player, currentPeriod),
    weeklyProj: round1(statValue(player, 1, currentPeriod)),
    seasonProj: round1(statValue(player, 1, 0) || seasonActual),
    seasonActual: round1(seasonActual),
    seasonAvg: actuals.length > 0 ? round1(seasonActual / actuals.length) : 0,
    trend: actuals.slice(-3)
  };
}

// Current matchup period + regular-season length, derived from the live league payload.
export function leaguePeriods(league) {
  return {
    currentPeriod: (league.status && (league.status.currentMatchupPeriod || league.status.latestScoringPeriod)) || 1,
    regSeasonPeriods: (league.settings && league.settings.scheduleSettings && league.settings.scheduleSettings.regSeasonMatchupPeriodCount) || 14
  };
}

// Full parsed roster (starters + bench) for one raw ESPN team.
export function parseTeamRoster(rawTeam, currentPeriod) {
  return ((rawTeam && rawTeam.roster && rawTeam.roster.entries) || []).map(e => parseRosterPlayer(e, currentPeriod));
}

export const PLAYBOOK_MODEL = 'Weighted decision model — apply to every call: Projections 30% + Matchup 25% + Injury risk 20% + Recent form (last 3 games) 15% + Schedule strength 10% = weighted edge in fantasy points. Confidence: HIGH if edge > 15 points, MEDIUM if edge > 5 points, LOW otherwise. Also weigh the player\'s QB situation and their history with their QB (target share, chemistry, recent game logs together).';