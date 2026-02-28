import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultHighScores,
  getBestScore,
  migrateHighScores,
  normalizeHighScores,
  toHighScoreRows,
  upsertBestScore
} from "../src/highScoreLogic.js";

const DIFFS = ["EASY", "MEDIUM", "HARD", "STORY"];

test("createDefaultHighScores creates zeroed entries with difficulties", () => {
  const scores = createDefaultHighScores(1, ["EASY", "HARD"]);
  assert.deepEqual(scores, {
    "0:EASY": 0,
    "1:EASY": 0,
    "0:HARD": 0,
    "1:HARD": 0
  });
});

test("createDefaultHighScores legacy mode without difficulties", () => {
  assert.deepEqual(createDefaultHighScores(2), {
    0: 0,
    1: 0,
    2: 0
  });
});

test("normalizeHighScores sanitizes invalid values", () => {
  const raw = {
    "0:MEDIUM": 10,
    "1:MEDIUM": -2,
    "0:HARD": NaN
  };
  const normalized = normalizeHighScores(raw, 1, ["MEDIUM", "HARD"]);

  assert.equal(normalized["0:MEDIUM"], 10);
  assert.equal(normalized["1:MEDIUM"], 0);
  assert.equal(normalized["0:HARD"], 0);
  assert.equal(normalized["1:HARD"], 0);
});

test("getBestScore returns score for difficulty+rogueCount", () => {
  const scores = { "2:HARD": 15, "2:EASY": 3 };
  assert.equal(getBestScore(scores, 2, "HARD", 5), 15);
  assert.equal(getBestScore(scores, 2, "EASY", 5), 3);
  assert.equal(getBestScore(scores, 2, "MEDIUM", 5), 0);
});

test("upsertBestScore updates only when score improves", () => {
  const baseline = { "2:MEDIUM": 8 };

  const first = upsertBestScore(baseline, 2, "MEDIUM", 7, 5, DIFFS);
  assert.equal(first.isNewRecord, false);
  assert.equal(first.bestScore, 8);

  const second = upsertBestScore(first.highScores, 2, "MEDIUM", 11, 5, DIFFS);
  assert.equal(second.isNewRecord, true);
  assert.equal(second.previousBest, 8);
  assert.equal(second.bestScore, 11);
  assert.equal(second.highScores["2:MEDIUM"], 11);
});

test("toHighScoreRows returns ordered rows for a difficulty", () => {
  const scores = { "0:HARD": 1, "1:HARD": 0, "2:HARD": 9 };
  const rows = toHighScoreRows(scores, "HARD", 2);
  assert.deepEqual(rows, [
    { rogueCount: 0, bestScore: 1 },
    { rogueCount: 1, bestScore: 0 },
    { rogueCount: 2, bestScore: 9 }
  ]);
});

test("migrateHighScores converts legacy keys to difficulty keys", () => {
  const legacy = { "0": 5, "1": 10, "2": 0 };
  const { highScores, didMigrate } = migrateHighScores(legacy, 2, "MEDIUM");

  assert.equal(didMigrate, true);
  assert.equal(highScores["0:MEDIUM"], 5);
  assert.equal(highScores["1:MEDIUM"], 10);
  assert.equal(highScores["2:MEDIUM"], 0);
  assert.equal(highScores["0"], undefined);
});

test("migrateHighScores skips already-migrated scores", () => {
  const current = { "0:MEDIUM": 5, "1:HARD": 3 };
  const { highScores, didMigrate } = migrateHighScores(current, 1, "MEDIUM");

  assert.equal(didMigrate, false);
  assert.equal(highScores["0:MEDIUM"], 5);
});

test("normalizeHighScores returns defaults for null input", () => {
  const result = normalizeHighScores(null, 1, ["EASY", "HARD"]);
  assert.deepEqual(result, {
    "0:EASY": 0,
    "1:EASY": 0,
    "0:HARD": 0,
    "1:HARD": 0
  });
});

test("normalizeHighScores returns defaults for non-object input", () => {
  const result = normalizeHighScores("invalid", 1, ["MEDIUM"]);
  assert.deepEqual(result, {
    "0:MEDIUM": 0,
    "1:MEDIUM": 0
  });
});

test("migrateHighScores returns empty object for null input", () => {
  const result = migrateHighScores(null, 2, "MEDIUM");
  assert.deepEqual(result, {});
});
