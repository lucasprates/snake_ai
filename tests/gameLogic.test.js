import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialState,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  END_REASONS,
  isInsideBoard,
  placeFood,
  positionsEqual,
  setDirection,
  stepState,
  togglePause
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

test("food placement never lands on blocked positions", () => {
  const snake = [{ x: 0, y: 0 }];
  const blocked = [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ];

  const food = placeFood(snake, 3, 3, () => 0.5, blocked);

  assert.deepEqual(food, { x: 2, y: 2 });
});

test("blocked positions are considered when spawning food after eating", () => {
  const state = createInitialState({
    width: 3,
    height: 2,
    snake: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ],
    direction: "RIGHT",
    food: { x: 1, y: 0 }
  });

  const next = stepState(state, {
    randomFn: () => 0,
    blockedPositions: [
      { x: 2, y: 0 },
      { x: 2, y: 1 }
    ]
  });

  assert.equal(next.gameOver, true);
  assert.equal(next.endReason, END_REASONS.FILLED_BOARD);
  assert.equal(next.food, null);
});

test("togglePause flips paused state and back", () => {
  const state = createInitialState({
    width: 6,
    height: 6,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "RIGHT",
    food: { x: 5, y: 5 }
  });

  assert.equal(state.paused, false);

  const paused = togglePause(state);
  assert.equal(paused.paused, true);

  const resumed = togglePause(paused);
  assert.equal(resumed.paused, false);
});

test("togglePause is ignored when game is over", () => {
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

  const gameOver = stepState(state);
  assert.equal(gameOver.gameOver, true);

  const result = togglePause(gameOver);
  assert.equal(result.paused, false);
  assert.equal(result, gameOver);
});

test("setDirection ignores invalid direction string", () => {
  const state = createInitialState({
    width: 6,
    height: 6,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "RIGHT",
    food: { x: 5, y: 5 }
  });

  const result = setDirection(state, "DIAGONAL");
  assert.equal(result, state);
});

test("setDirection ignores duplicate pending direction", () => {
  const state = createInitialState({
    width: 6,
    height: 6,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "RIGHT",
    food: { x: 5, y: 5 }
  });

  const result = setDirection(state, "RIGHT");
  assert.equal(result, state);
});

test("placeFood returns null when board is completely full", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ];

  const food = placeFood(snake, 2, 2);
  assert.equal(food, null);
});

test("stepState is a no-op when game is paused", () => {
  const state = createInitialState({
    width: 6,
    height: 6,
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ],
    direction: "RIGHT",
    food: { x: 5, y: 5 }
  });

  const paused = togglePause(state);
  const next = stepState(paused);

  assert.equal(next, paused);
});

test("stepState is a no-op when game is over", () => {
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

  const gameOver = stepState(state);
  assert.equal(gameOver.gameOver, true);

  const next = stepState(gameOver);
  assert.equal(next, gameOver);
});

test("rapid RIGHT→UP→LEFT between ticks is allowed via pendingDirection check", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 }
    ],
    direction: "RIGHT",
    food: { x: 9, y: 9 }
  });

  const afterUp = setDirection(state, "UP");
  assert.equal(afterUp.pendingDirection, "UP");

  const afterLeft = setDirection(afterUp, "LEFT");
  assert.equal(afterLeft.pendingDirection, "LEFT");

  const next = stepState(afterLeft);
  assert.deepEqual(next.snake[0], { x: 4, y: 5 });
  assert.equal(next.gameOver, false);
});

test("rapid UP→RIGHT→DOWN between ticks is allowed via pendingDirection check", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 }
    ],
    direction: "UP",
    food: { x: 9, y: 9 }
  });

  const afterRight = setDirection(state, "RIGHT");
  assert.equal(afterRight.pendingDirection, "RIGHT");

  const afterDown = setDirection(afterRight, "DOWN");
  assert.equal(afterDown.pendingDirection, "DOWN");

  const next = stepState(afterDown);
  assert.deepEqual(next.snake[0], { x: 5, y: 6 });
  assert.equal(next.gameOver, false);
});

