import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialState,
  END_REASONS,
  placeFood,
  setDirection,
  stepState
} from "../src/gameLogic.js";

test("snake moves one cell per tick in current direction", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "RIGHT",
    food: { x: 8, y: 8 }
  });

  const next = stepState(state);

  assert.deepEqual(next.snake, [
    { x: 4, y: 3 },
    { x: 3, y: 3 },
    { x: 2, y: 3 }
  ]);
  assert.equal(next.score, 0);
  assert.equal(next.gameOver, false);
  assert.equal(next.endReason, null);
});

test("snake grows and increments score when food is eaten", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "RIGHT",
    food: { x: 4, y: 3 }
  });

  const next = stepState(state, () => 0);

  assert.equal(next.snake.length, 4);
  assert.deepEqual(next.snake[0], { x: 4, y: 3 });
  assert.equal(next.score, 1);
});

test("wall collision ends the game", () => {
  const state = createInitialState({
    width: 5,
    height: 5,
    snake: [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 }
    ],
    direction: "LEFT",
    food: { x: 4, y: 4 }
  });

  const next = stepState(state);

  assert.equal(next.gameOver, true);
  assert.equal(next.endReason, END_REASONS.HIT_WALL);
});

test("self collision ends the game", () => {
  const state = createInitialState({
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "DOWN",
    food: { x: 5, y: 5 }
  });

  const next = stepState(state);

  assert.equal(next.gameOver, true);
  assert.equal(next.endReason, END_REASONS.HIT_SELF);
});

test("filling the board ends the game with filled-board reason", () => {
  const state = createInitialState({
    width: 3,
    height: 2,
    snake: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 }
    ],
    direction: "RIGHT",
    food: { x: 1, y: 0 },
    score: 4
  });

  const next = stepState(state, () => 0.2);

  assert.equal(next.gameOver, true);
  assert.equal(next.endReason, END_REASONS.FILLED_BOARD);
  assert.equal(next.score, 5);
  assert.equal(next.food, null);
});

test("reverse direction input is ignored", () => {
  const state = createInitialState({
    width: 8,
    height: 8,
    snake: [
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 }
    ],
    direction: "RIGHT",
    food: { x: 7, y: 7 }
  });

  const changed = setDirection(state, "LEFT");
  const next = stepState(changed);

  assert.deepEqual(next.snake[0], { x: 5, y: 4 });
});

test("food placement never lands on snake", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ];

  const food = placeFood(snake, 3, 3, () => 0.8);

  assert.deepEqual(food, { x: 2, y: 2 });
});
