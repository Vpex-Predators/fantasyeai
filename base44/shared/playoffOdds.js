// Shared playoff-odds engine: a per-matchup win-probability model plus a
// 10,000-run Monte Carlo simulation of the remaining regular-season schedule.
// Powers getDashboardData, analyzeBriefing, the War Room threat board and the
// trade impact simulator.

function normalCdf(x) {
  // Abramowitz & Stegun 7.1.26 error-function approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

// Optional seeded PRNG is used only for matched-scenario Monte Carlo comparisons.
function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function scenarioSeed({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId }) {
  // This hash is for repeatable simulations, NEVER for cryptography.
  const snapshot = JSON.stringify([
    currentPeriod, regSeasonPeriods, myTeamId,
    teams.map(t => [t.id, t.wins, t.losses, t.ties || 0, t.pointsFor]),
    (schedule || []).map(m => [m.matchupPeriodId,
      m.home?.teamId, m.home?.totalPoints, m.away?.teamId, m.away?.totalPoints])
  ]);
  let hash = 2166136261;
  for (let i = 0; i < snapshot.length; i++) {
    hash ^= snapshot.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gauss(mean, std, random = Math.random) {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Acklam's inverse-normal approximation. Used to draw from a normal
// distribution conditional on the final score being >= already-scored points.
// This avoids impossible simulated totals lower than the current live score.
function inverseNormalCdf(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239];
  const b = [-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
  const c = [-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d = [0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
      ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log1p(-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
      ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
    (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

// A normal distribution bounded by the number of points already recorded.
// Used for the in-progress week only. Future weeks have no observed lower bound.
export function sampleMatchupPoints(profile, scored = 0, random = Math.random) {
  const mean = Number(profile?.mean);
  const std = Number(profile?.std);
  if (!Number.isFinite(mean) || !Number.isFinite(std) || std < 0) {
    throw new Error("Invalid scoring profile");
  }
  const floor = Number.isFinite(scored) ? Math.max(0, scored) : 0;
  if (std === 0) return Math.max(floor, mean, 0);
  // At a zero floor, use the original Gaussian draw, just exclude negative scores.
  if (floor === 0) return Math.max(0, gauss(mean, std, random));
  const cdfAtFloor = normalCdf((floor - mean) / std);
  if (cdfAtFloor >= 1 - 1e-12) return floor; // Extreme upper tail
  const u = Math.min(1 - Number.EPSILON,
    Math.max(Number.EPSILON, cdfAtFloor + (1 - cdfAtFloor) * random()));
  return Math.max(floor, mean + std * inverseNormalCdf(u));
}

function playOne(a, b, profiles, random = Math.random) {
  return gauss(profiles[a].mean, profiles[a].std, random) >= gauss(profiles[b].mean, profiles[b].std, random) ? a : b;
}

function playBracket(field, profiles, random = Math.random) {
  let round = field.slice();
  if (field.length === 6) {
    // Standard 6-team bracket: top two seeds bye, 3v6 and 4v5 in round one.
    const w45 = playOne(field[3], field[4], profiles, random);
    const w36 = playOne(field[2], field[5], profiles, random);
    round = [field[0], field[1], w45, w36];
  }
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < Math.floor(round.length / 2); i++) {
      next.push(playOne(round[i], round[round.length - 1 - i], profiles, random));
    }
    if (round.length % 2 === 1) next.push(round[Math.floor(round.length / 2)]);
    round = next;
  }
  return round[0];
}

// Per-team scoring profiles built from completed-week results.
export function buildProfiles({ teams, schedule, currentPeriod, gamesPlayed }) {
  const teamById = {};
  for (const t of teams) teamById[t.id] = { ...t, games: [] };

  const allScores = [];
  for (const m of schedule || []) {
    if (m.matchupPeriodId >= currentPeriod) continue;
    for (const side of [m.home || {}, m.away || {}]) {
      if (side.teamId == null) continue;
      const id = String(side.teamId);
      if (!(id in teamById)) continue;
      const pts = Number(side.totalPoints) || 0;
      teamById[id].games.push(pts);
      allScores.push(pts);
    }
  }

  const leagueMean = allScores.length ? allScores.reduce((s, p) => s + p, 0) / allScores.length : 90;
  const leagueStd = allScores.length > 1
    ? Math.max(6, Math.sqrt(allScores.reduce((s, p) => s + (p - leagueMean) ** 2, 0) / allScores.length))
    : 20;

  const profiles = {};
  for (const t of teams) {
    const pts = teamById[t.id].games;
    const mean = pts.length ? pts.reduce((s, p) => s + p, 0) / pts.length : (gamesPlayed ? t.pointsFor / gamesPlayed : leagueMean);
    const std = pts.length >= 3 ? Math.max(5, Math.sqrt(pts.reduce((s, p) => s + (p - mean) ** 2, 0) / pts.length)) : leagueStd;
    profiles[t.id] = { mean, std };
  }
  return { profiles, leagueMean, leagueStd };
}

// Chance team a outscores team b in a single meeting, from their profiles.
export function pairwiseWinProb(profiles, a, b) {
  return normalCdf((profiles[a].mean - profiles[b].mean) / Math.sqrt(profiles[a].std ** 2 + profiles[b].std ** 2));
}

export function computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, playoffTeamCount = 6, myTeamId, gamesPlayed, meanAdjust, forceMyWins = 0, randomSeed }) {
  if (!teams || !teams.length) return null;

  const teamById = {};
  for (const t of teams) teamById[t.id] = t;

  const { profiles } = buildProfiles({ teams, schedule, currentPeriod, gamesPlayed });
  const random = Number.isInteger(randomSeed) ? seededRng(randomSeed) : Math.random;
  // Trade simulator hook: shift a team's scoring mean by a lineup-level delta.
  if (meanAdjust) {
    for (const id of Object.keys(meanAdjust)) {
      if (profiles[id]) profiles[id].mean = Math.max(20, profiles[id].mean + meanAdjust[id]);
    }
  }

  const wp = (a, b) => normalCdf((profiles[a].mean - profiles[b].mean) / Math.sqrt(profiles[a].std ** 2 + profiles[b].std ** 2));

  const remaining = (schedule || [])
    .filter(m => m.matchupPeriodId >= currentPeriod && m.matchupPeriodId <= regSeasonPeriods)
    .sort((a, b) => a.matchupPeriodId - b.matchupPeriodId);

  // Win-probability model view of my remaining schedule.
  const mineRemaining = [];
  if (myTeamId && teamById[String(myTeamId)]) {
    const my = String(myTeamId);
    for (const m of remaining) {
      const home = String((m.home || {}).teamId ?? '');
      const away = String((m.away || {}).teamId ?? '');
      const oppId = home === my ? away : (away === my ? home : null);
      if (!oppId || !(oppId in teamById)) continue;
      const opp = teamById[oppId];
      const p = wp(my, oppId);
      mineRemaining.push({
        week: m.matchupPeriodId,
        opponent: { id: oppId, name: opp.name, wins: opp.wins, losses: opp.losses, avgPoints: Math.round(profiles[oppId].mean * 10) / 10 },
        winProb: Math.round(p * 100),
        grade: p >= 0.6 ? 'Favorable' : p <= 0.4 ? 'Tough' : 'Even'
      });
    }
    mineRemaining.sort((a, b) => a.week - b.week);
  }

  // Keep-ahead / trade analysis hook: my next N remaining games forced as wins.
  let forcedPeriods = new Set();
  if (myTeamId && forceMyWins > 0) {
    const my = String(myTeamId);
    forcedPeriods = new Set(remaining.filter(m => {
      const a = String((m.home || {}).teamId ?? '');
      const b = String((m.away || {}).teamId ?? '');
      return a === my || b === my;
    }).slice(0, forceMyWins));
  }

  // --- 10,000-run Monte Carlo: reduced sampling error, no new model assumptions. ---
  const sims = 10000;
  const count = Math.min(playoffTeamCount, teams.length);
  const baseWins = {}, basePts = {};
  const playoffCount = {}, titleCount = {}, winsSum = {}, rankCount = {};
  let liveWins = 0, liveGames = 0;
  for (const t of teams) {
    baseWins[t.id] = t.wins + 0.5 * (t.ties || 0);
    basePts[t.id] = t.pointsFor;
    playoffCount[t.id] = 0; titleCount[t.id] = 0; winsSum[t.id] = 0; rankCount[t.id] = {};
  }

  for (let s = 0; s < sims; s++) {
    const wins = { ...baseWins };
    const pts = { ...basePts };
    for (const m of remaining) {
      const a = String((m.home || {}).teamId ?? '');
      const b = String((m.away || {}).teamId ?? '');
      if (!(a in teamById) || !(b in teamById)) continue;
      const liveWeek = m.matchupPeriodId === currentPeriod;
      const observedA = liveWeek ? Math.max(0, Number((m.home || {}).totalPoints) || 0) : 0;
      const observedB = liveWeek ? Math.max(0, Number((m.away || {}).totalPoints) || 0) : 0;
      // ESPN's explicit settled winner indicates the current matchup is final.
      // A final score is known evidence, not a random variable to simulate.
      const finalResult = liveWeek && ["HOME", "AWAY", "TIE"].includes(String(m.winner || "").toUpperCase());
      // For a still-open matchup, condition the projected final score on live points.
      const sa = finalResult ? observedA : sampleMatchupPoints(profiles[a], observedA, random);
      const sb = finalResult ? observedB : sampleMatchupPoints(profiles[b], observedB, random);
      // pointsFor already includes in-progress current-week scoring. Replace
      // that week's actuals with the simulated full-week score so tiebreaks
      // don't double-count; future weeks still accumulate as simulated.
      if (m.matchupPeriodId === currentPeriod) {
        pts[a] += sa - observedA;
        pts[b] += sb - observedB;
      } else {
        pts[a] += sa;
        pts[b] += sb;
      }
      if (liveWeek && myTeamId && !forceMyWins) {
        const my = String(myTeamId);
        if (a === my || b === my) {
          liveGames++;
          if (sa === sb) liveWins += 0.5;
          else if ((a === my && sa > sb) || (b === my && sb > sa)) liveWins++;
        }
      }
      if (forcedPeriods.has(m)) {
        const my = String(myTeamId);
        if (a === my) wins[a] += 1; else wins[b] += 1;
      } else if (sa > sb) wins[a] += 1;
      else if (sb > sa) wins[b] += 1;
      else { wins[a] += 0.5; wins[b] += 0.5; }
    }
    const order = teams.map(t => t.id).sort((x, y) => (wins[y] - wins[x]) || (pts[y] - pts[x]));
    order.forEach((id, i) => {
      rankCount[id][i + 1] = (rankCount[id][i + 1] || 0) + 1;
      winsSum[id] += wins[id];
    });
    const field = order.slice(0, count);
    for (const id of field) playoffCount[id] += 1;
    titleCount[playBracket(field, profiles, random)] += 1;
  }

  let mine = null;
  if (myTeamId && teamById[String(myTeamId)]) {
    const myId = String(myTeamId);
    const seedDist = rankCount[myId] || {};
    let likelySeed = 1, best = 0;
    for (const key of Object.keys(seedDist)) {
      if (seedDist[key] > best) { best = seedDist[key]; likelySeed = Number(key); }
    }
    // Current-week win probability must reflect observed live scoring,
    // unlike future-week probabilities which remain analytical Gaussian estimates.
    if (!forceMyWins && liveGames > 0) {
      const current = mineRemaining.find(r => r.week === currentPeriod);
      if (current) {
        current.winProb = Math.round(100 * liveWins / liveGames);
        current.grade = current.winProb >= 60 ? "Favorable" : current.winProb <= 40 ? "Tough" : "Even";
      }
    }
    const currentWeek = mineRemaining.find(r => r.week === currentPeriod);
    mine = {
      id: myId,
      playoffPct: Math.round((playoffCount[myId] / sims) * 100),
      titlePct: Math.round((titleCount[myId] / sims) * 1000) / 10,
      likelySeed,
      currentWeekWinProb: currentWeek ? currentWeek.winProb : null,
      remaining: mineRemaining
    };
  }

  const race = teams.map(t => ({
    id: t.id, name: t.name, wins: t.wins, losses: t.losses, ties: t.ties || 0, pointsFor: t.pointsFor,
    avgPoints: Math.round(profiles[t.id].mean * 10) / 10,
    playoffPct: Math.round((playoffCount[t.id] / sims) * 100),
    titlePct: Math.round((titleCount[t.id] / sims) * 1000) / 10,
    avgWins: Math.round((winsSum[t.id] / sims) * 10) / 10
  })).sort((a, b) => (b.wins + b.ties * 0.5) - (a.wins + a.ties * 0.5) || b.playoffPct - a.playoffPct);

  return { sims, playoffTeamCount: count, race, mine };
}

// War Room threat board: ranks every opponent by how dangerous they are to my
// season, and computes what it takes on the win column to stay ahead of the top threat.
export function computeThreatBoard({ teams, schedule, currentPeriod, regSeasonPeriods, playoffTeamCount = 6, myTeamId, gamesPlayed }) {
  // Common random numbers reduce noise in differences between "what if" scenarios.
  // Force-winning more games cannot make the same simulated season less favorable.
  const seed = scenarioSeed({ teams, schedule, currentPeriod, regSeasonPeriods, myTeamId });
  const base = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, playoffTeamCount, myTeamId, gamesPlayed, randomSeed: seed });
  if (!base || !base.mine) return null;

  const myId = String(myTeamId);
  const myRace = base.race.find(t => t.id === myId);
  if (!myRace) return null;

  const { profiles } = buildProfiles({ teams, schedule, currentPeriod, gamesPlayed });

  const remaining = (schedule || []).filter(m => m.matchupPeriodId >= currentPeriod && m.matchupPeriodId <= regSeasonPeriods);
  const meetingsLeft = {};
  for (const m of remaining) {
    const a = String((m.home || {}).teamId ?? '');
    const b = String((m.away || {}).teamId ?? '');
    if (a === myId && b && b !== myId) meetingsLeft[b] = (meetingsLeft[b] || 0) + 1;
    else if (b === myId && a && a !== myId) meetingsLeft[a] = (meetingsLeft[a] || 0) + 1;
  }

  // Threat score: 45% simulated head-to-head edge + 35% their playoff odds + 20% their title odds.
  const threats = base.race
    .filter(t => t.id !== myId)
    .map(t => {
      const h2hPct = Math.round(pairwiseWinProb(profiles, t.id, myId) * 100);
      return {
        ...t,
        h2hPct,
        meetingsLeft: meetingsLeft[t.id] || 0,
        threatScore: Math.round(0.45 * h2hPct + 0.35 * t.playoffPct + 0.20 * Math.min(100, t.titlePct * 3))
      };
    })
    .sort((a, b) => b.threatScore - a.threatScore);

  const myGamesLeft = remaining.filter(m => {
    const a = String((m.home || {}).teamId ?? '');
    const b = String((m.away || {}).teamId ?? '');
    return a === myId || b === myId;
  }).length;

  const top = threats[0] || null;
  let winsNeeded = 0;
  if (top) winsNeeded = Math.min(myGamesLeft, Math.max(0, Math.ceil(top.avgWins - myRace.avgWins + 0.001)));

  const target = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, playoffTeamCount, myTeamId, gamesPlayed, forceMyWins: winsNeeded, randomSeed: seed });

  // My playoff odds as I stack up to four extra wins — the keep-ahead runway.
  const progression = [];
  const steps = Math.min(4, myGamesLeft);
  for (let n = 0; n <= steps; n++) {
    const o = computePlayoffOdds({ teams, schedule, currentPeriod, regSeasonPeriods, playoffTeamCount, myTeamId, gamesPlayed, forceMyWins: n, randomSeed: seed });
    progression.push({ wins: n, playoffPct: o.mine ? o.mine.playoffPct : null });
  }

  return {
    sims: base.sims,
    race: base.race,
    mine: base.mine,
    threats,
    keepAhead: {
      winsNeeded,
      gamesLeft: myGamesLeft,
      topThreat: top ? { id: top.id, name: top.name, avgWins: top.avgWins, playoffPct: top.playoffPct } : null,
      oddsAtTarget: target.mine ? target.mine.playoffPct : null,
      progression
    }
  };
}