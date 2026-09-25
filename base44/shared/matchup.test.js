import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHeadToHead, matchupOpponentId } from './matchup.js';
import { buildProfiles } from './playoffOdds.js';

const byeWeek = {
  matchupPeriodId: 2,
  home: { teamId: 1, totalPoints: 0 }
};

const realWeek = {
  matchupPeriodId: 1,
  home: { teamId: 1, totalPoints: 100 },
  away: { teamId: 2, totalPoints: 80 }
};

test('bye week has no opponent and is not a head-to-head', () => {
  assert.equal(isHeadToHead(byeWeek), false);
  assert.equal(matchupOpponentId(byeWeek, 1), null);
  assert.equal(matchupOpponentId(byeWeek, '1'), null);
});

test('a real matchup resolves the other team id', () => {
  assert.equal(isHeadToHead(realWeek), true);
  assert.equal(matchupOpponentId(realWeek, '1'), '2');
  assert.equal(matchupOpponentId(realWeek, 2), '1');
  assert.equal(matchupOpponentId(realWeek, 9), null);
});

test('a missing home side does not throw when the team is away', () => {
  const awayOnly = { matchupPeriodId: 3, away: { teamId: 4, totalPoints: 0 } };
  assert.equal(matchupOpponentId(awayOnly, '4'), null);
  assert.equal(isHeadToHead(awayOnly), false);
});

test('bye weeks are excluded from scoring profiles', () => {
  const teams = [
    { id: '1', wins: 1, losses: 0, pointsFor: 100 },
    { id: '2', wins: 0, losses: 1, pointsFor: 80 }
  ];
  const { profiles } = buildProfiles({
    teams,
    schedule: [realWeek, byeWeek],
    currentPeriod: 3,
    gamesPlayed: 2
  });
  assert.equal(profiles['1'].mean, 100);
  assert.equal(profiles['2'].mean, 80);
});
