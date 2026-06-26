import { test } from 'node:test';
import assert from 'node:assert';
import { getMiddlePosition } from '../lib/sync/position';

test('Fractional Indexing: returns middle character for simple inputs', () => {
  const mid = getMiddlePosition('a', 'c');
  assert.strictEqual(mid, 'b');
});

test('Fractional Indexing: handles prepending before the first block', () => {
  // If first position is 'b', prepend should produce 'a'
  const prependA = getMiddlePosition(null, 'b');
  assert.strictEqual(prependA, 'a');

  // If first position is 'a', prepend should slide characters
  const prependB = getMiddlePosition(null, 'a');
  assert.ok(prependB < 'a'); // Prepend is lexicographically smaller than 'a'
});

test('Fractional Indexing: handles appending after the last block', () => {
  // If last position is 'y', append should produce 'z'
  const appendZ = getMiddlePosition('y', null);
  assert.strictEqual(appendZ, 'z');

  // If last position is 'z', append should interpolate
  const appendM = getMiddlePosition('z', null);
  assert.ok(appendM > 'z'); // Append is lexicographically larger than 'z'
});

test('Fractional Indexing: interpolates consecutive letters by appending midpoints', () => {
  // Interpolating between 'a' and 'b' should produce 'am' (midpoint suffix)
  const mid = getMiddlePosition('a', 'b');
  assert.ok(mid > 'a');
  assert.ok(mid < 'b');
  assert.strictEqual(mid, 'am');
});
