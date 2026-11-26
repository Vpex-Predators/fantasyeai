import { parseTeamRoster, round1, fetchPlayerNames, fetchSeasonTransactions } from './espnLeague.js';

const FAST_CLAIM_HOURS = 8;

// Statuses that mean the player is officially not playing this week.
const OUT_STATUSES = ['O', 'IR', 'INJURY_RESERVE', 'SUSPENSION', 'NFI', 'PUP', 'SSPD'];
const BENCH_SLOTS = [20, 21];

// Builds the League Pulse: season totals, a recent move log from ESPN's
// transaction feed, and pattern-detector flags for suspicious activity.
// Everything runs on real ESPN data only — flags are suspicions backed by
// numbers, never invented motives.
export async function buildLeaguePulse({ league, teams, season, leagueId, currentPeriod }) {
  const rawTeams = league.teams || [];
  const teamName = {};
  for (const t of teams) teamName[t.id] = t.name;

  const totals = {
    teams: teams.length,
    wins: teams.reduce((s, t) => s + t.wins, 0),
    losses: teams.reduce((s, t) => s + t.losses, 0),
    ties: teams.reduce((s, t) => s + (t.ties || 0), 0),
    pointsFor: round1(teams.reduce((s, t) => s + t.pointsFor, 0)),
    weeksPlayed: Math.max(0, currentPeriod - 1)
  };

  // Full season, not just the current week's feed.
  const seasonTxs = await fetchSeasonTransactions(season, leagueId, currentPeriod, league.transactions || []);
  const txs = seasonTxs
    .filter(t => (t.items || []).length && t.status !== 'CANCELED' && t.status !== 'FAILED_INVALIDPLAYERSOURCE')
    .sort((a, b) => (b.proposedDate || 0) - (a.proposedDate || 0));
  if (!txs.length) return { totals, moves: [], movesAvailable: false, flags: [], counts: { adds: 0, drops: 0, trades: 0, total: 0, weeks: currentPeriod } };

  // Season-wide counts (the move log itself is capped for display).
  const counts = { adds: 0, drops: 0, trades: 0, total: txs.length, weeks: currentPeriod };
  for (const t of txs) {
    const items = t.items || [];
    if (items.some(i => i.type === 'TRADE')) counts.trades += 1;
    counts.adds += items.filter(i => i.type === 'ADD').length;
    counts.drops += items.filter(i => i.type === 'DROP').length;
  }

  // Player index across every current roster: names, values, injury flags.
  const playerInfo = {};
  for (const raw of rawTeams) {
    for (const p of parseTeamRoster(raw, currentPeriod)) {
      if (!playerInfo[p.id]) playerInfo[p.id] = { ...p, teamId: String(raw.id) };
    }
  }

  // Transaction players who are no longer on any roster still deserve a name.
  const missing = [...new Set(txs.flatMap(t => (t.items || []).map(i => i.playerId)).filter(Boolean))]
    .map(String).filter(id => !playerInfo[id]);
  let extraNames = {};
  if (missing.length) {
    try { extraNames = await fetchPlayerNames(season, leagueId, missing); } catch (e) { /* names are optional */ }
  }
  const nameOf = id => {
    const key = String(id);
    return (playerInfo[key] && playerInfo[key].name) || extraNames[key] || null;
  };
  const valueOf = p => (p ? (p.seasonProj || p.seasonAvg || 0) : 0);

  // --- Recent move log ---
  const moves = [];
  for (const t of txs) {
    if (moves.length >= 12) break;
    const team = teamName[String(t.teamId)] || `Team ${t.teamId}`;
    const week = t.scoringPeriodId || null;
    const tradeItems = (t.items || []).filter(i => i.type === 'TRADE' && i.fromTeamId > 0 && i.toTeamId > 0);
    if (t.type === 'TRADE' || tradeItems.length) {
      if (!tradeItems.length) continue;
      const legs = [];
      for (const it of tradeItems) {
        const to = teamName[String(it.toTeamId)] || `Team ${it.toTeamId}`;
        legs.push(`${nameOf(it.playerId) || 'a player'} → ${to}`);
      }
      moves.push({
        week,
        kind: t.status === 'EXECUTED' ? 'trade' : 'trade_pending',
        team,
        text: `${legs.join(', ')}${t.status === 'EXECUTED' ? '' : ' (pending)'}`
      });
      continue;
    }
    if (t.type === 'ROSTER' && t.items.every(i => i.type === 'LINEUP')) {
      const benched = t.items.filter(i => BENCH_SLOTS.includes(i.toLineupSlotId)).length;
      moves.push({ week, kind: 'lineup', team, text: `${t.items.length - benched} into the lineup, ${benched} to the bench` });
      continue;
    }
    for (const it of t.items || []) {
      if (moves.length >= 12) break;
      if (it.type !== 'ADD' && it.type !== 'DROP') continue;
      const nm = nameOf(it.playerId) || 'a player';
      if (it.type === 'ADD') {
        moves.push({ week, kind: 'add', team, text: `added ${nm} ${t.type === 'WAIVER' ? 'off waivers' : 'from free agency'}` });
      } else {
        moves.push({ week, kind: 'drop', team, text: `dropped ${nm}` });
      }
    }
  }

  // --- Collusion radar: pattern detectors, every flag carries its numbers ---
  const flags = [];

  // 1) Repeat trade partners — worse when the same side "wins" every time.
  const pairTrades = {};
  for (const t of txs) {
    const items = (t.items || []).filter(i => i.type === 'TRADE' && i.fromTeamId > 0 && i.toTeamId > 0);
    if (t.status !== 'EXECUTED' || !items.length) continue;
    const key = [String(items[0].fromTeamId), String(items[0].toTeamId)].sort().join('|');
    (pairTrades[key] = pairTrades[key] || []).push(items);
  }
  for (const [key, list] of Object.entries(pairTrades)) {
    if (list.length < 2) continue;
    const [a, b] = key.split('|');
    let winner = null, gapTotal = 0, valueKnown = true;
    for (const items of list) {
      const val = { [a]: 0, [b]: 0 };
      for (const it of items) {
        const p = playerInfo[String(it.playerId)];
        if (!p) { valueKnown = false; continue; }
        val[String(it.toTeamId)] += valueOf(p);
      }
      const w = val[a] >= val[b] ? a : b;
      if (winner === null) winner = w; else if (winner !== w) winner = 'split';
      gapTotal += Math.abs(val[a] - val[b]);
    }
    if (valueKnown && winner && winner !== 'split' && gapTotal > 10) {
      flags.push({ kind: 'repeat_trades', quip: `${teamName[a]} and ${teamName[b]} have traded ${list.length} times, and ${teamName[winner]} took the higher combined projected value every single time (+${round1(gapTotal)} pts). Smells like a side deal.` });
    } else {
      flags.push({ kind: 'repeat_trades', quip: `${teamName[a]} and ${teamName[b]} have traded ${list.length} times already. That's a lot of paperwork between friends.` });
    }
  }

  // 2) Tanking: benched players who scored real points in completed weeks.
  const benchEvents = {};
  for (const t of txs) {
    if (t.type !== 'ROSTER') continue;
    for (const it of t.items || []) {
      if (it.type !== 'LINEUP') continue;
      if (it.fromLineupSlotId < 0 || BENCH_SLOTS.includes(it.fromLineupSlotId) || !BENCH_SLOTS.includes(it.toLineupSlotId)) continue;
      if ((t.scoringPeriodId || 0) >= currentPeriod) continue;
      const p = playerInfo[String(it.playerId)];
      if (!p) continue;
      const thatWeek = (p.trend || []).find(w => w.week === t.scoringPeriodId);
      const wasted = thatWeek ? thatWeek.points : 0;
      if (wasted >= 10) {
        const teamKey = String(t.teamId);
        (benchEvents[teamKey] = benchEvents[teamKey] || []).push({ week: t.scoringPeriodId, player: p.name, pts: wasted });
      }
    }
  }
  for (const [teamKey, events] of Object.entries(benchEvents)) {
    if (events.length < 2) continue;
    const worst = events.slice().sort((x, y) => y.pts - x.pts)[0];
    flags.push({ kind: 'tanking', quip: `${teamName[teamKey]} benched players who still scored in completed weeks — worst: ${worst.player} (${worst.pts} pts from the bench, wk ${worst.week}). Either brutal luck or someone's parking the bus.` });
  }

  // 2b) Tanking today: starting players who are officially out or on IR.
  const outStarters = {};
  for (const raw of rawTeams) {
    for (const p of parseTeamRoster(raw, currentPeriod)) {
      if (!p.isStarter || !OUT_STATUSES.includes((p.injuryStatus || '').toUpperCase())) continue;
      const teamKey = String(raw.id);
      (outStarters[teamKey] = outStarters[teamKey] || []).push(`${p.name} (${p.injuryStatus})`);
    }
  }
  for (const [teamKey, names] of Object.entries(outStarters)) {
    if (names.length < 2) continue;
    flags.push({ kind: 'tanking', quip: `${teamName[teamKey]} is starting ${names.length} players who are officially out or on IR: ${names.join(', ')}. Bold strategy — or a quiet tank.` });
  }

  // 3) Two teams repeatedly handing players to each other via the wire.
  const wireEvents = [];
  for (const t of txs) {
    for (const it of t.items || []) {
      if (it.type === 'DROP') wireEvents.push({ playerId: it.playerId, date: t.proposedDate || 0, team: String(it.fromTeamId), dir: -1 });
      if (it.type === 'ADD') wireEvents.push({ playerId: it.playerId, date: t.proposedDate || 0, team: String(it.toTeamId), dir: 1 });
    }
  }
  wireEvents.sort((a, b) => a.date - b.date);
  const pairEdges = {};
  const fastClaims = {};
  const addTeamsByPlayer = {};
  for (const pid of new Set(wireEvents.map(e => e.playerId))) {
    const evs = wireEvents.filter(e => e.playerId === pid);
    let lastDrop = null;
    for (const e of evs) {
      if (e.dir === -1) {
        lastDrop = e;
      } else {
        if (addTeamsByPlayer[pid]) addTeamsByPlayer[pid].add(e.team);
        else addTeamsByPlayer[pid] = new Set([e.team]);
        if (lastDrop && lastDrop.team !== e.team) {
          const key = [lastDrop.team, e.team].sort().join('|');
          (pairEdges[key] = pairEdges[key] || []).push(pid);
          const hrs = (e.date - lastDrop.date) / 3600000;
          if (lastDrop.date && hrs >= 0 && hrs < FAST_CLAIM_HOURS) {
            const fk = `${lastDrop.team}>${e.team}`;
            (fastClaims[fk] = fastClaims[fk] || []).push({ pid, hrs: round1(hrs) });
          }
          lastDrop = null;
        }
      }
    }
  }
  for (const [key, pids] of Object.entries(pairEdges)) {
    if (pids.length < 2) continue;
    const [a, b] = key.split('|');
    const named = pids.map(nameOf).filter(Boolean);
    const who = named.length ? ` (including ${named.slice(0, 2).join(' and ')})` : '';
    flags.push({ kind: 'churn', quip: `${teamName[a]} and ${teamName[b]} keep handing players back and forth — ${pids.length} drop-then-claim handoffs${who}. The league's most active carpool.` });
  }
  // Same player bouncing across many rosters = nobody trusts the hot potato.
  for (const [pid, teamSet] of Object.entries(addTeamsByPlayer)) {
    if (teamSet.size < 3) continue;
    const nm = nameOf(pid) || 'One player';
    flags.push({ kind: 'churn', quip: `${nm} has been picked up by ${teamSet.size} different teams already. The whole league keeps grabbing him and putting him right back down.` });
  }

  // 4) Fast claims: same team grabbing another team's drops within hours, repeatedly.
  for (const [fk, list] of Object.entries(fastClaims)) {
    if (list.length < 2) continue;
    const [from, to] = fk.split('>');
    const named = list.map(x => nameOf(x.pid)).filter(Boolean);
    const who = named.length ? ` (${named.slice(0, 2).join(', ')})` : '';
    const fastest = Math.min(...list.map(x => x.hrs));
    flags.push({ kind: 'fast_claim', quip: `${teamName[to] || `Team ${to}`} claimed ${list.length} of ${teamName[from] || `Team ${from}`}'s drops within ${FAST_CLAIM_HOURS} hours${who} — fastest ${fastest}h. Could be a sharp wire watcher, could be a heads-up.` });
  }

  return { totals, moves, movesAvailable: true, flags, counts };
}