import test from "node:test";
import assert from "node:assert/strict";

import {
  clampRogueCount,
  createRogueSlots,
  getActiveRogueSegments,
  getRogueCollisionResult,
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

test("rogue spawn always starts from a corner and emerges from wall", () => {
  const rogue = spawnRogueSnake(1, 6, 6, new Set(), () => 0);
  const head = rogue.snake[0];
  const isCornerHead =
    (head.x === 0 || head.x === 5) &&
    (head.y === 0 || head.y === 5);
  const hasOutsideSegment = rogue.snake.some(
    (part) => part.x < 0 || part.y < 0 || part.x >= 6 || part.y >= 6
  );

  assert.ok(isCornerHead);
  assert.equal(rogue.emergingTicks, 2);
  assert.equal(hasOutsideSegment, true);
});

test("rogue keeps spawn direction while emerging, then can turn", () => {
  const initial = {
    id: 1,
    active: true,
    direction: "RIGHT",
    emergingTicks: 2,
    snake: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -2, y: 0 }
    ]
  };

  const first = moveRogueSnake(initial, { x: 0, y: 5 }, 6, 6, new Set(), () => 0);
  assert.ok(first);
  assert.equal(first.rogue.direction, "RIGHT");
  assert.equal(first.rogue.emergingTicks, 1);
  assert.deepEqual(first.rogue.snake[0], { x: 1, y: 0 });

  const second = moveRogueSnake(first.rogue, { x: 0, y: 5 }, 6, 6, new Set(), () => 0);
  assert.ok(second);
  assert.equal(second.rogue.direction, "RIGHT");
  assert.equal(second.rogue.emergingTicks, 0);
  assert.deepEqual(second.rogue.snake[0], { x: 2, y: 0 });

  const third = moveRogueSnake(second.rogue, { x: 2, y: 5 }, 6, 6, new Set(), () => 0);
  assert.ok(third);
  assert.equal(third.rogue.direction, "DOWN");
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

test("rogue dies when rogue head reaches player body", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "RIGHT",
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 }
      ]
    }
  ];

  const playerSnake = [
    { x: 5, y: 5 },
    { x: 2, y: 2 },
    { x: 5, y: 4 }
  ];

  const result = getRogueCollisionResult(rogues, playerSnake);

  assert.deepEqual(result.defeatedRogueIds, [1]);
  assert.equal(result.playerDefeated, false);
});

test("player dies when player head reaches rogue body", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "RIGHT",
      snake: [
        { x: 6, y: 6 },
        { x: 2, y: 2 },
        { x: 6, y: 5 }
      ]
    }
  ];

  const playerSnake = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 }
  ];

  const result = getRogueCollisionResult(rogues, playerSnake);

  assert.deepEqual(result.defeatedRogueIds, []);
  assert.equal(result.playerDefeated, true);
});

test("player and rogue both die on same-cell head collision", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "RIGHT",
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 }
      ]
    }
  ];

  const playerSnake = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 }
  ];

  const result = getRogueCollisionResult(rogues, playerSnake);

  assert.deepEqual(result.defeatedRogueIds, [1]);
  assert.equal(result.playerDefeated, true);
});

test("player and rogue both die on head-swap collision", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "LEFT",
      snake: [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 }
      ]
    }
  ];

  const playerSnake = [
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 2, y: 3 }
  ];

  const result = getRogueCollisionResult(rogues, playerSnake, {
    previousPlayerHead: { x: 1, y: 1 },
    previousRogueHeads: new Map([[1, { x: 2, y: 1 }]])
  });

  assert.deepEqual(result.defeatedRogueIds, [1]);
  assert.equal(result.playerDefeated, true);
});

test("only the colliding rogue dies on head-into-other-body collision", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "RIGHT",
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 }
      ]
    },
    {
      id: 2,
      active: true,
      direction: "UP",
      snake: [
        { x: 4, y: 4 },
        { x: 2, y: 2 },
        { x: 2, y: 3 }
      ]
    }
  ];

  const result = getRogueCollisionResult(rogues, []);

  assert.deepEqual(result.defeatedRogueIds, [1]);
  assert.equal(result.playerDefeated, false);
});

test("both rogues die when heads overlap on the same cell", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "RIGHT",
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 1, y: 3 }
      ]
    },
    {
      id: 2,
      active: true,
      direction: "LEFT",
      snake: [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 3 }
      ]
    }
  ];

  const result = getRogueCollisionResult(rogues, []);

  assert.deepEqual(result.defeatedRogueIds.sort((a, b) => a - b), [1, 2]);
  assert.equal(result.playerDefeated, false);
});

test("rogue avoids cells occupied by other rogues", () => {
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

  const blockedCells = new Set([
    toCellKey({ x: 3, y: 2 })
  ]);

  const moved = moveRogueSnake(
    rogue,
    { x: 5, y: 2 },
    6,
    6,
    blockedCells,
    () => 0
  );

  assert.ok(moved);
  assert.ok(
    moved.rogue.snake[0].x !== 3 || moved.rogue.snake[0].y !== 2,
    "rogue must not move onto a blocked cell"
  );
});

test("both rogues die on head-swap collision", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      direction: "RIGHT",
      snake: [
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    },
    {
      id: 2,
      active: true,
      direction: "LEFT",
      snake: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 }
      ]
    }
  ];

  const result = getRogueCollisionResult(rogues, [], {
    previousRogueHeads: new Map([
      [1, { x: 1, y: 1 }],
      [2, { x: 2, y: 1 }]
    ])
  });

  assert.deepEqual(result.defeatedRogueIds.sort((a, b) => a - b), [1, 2]);
  assert.equal(result.playerDefeated, false);
});

test("getActiveRogueSegments collects segments from active rogues only", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ]
    },
    {
      id: 2,
      active: false,
      snake: []
    },
    {
      id: 3,
      active: true,
      snake: [
        { x: 5, y: 5 }
      ]
    }
  ];

  const segments = getActiveRogueSegments(rogues);
  assert.equal(segments.length, 3);
  assert.deepEqual(segments[0], { x: 0, y: 0 });
  assert.deepEqual(segments[1], { x: 1, y: 0 });
  assert.deepEqual(segments[2], { x: 5, y: 5 });
});

test("getActiveRogueSegments excludes rogue by id", () => {
  const rogues = [
    {
      id: 1,
      active: true,
      snake: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ]
    },
    {
      id: 2,
      active: true,
      snake: [
        { x: 5, y: 5 }
      ]
    }
  ];

  const segments = getActiveRogueSegments(rogues, 1);
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0], { x: 5, y: 5 });
});

test("rogue picks a random direction when food is null", () => {
  const rogue = {
    id: 1,
    active: true,
    direction: "RIGHT",
    snake: [
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 1, y: 3 }
    ]
  };

  const moved = moveRogueSnake(rogue, null, 6, 6, new Set(), () => 0);

  assert.ok(moved);
  assert.equal(moved.ateFood, false);
  assert.equal(moved.rogue.snake.length, 3);
});

test("rogue spawn returns null when all corners are occupied", () => {
  const occupiedCells = new Set([
    toCellKey({ x: 0, y: 0 }),
    toCellKey({ x: 5, y: 0 }),
    toCellKey({ x: 0, y: 5 }),
    toCellKey({ x: 5, y: 5 })
  ]);

  const rogue = spawnRogueSnake(1, 6, 6, occupiedCells, () => 0);
  assert.equal(rogue, null);
});
