import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSimilarity, parseExpression } from '../../src/harness/similarity.js';

test('identical signatures return 1.0 similarity', () => {
  const left = parseExpression('alpha = rank(ts_delta(close, 5));\nalpha');
  const right = parseExpression('beta = rank(ts_delta(close, 5));\nbeta');
  assert.equal(computeSimilarity(left, right), 1);
});

test('disjoint signatures return 0.0 similarity', () => {
  const left = parseExpression('rank(close)');
  const right = parseExpression('group_rank(volume, industry)');
  assert.equal(computeSimilarity(left, right), 0);
});

test('parser separates functions, datafields, operators, and structure', () => {
  const parsed = parseExpression('signal = rank(ts_delta(close, 5) / adv20);\nsignal');
  assert.deepEqual(Object.keys(Object.fromEntries(parsed.functionCounts)).sort(), ['rank', 'ts_delta']);
  assert.deepEqual(Object.keys(Object.fromEntries(parsed.datafieldCounts)).sort(), ['adv20', 'close']);
  assert.deepEqual(Object.keys(Object.fromEntries(parsed.operatorCounts)).sort(), ['/', '=']);
  assert.ok(parsed.structureCounts.size > 0);
});

test('sales over cap is identical to itself even without functions', () => {
  const left = parseExpression('sales/cap');
  const right = parseExpression('sales/cap');
  assert.equal(computeSimilarity(left, right), 1);
});

test('sales over cap is materially different from sales alone', () => {
  const left = parseExpression('sales/cap');
  const right = parseExpression('sales');
  assert.ok(computeSimilarity(left, right) < 0.3);
});
