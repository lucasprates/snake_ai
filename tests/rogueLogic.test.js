import test from "node:test";
import assert from "node:assert/strict";

import {
  clampRogueCount,
  createRogueSlots,
  moveRogueSnake,
  randomRespawnTicks,
  spawnRogueSnake,
  toCellKey
} from "../src/rogueLogic.js";

test("rogue count is clamped to 0-5", () => {
  assert.equal(clampRogueCount(-3), 0);
  assert.equal(clampRogueCount(0), 0);
  assert.equal(clampRogueCount(2), 2);
  assert.equal(clampRogueCount(6), 5);
});

test("rogue slots are created with randomized spawn delays", () => {
  const slots = createRogueSlots(3, () => 0);

  assert.equal(slots.length, 3);
  assert.equal(slots[0].respawnTicks, 0);
  assert.equal(slots[1].active, false);
});

test("respawn timer stays inside expected range", () => {
  assert.equal(randomRespawnTicks(() => 0), 8);
  assert.equal(randomRespawnTicks(() => 0.99999), 28);
});

test("rogue snake spawns without using occupied cells", () => {
  const occupiedCells = new Set([
    toCellKey({ x: 0, y: 0 }),
    toCellKey({ x: 1, y: 0 }),
    toCellKey({ x: 2, y: 0 }),
    toCellKey({ x: 0, y: 1 }),
    toCellKey({ x: 1, y: 1 })
  ]);

  const rogue = spawnRogueSnake(1, 4, 4, occupiedCells, () => 0.1);

  assert.ok(rogue);
  assert.equal(rogue.active, true);
  assert.equal(rogue.snake.length, 3);
  assert.ok(
    rogue.snake.every((part) => !occupiedCells.has(toCellKey(part)))
  );
});

test("rogue snake moves toward food when path is clear", () => {
  const rogue = {
    id: 1,
    active: true,
    direction: "RIGHT",
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 }
    ]
  };

  const moved = moveRogueSnake(
    rogue,
    { x: 4, y: 2 },
    6,
    6,
    new Set(),
    () => 0
  );

  assert.ok(moved);
  assert.equal(moved.ateFood, false);
  assert.deepEqual(moved.rogue.snake[0], { x: 3, y: 2 });
});

test("rogue snake grows when it eats food", () => {
  const rogue = {
    id: 1,
    active: true,
    direction: "RIGHT",
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 }
    ]
  };

  const moved = moveRogueSnake(
    rogue,
    { x: 3, y: 2 },
    6,
    6,
    new Set(),
    () => 0
  );

  assert.ok(moved);
  assert.equal(moved.ateFood, true);
  assert.equal(moved.rogue.snake.length, 4);
});

test("rogue snake dies when no safe move exists", () => {
  const rogue = {
    id: 1,
    active: true,
    direction: "UP",
    snake: [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 }
    ]
  };

  const blocked = new Set([
    toCellKey({ x: 1, y: 0 }),
    toCellKey({ x: 0, y: 1 }),
    toCellKey({ x: 2, y: 1 })
  ]);

  const moved = moveRogueSnake(
    rogue,
    { x: 2, y: 2 },
    3,
    3,
    blocked,
    () => 0
  );

  assert.equal(moved, null);
});
