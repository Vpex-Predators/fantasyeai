import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPositionalBackup, rosterPosition } from './lineupNeeds.js';

const wrStarter = {
  name: 'Ja\'Marr Chase',
  position: 'WR',
  realPosition: 'WR',
  slot: 4,
  injuryStatus: 'QUESTIONABLE'
};

const flexWr = {
  name: 'Chris Olave',
  position: 'FLEX',
  realPosition: 'WR',
  slot: 23,
  injuryStatus: 'OUT'
};

test('a healthy bench WR covers an injured starter even though the bench slot is BE', () => {
  const bench = [{
    name: 'Rome Odunze',
    position: 'BE',
    realPosition: 'WR',
    slot: 20,
    injuryStatus: 'ACTIVE'
  }];
  assert.equal(rosterPosition(bench[0]), 'WR');
  assert.equal(hasPositionalBackup(wrStarter, bench), true);
  assert.equal(hasPositionalBackup(flexWr, bench), true);
});

test('an injured starter with only a different position on the bench has no backup', () => {
  const bench = [{
    name: 'Backup RB',
    position: 'BE',
    realPosition: 'RB',
    slot: 20,
    injuryStatus: 'ACTIVE'
  }];
  assert.equal(hasPositionalBackup(wrStarter, bench), false);
});

test('a same-position player on IR or already out is not a backup', () => {
  const bench = [
    { name: 'IR WR', position: 'IR', realPosition: 'WR', slot: 21, injuryStatus: 'ACTIVE' },
    { name: 'Out WR', position: 'BE', realPosition: 'WR', slot: 20, injuryStatus: 'OUT' }
  ];
  assert.equal(hasPositionalBackup(wrStarter, bench), false);
});

test('slot labels alone never count a bench player as a WR backup', () => {
  const bench = [{ name: 'Rome Odunze', position: 'BE', realPosition: 'WR', slot: 20, injuryStatus: 'ACTIVE' }];
  const slotMatch = bench.some(b => b.position === wrStarter.position);
  assert.equal(slotMatch, false);
  assert.equal(hasPositionalBackup(wrStarter, bench), true);
});
