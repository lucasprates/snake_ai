import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_MODES,
  DIFFICULTY_TICK_MS,
  getStoryTickMs,
  getTickMs
} from "../src/difficultyConfig.js";

test("getTickMs returns correct constant for EASY", () => {
  assert.equal(getTickMs("EASY"), 220);
});

test("getTickMs returns correct constant for MEDIUM", () => {
  assert.equal(getTickMs("MEDIUM"), 160);
});

test("getTickMs returns correct constant for HARD", () => {
  assert.equal(getTickMs("HARD"), 90);
});

test("getTickMs falls back to MEDIUM for unknown difficulty", () => {
  assert.equal(getTickMs("INVALID"), DIFFICULTY_TICK_MS[DEFAULT_DIFFICULTY]);
});

test("getStoryTickMs returns base tick at score 0", () => {
  assert.equal(getStoryTickMs(0), 160);
});

test("getStoryTickMs decreases every 3 points", () => {
  assert.equal(getStoryTickMs(0), 160);
  assert.equal(getStoryTickMs(2), 160);
  assert.equal(getStoryTickMs(3), 148);
  assert.equal(getStoryTickMs(5), 148);
  assert.equal(getStoryTickMs(6), 136);
  assert.equal(getStoryTickMs(9), 124);
});

test("getStoryTickMs never goes below 60ms", () => {
  assert.equal(getStoryTickMs(24), 64);
  assert.equal(getStoryTickMs(27), 60);
  assert.equal(getStoryTickMs(50), 60);
  assert.equal(getStoryTickMs(100), 60);
});

test("getStoryTickMs handles negative score safely", () => {
  assert.equal(getStoryTickMs(-5), 160);
});

test("getTickMs delegates to getStoryTickMs for STORY mode", () => {
  assert.equal(getTickMs("STORY", 0), 160);
  assert.equal(getTickMs("STORY", 9), 124);
  assert.equal(getTickMs("STORY", 50), 60);
});

test("getTickMs ignores score for fixed difficulty modes", () => {
  assert.equal(getTickMs("EASY", 100), 220);
  assert.equal(getTickMs("HARD", 100), 90);
});
