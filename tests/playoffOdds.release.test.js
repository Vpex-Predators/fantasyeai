import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfiles, pairwiseWinProb, computePlayoffOdds, computeThreatBoard, sampleMatchupPoints } from '../base44/shared/playoffOdds.js';

// Seeded randomness is confined to the tests; the production algorithm remains unchanged.
function withSeed(seed, fn) {
  const old = Math.random;
  let state = seed >>> 0;
  Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  try { return fn(); } finally { Math.random = old; }
}

function fixture(currentA = 20) {
  const ids = ['A', 'B', 'C', 'D'];
  const teams = ids.map(id => ({
    id, name: id, wins: 0, losses: 1, ties: 0,
    pointsFor: 100 + (id === 'A' ? currentA : 0)
  }));
  const schedule = [
    { matchupPeriodId: 1, home: { teamId: 'A', totalPoints: 100 }, away: { teamId: 'C', totalPoints: 100 } },
    { matchupPeriodId: 1, home: { teamId: 'B', totalPoints: 100 }, away: { teamId: 'D', totalPoints: 100 } },
    { matchupPeriodId: 2, home: { teamId: 'A', totalPoints: currentA }, away: { teamId: 'C', totalPoints: 0 } },
    { matchupPeriodId: 2, home: { teamId: 'B', totalPoints: 0 }, away: { teamId: 'D', totalPoints: 0 } },
  ];
  return { teams, schedule, currentPeriod: 2, regSeasonPeriods: 2, playoffTeamCount: 1, myTeamId: 'A', gamesPlayed: 1 };
}

test('exclude in-progress current-week totals from completed-week team scoring profiles', () => {
  const a = buildProfiles(fixture(20));
  const b = buildProfiles(fixture(120));
  assert.deepEqual(a, b);
  assert.equal(a.profiles.A.mean, 100);
});

test('normalized head-to-head odds are symmetric and reward higher mean at equal variance', () => {
  const profiles = { A: { mean: 110, std: 17 }, B: { mean: 100, std: 17 } };
  const p = pairwiseWinProb(profiles, 'A', 'B');
  assert.ok(p > 0.5 && p < 1);
  assert.ok(Math.abs(p + pairwiseWinProb(profiles, 'B', 'A') - 1) < 1e-9);
});

test('current-week projections never go below points already scored', () => {
  const profile = { mean: 95, std: 20 };
  for (const floor of [1, 15, 90, 115, 175]) {
    let state = 37;
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    for (let i = 0; i < 1200; i++) {
      const score = sampleMatchupPoints(profile, floor, random);
      assert.ok(Number.isFinite(score) && score >= floor, "must respect observed partial score");
    }
  }
});

test('more points actually observed increase live-week win odds, holding opponent constant', () => {
  const early = withSeed(20261024, () => computePlayoffOdds(fixture(20)));
  const later = withSeed(20261024, () => computePlayoffOdds(fixture(135)));
  assert.ok(later.mine.currentWeekWinProb > early.mine.currentWeekWinProb,
    `expected live-scoring evidence to improve win forecast: early=${early.mine.currentWeekWinProb}, later=${later.mine.currentWeekWinProb}`);
  assert.equal(later.mine.currentWeekWinProb, later.mine.remaining[0].winProb);
});

test('playoff odds remain bounded and results repeat under identical scenario and seed', () => {
  const a = withSeed(42, () => computePlayoffOdds(fixture(20)));
  const b = withSeed(42, () => computePlayoffOdds(fixture(20)));
  assert.deepEqual(a, b);
  assert.equal(a.sims, 10000);
  for (const team of a.race) {
    assert.ok(team.playoffPct >= 0 && team.playoffPct <= 100);
    assert.ok(team.titlePct >= 0 && team.titlePct <= 100);
    assert.ok(Number.isFinite(team.avgWins));
  }
});

test('balanced teams have approximately 50% win probability after 10,000 draws', () => {
  let state = 845771;
  const rng = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const same = { mean: 100, std: 20 };
  let wins = 0;
  for (let i = 0; i < 10000; i++) {
    const a = sampleMatchupPoints(same, 0, rng);
    const b = sampleMatchupPoints(same, 0, rng);
    wins += a > b ? 1 : a === b ? 0.5 : 0;
  }
  assert.ok(Math.abs(wins / 10000 - 0.5) < 0.025);
});

test('matched-seed what-if simulation never lowers playoff odds for extra forced wins', () => {
  const input = fixture(30);
  input.regSeasonPeriods = 4;
  input.playoffTeamCount = 2;
  input.schedule.push(
    { matchupPeriodId: 3, home: { teamId: 'A', totalPoints: 0 }, away: { teamId: 'B', totalPoints: 0 } },
    { matchupPeriodId: 3, home: { teamId: 'C', totalPoints: 0 }, away: { teamId: 'D', totalPoints: 0 } },
    { matchupPeriodId: 4, home: { teamId: 'A', totalPoints: 0 }, away: { teamId: 'D', totalPoints: 0 } },
    { matchupPeriodId: 4, home: { teamId: 'B', totalPoints: 0 }, away: { teamId: 'C', totalPoints: 0 } }
  );
  const board = computeThreatBoard(input);
  assert.ok(board?.keepAhead?.progression?.length >= 3);
  const pcts = board.keepAhead.progression.map(r => r.playoffPct);
  for (let i = 1; i < pcts.length; i++) {
    assert.ok(pcts[i] >= pcts[i - 1], `extra forced win hurt playoff odds: ${pcts}`);
  }
  assert.equal(board.sims, 10000);
});

test('ESPN-confirmed final result is never resimulated', () => {
  const settled = fixture(125);
  const match = settled.schedule.find(m => m.matchupPeriodId === 2 && m.home?.teamId === 'A');
  match.away.totalPoints = 70;
  match.winner = 'HOME';
  const result = computePlayoffOdds(settled);
  assert.equal(result.mine.currentWeekWinProb, 100);
  assert.equal(result.mine.remaining[0].winProb, 100);
});

test('large-league War Room simulation finishes within a staging CPU budget', () => {
  const teams = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1), name: 'Team ' + (i + 1),
    wins: 3, losses: 3, ties: 0, pointsFor: 730 + (i % 7) * 12
  }));
  const schedule = [];
  for (let week = 1; week <= 14; week++) {
    for (let k = 0; k < 6; k++) {
      const home = String(k + 1);
      const away = String(12 - k);
      schedule.push({
        matchupPeriodId: week,
        home: { teamId: home, totalPoints: week < 7 ? 98 + k : 0 },
        away: { teamId: away, totalPoints: week < 7 ? 99 + k : 0 }
      });
    }
  }
  const begin = performance.now();
  const result = computeThreatBoard({
    teams, schedule, currentPeriod: 7, regSeasonPeriods: 14,
    playoffTeamCount: 6, myTeamId: '1', gamesPlayed: 6
  });
  const runtimeMs = performance.now() - begin;
  assert.ok(result?.mine?.playoffPct >= 0);
  // Not a production latency guarantee; prevents accidental 10-100x algorithm regressions.
  assert.ok(runtimeMs < 15000, `simulation budget exceeded: ${runtimeMs.toFixed(1)}ms`);
});
