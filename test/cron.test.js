import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCron, runsPerDay, nextRun, describeSchedule } from '../src/iso/cron.js';

test('runsPerDay: gangbare schema\'s', () => {
  assert.equal(runsPerDay('* * * * *'), 1440);
  assert.equal(runsPerDay('*/5 * * * *'), 288);
  assert.equal(runsPerDay('*/15 * * * *'), 96);
  assert.equal(runsPerDay('*/30 * * * *'), 48);
  assert.equal(runsPerDay('0 * * * *'), 24);
  assert.equal(runsPerDay('0 7 * * *'), 1);
  assert.equal(runsPerDay('0 9 * * 1'), 1 / 7);
  assert.equal(runsPerDay(null), 0);
});

test('runsPerDay: lijsten, bereiken en stappen', () => {
  assert.equal(runsPerDay('0,30 * * * *'), 48);
  assert.equal(runsPerDay('0 9-17 * * *'), 9);
  assert.equal(runsPerDay('0 8-18/2 * * *'), 6);
  assert.equal(runsPerDay('0 7 * * 1-5'), 5 / 7);
  assert.equal(runsPerDay('5/15 * * * *'), 4 * 24);
});

test('runsPerDay: macro\'s en maandfilter', () => {
  assert.equal(runsPerDay('@hourly'), 24);
  assert.equal(runsPerDay('@daily'), 1);
  assert.ok(Math.abs(runsPerDay('@monthly') - 1 / 30.44) < 1e-9);
  assert.equal(runsPerDay('0 0 * 1-6 *'), 0.5);
});

test('weekdag 7 is zondag', () => {
  assert.deepEqual([...parseCron('0 0 * * 7').dow], [0]);
});

test('ongeldige cron geeft een fout', () => {
  assert.throws(() => parseCron('* * * *'));
  assert.throws(() => parseCron('61 * * * *'));
  assert.throws(() => parseCron('a * * * *'));
  assert.throws(() => parseCron('5-1 * * * *'));
});

test('nextRun', () => {
  const from = new Date(2026, 9, 8, 14, 7, 30); // do 8 okt 2026 14:07:30
  assert.deepEqual(nextRun('*/30 * * * *', from), new Date(2026, 9, 8, 14, 30));
  assert.deepEqual(nextRun('0 7 * * *', from), new Date(2026, 9, 9, 7, 0));
  assert.deepEqual(nextRun('0 9 * * 1', from), new Date(2026, 9, 12, 9, 0));
  assert.equal(nextRun(null, from), null);
});

test('describeSchedule', () => {
  assert.equal(describeSchedule(null), 'handmatig');
  assert.equal(describeSchedule('*/5 * * * *'), 'elke 5 minuten');
  assert.equal(describeSchedule('0 * * * *'), 'elk uur');
  assert.equal(describeSchedule('30 3 * * *'), 'dagelijks om 03:30');
  assert.equal(describeSchedule('0 9 * * 1'), 'wekelijks, maandag 09:00');
});