test("pendingDirection reverse is still rejected", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 }
    ],
    direction: "RIGHT",
    food: { x: 9, y: 9 }
  });

  const afterUp = setDirection(state, "UP");
  assert.equal(afterUp.pendingDirection, "UP");

  const afterDown = setDirection(afterUp, "DOWN");
  assert.equal(afterDown, afterUp);
  assert.equal(afterDown.pendingDirection, "UP");
});

test("positionsEqual returns true for matching coordinates", () => {
  assert.equal(positionsEqual({ x: 3, y: 7 }, { x: 3, y: 7 }), true);
});

test("positionsEqual returns false for different coordinates", () => {
  assert.equal(positionsEqual({ x: 3, y: 7 }, { x: 3, y: 8 }), false);
  assert.equal(positionsEqual({ x: 0, y: 0 }, { x: 1, y: 0 }), false);
});

test("isInsideBoard returns true for positions within bounds", () => {
  assert.equal(isInsideBoard({ x: 0, y: 0 }, 10, 10), true);
  assert.equal(isInsideBoard({ x: 9, y: 9 }, 10, 10), true);
  assert.equal(isInsideBoard({ x: 5, y: 5 }, 10, 10), true);
});

test("isInsideBoard returns false for positions outside bounds", () => {
  assert.equal(isInsideBoard({ x: -1, y: 0 }, 10, 10), false);
  assert.equal(isInsideBoard({ x: 0, y: -1 }, 10, 10), false);
  assert.equal(isInsideBoard({ x: 10, y: 0 }, 10, 10), false);
  assert.equal(isInsideBoard({ x: 0, y: 10 }, 10, 10), false);
});

test("createInitialState uses default 20x20 grid and centers the snake", () => {
  const state = createInitialState();

  assert.equal(state.width, DEFAULT_GRID_WIDTH);
  assert.equal(state.height, DEFAULT_GRID_HEIGHT);
  assert.equal(state.width, 20);
  assert.equal(state.height, 20);
  assert.equal(state.direction, "RIGHT");
  assert.equal(state.pendingDirection, "RIGHT");
  assert.equal(state.score, 0);
  assert.equal(state.paused, false);
  assert.equal(state.gameOver, false);
  assert.equal(state.endReason, null);

  assert.equal(state.snake.length, 3);
  assert.deepEqual(state.snake[0], { x: 10, y: 10 });
  assert.deepEqual(state.snake[1], { x: 9, y: 10 });
  assert.deepEqual(state.snake[2], { x: 8, y: 10 });
});

test("single-segment snake is allowed to reverse direction", () => {
  const state = createInitialState({
    width: 6,
    height: 6,
    snake: [{ x: 3, y: 3 }],
    direction: "RIGHT",
    food: { x: 5, y: 5 }
  });

  const reversed = setDirection(state, "LEFT");
  assert.equal(reversed.pendingDirection, "LEFT");

  const next = stepState(reversed);
  assert.deepEqual(next.snake[0], { x: 2, y: 3 });
});

test("snake moves one cell UP per tick", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 }
    ],
    direction: "UP",
    food: { x: 9, y: 9 }
  });

  const next = stepState(state);
  assert.deepEqual(next.snake[0], { x: 5, y: 4 });
  assert.equal(next.gameOver, false);
});

test("snake moves one cell DOWN per tick", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 3 }
    ],
    direction: "DOWN",
    food: { x: 9, y: 9 }
  });

  const next = stepState(state);
  assert.deepEqual(next.snake[0], { x: 5, y: 6 });
  assert.equal(next.gameOver, false);
});

test("snake moves one cell LEFT per tick", () => {
  const state = createInitialState({
    width: 10,
    height: 10,
    snake: [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 5 }
    ],
    direction: "LEFT",
    food: { x: 9, y: 9 }
  });

  const next = stepState(state);
  assert.deepEqual(next.snake[0], { x: 4, y: 5 });
  assert.equal(next.gameOver, false);
});
