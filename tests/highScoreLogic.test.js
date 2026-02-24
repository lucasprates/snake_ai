import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultHighScores,
  getBestScoreForRogueCount,
  normalizeHighScores,
  toHighScoreRows,
  upsertBestScoreForRogueCount
} from "../src/highScoreLogic.js";

test("createDefaultHighScores creates zeroed entries for 0..max AI count", () => {
  assert.deepEqual(createDefaultHighScores(3), {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  });
});

test("normalizeHighScores sanitizes invalid values and missing keys", () => {
  const normalized = normalizeHighScores(
    {
      0: 10,
      1: -2,
      2: 4.8,
      4: Number.NaN
    },
    5
  );

  assert.deepEqual(normalized, {
    0: 10,
    1: 0,
    2: 4,
    3: 0,
    4: 0,
    5: 0
  });
});

test("getBestScoreForRogueCount returns clamped AI best", () => {
  const highScores = {
    0: 1,
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6
  };

  assert.equal(getBestScoreForRogueCount(highScores, 2, 5), 3);
  assert.equal(getBestScoreForRogueCount(highScores, 9, 5), 6);
  assert.equal(getBestScoreForRogueCount(highScores, -4, 5), 1);
});

test("upsertBestScoreForRogueCount updates only when score improves", () => {
  const baseline = {
    0: 0,
    1: 0,
    2: 8,
    3: 0,
    4: 0,
    5: 0
  };

  const first = upsertBestScoreForRogueCount(baseline, 2, 7, 5);
  assert.equal(first.isNewRecord, false);
  assert.equal(first.bestScore, 8);
  assert.deepEqual(first.highScores, baseline);

  const second = upsertBestScoreForRogueCount(first.highScores, 2, 11, 5);
  assert.equal(second.isNewRecord, true);
  assert.equal(second.previousBest, 8);
  assert.equal(second.bestScore, 11);
  assert.equal(second.highScores[2], 11);
});

test("toHighScoreRows returns ordered AI rows", () => {
  const rows = toHighScoreRows({ 0: 1, 1: 0, 2: 9 }, 2);
  assert.deepEqual(rows, [
    { rogueCount: 0, bestScore: 1 },
    { rogueCount: 1, bestScore: 0 },
    { rogueCount: 2, bestScore: 9 }
  ]);
});
