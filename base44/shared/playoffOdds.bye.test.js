import assert from 'node:assert/strict';
import test from 'node:test';
import { computePlayoffOdds, computeThreatBoard } from './playoffOdds.js';

// Two teams already on 5 wins, two on 4. Three playoff spots, so the fourth
// team is out unless it wins its last real game. Math.random is pinned so
// equal scoring means tie that game and nobody is handed a win by the draw.
const teams = [
  { id: '1', name: 'Team 1', wins: 5, losses: 2, ties: 0, pointsFor: 400 },
  { id: '2', name: 'Team 2', wins: 5, losses: 2, ties: 0, pointsFor: 400 },
  { id: '3', name: 'Team 3', wins: 4, losses: 3, ties: 0, pointsFor: 400 },
  { id: '4', name: 'Team 4', wins: 4, losses: 3, ties: 0, pointsFor: 400 }
];

// Week 5 is a bye for team 4 (ESPN omits the other side). Week 6 is a real game.
const schedule = [
  { matchupPeriodId: 5, home: { teamId: 4 } },
  { matchupPeriodId: 6, home: { teamId: 4 }, away: { teamId: 3 } }
];

const args = {
  teams,
  schedule,
  currentPeriod: 5,
  regSeasonPeriods: 6,
  playoffTeamCount: 3,
  myTeamId: '4',
  gamesPlayed: 4
};

test('a bye does not consume a forced win or count as a game left', () => {
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    const base = computePlayoffOdds({ ...args, forceMyWins: 0 });
    const forced = computePlayoffOdds({ ...args, forceMyWins: 1 });
    assert.equal(base.mine.playoffPct, 0);
    assert.equal(forced.mine.playoffPct, 100);

    const board = computeThreatBoard(args);
    assert.equal(board.keepAhead.gamesLeft, 1);
  } finally {
    Math.random = random;
  }
});
