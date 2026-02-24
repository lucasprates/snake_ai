import test from "node:test";
import assert from "node:assert/strict";

import {
  clampRandom,
  cloneSnake,
  OPPOSITE_DIRECTIONS
} from "../src/shared.js";

test("clampRandom returns 0 for NaN", () => {
  assert.equal(clampRandom(NaN), 0);
});

test("clampRandom returns 0 for negative values", () => {
  assert.equal(clampRandom(-0.5), 0);
});

test("clampRandom clamps values >= 1", () => {
  const result = clampRandom(1);
  assert.ok(result < 1);
  assert.ok(result > 0.99);
});

test("clampRandom passes through valid values", () => {
  assert.equal(clampRandom(0), 0);
  assert.equal(clampRandom(0.5), 0.5);
  assert.equal(clampRandom(0.999), 0.999);
});

test("cloneSnake creates a deep copy", () => {
  const original = [
    { x: 1, y: 2 },
    { x: 3, y: 4 }
  ];

  const clone = cloneSnake(original);

  assert.deepEqual(clone, original);
  assert.notEqual(clone, original);
  assert.notEqual(clone[0], original[0]);

  clone[0].x = 99;
  assert.equal(original[0].x, 1);
});

test("OPPOSITE_DIRECTIONS maps all four directions", () => {
  assert.equal(OPPOSITE_DIRECTIONS.UP, "DOWN");
  assert.equal(OPPOSITE_DIRECTIONS.DOWN, "UP");
  assert.equal(OPPOSITE_DIRECTIONS.LEFT, "RIGHT");
  assert.equal(OPPOSITE_DIRECTIONS.RIGHT, "LEFT");
});
