import {
  DIRECTIONS,
  isInsideBoard,
  positionsEqual
} from "./gameLogic.js";
import {
  clampRandom,
  cloneSnake,
  OPPOSITE_DIRECTIONS
} from "./shared.js";

export const MAX_ROGUE_SNAKES = 5;

const DIRECTION_ORDER = ["UP", "DOWN", "LEFT", "RIGHT"];
const EMERGING_SEGMENTS = 2;

const INITIAL_DELAY_MIN = 0;
const INITIAL_DELAY_MAX = 18;
const RESPAWN_DELAY_MIN = 8;
const RESPAWN_DELAY_MAX = 28;

function randomIntInclusive(min, max, randomFn = Math.random) {
  const randomValue = clampRandom(randomFn());
  return min + Math.floor(randomValue * (max - min + 1));
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function buildSpawnSnake(head, direction) {
  const directionVector = DIRECTIONS[direction];

  return [
    { x: head.x, y: head.y },
    {
      x: head.x - directionVector.x,
      y: head.y - directionVector.y
    },
    {
      x: head.x - directionVector.x * 2,
      y: head.y - directionVector.y * 2
    }
  ];
}

function getCornerSpawnEntries(width, height) {
  return [
    {
      head: { x: 0, y: 0 },
      directions: ["RIGHT", "DOWN"]
    },
    {
      head: { x: width - 1, y: 0 },
      directions: ["LEFT", "DOWN"]
    },
    {
      head: { x: 0, y: height - 1 },
      directions: ["RIGHT", "UP"]
    },
    {
      head: { x: width - 1, y: height - 1 },
      directions: ["LEFT", "UP"]
    }
  ];
}

export function toCellKey(position) {
  return `${position.x},${position.y}`;
}

export function clampRogueCount(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const integerValue = Math.trunc(value);

  if (integerValue < 0) {
    return 0;
  }

  if (integerValue > MAX_ROGUE_SNAKES) {
    return MAX_ROGUE_SNAKES;
  }

  return integerValue;
}

export function createRogueSlots(count, randomFn = Math.random) {
  const clampedCount = clampRogueCount(count);
  const slots = [];

  for (let index = 0; index < clampedCount; index += 1) {
    slots.push({
      id: index + 1,
      active: false,
      snake: [],
      direction: "RIGHT",
      emergingTicks: 0,
      respawnTicks: randomIntInclusive(INITIAL_DELAY_MIN, INITIAL_DELAY_MAX, randomFn)
    });
  }

  return slots;
}

export function randomRespawnTicks(randomFn = Math.random) {
  return randomIntInclusive(RESPAWN_DELAY_MIN, RESPAWN_DELAY_MAX, randomFn);
}

export function getActiveRogueSegments(rogues, excludeId = null) {
  const segments = [];

  for (const rogue of rogues) {
    if (!rogue.active || rogue.id === excludeId) {
      continue;
    }

    for (const part of rogue.snake) {
      segments.push(part);
    }
  }

  return segments;
}

export function getRogueCollisionResult(
  rogues,
  playerSnake = [],
  options = {}
) {
  const previousPlayerHead = options.previousPlayerHead ?? null;
  const previousRogueHeads = options.previousRogueHeads ?? new Map();
  const activeRogues = rogues.filter(
    (rogue) => rogue.active && rogue.snake.length > 0
  );
  const defeatedRogueIds = new Set();
  let playerDefeated = false;

  const playerHead = playerSnake[0] ?? null;
  const playerBody = playerSnake.slice(1);

  if (playerHead) {
    for (const rogue of activeRogues) {
      const rogueHead = rogue.snake[0];

      if (positionsEqual(rogueHead, playerHead)) {
        defeatedRogueIds.add(rogue.id);
        playerDefeated = true;
      }

      const rogueBodyHit = rogue.snake
        .slice(1)
        .some((part) => positionsEqual(part, playerHead));
      if (rogueBodyHit) {
        playerDefeated = true;
      }

      const playerBodyHit = playerBody.some((part) => positionsEqual(part, rogueHead));
      if (playerBodyHit) {
        defeatedRogueIds.add(rogue.id);
      }

      const previousRogueHead = previousRogueHeads.get(rogue.id) ?? null;
      if (
        previousPlayerHead &&
        previousRogueHead &&
        positionsEqual(playerHead, previousRogueHead) &&
        positionsEqual(rogueHead, previousPlayerHead)
      ) {
        defeatedRogueIds.add(rogue.id);
        playerDefeated = true;
      }
    }
  }

  for (let index = 0; index < activeRogues.length; index += 1) {
    const rogue = activeRogues[index];
    const rogueHead = rogue.snake[0];

    for (let secondIndex = index + 1; secondIndex < activeRogues.length; secondIndex += 1) {
      const otherRogue = activeRogues[secondIndex];
      const otherHead = otherRogue.snake[0];

      if (positionsEqual(rogueHead, otherHead)) {
        defeatedRogueIds.add(rogue.id);
        defeatedRogueIds.add(otherRogue.id);
      }

      const previousHead = previousRogueHeads.get(rogue.id) ?? null;
      const otherPreviousHead = previousRogueHeads.get(otherRogue.id) ?? null;
      if (
        previousHead &&
        otherPreviousHead &&
        positionsEqual(rogueHead, otherPreviousHead) &&
        positionsEqual(otherHead, previousHead)
      ) {
        defeatedRogueIds.add(rogue.id);
        defeatedRogueIds.add(otherRogue.id);
      }
    }
  }

  for (const rogue of activeRogues) {
    const rogueHead = rogue.snake[0];

    for (const otherRogue of activeRogues) {
      if (rogue.id === otherRogue.id) {
        continue;
      }

      const hitBody = otherRogue.snake
        .slice(1)
        .some((part) => positionsEqual(part, rogueHead));
      if (hitBody) {
        defeatedRogueIds.add(rogue.id);
        break;
      }
    }
  }

  return {
    defeatedRogueIds: [...defeatedRogueIds],
    playerDefeated
  };
}

export function spawnRogueSnake(
  id,
  width,
  height,
  occupiedCells,
  randomFn = Math.random
) {
  const candidates = [];

  const cornerEntries = getCornerSpawnEntries(width, height);
  for (const cornerEntry of cornerEntries) {
    for (const direction of cornerEntry.directions) {
      const snake = buildSpawnSnake(cornerEntry.head, direction);
      const headKey = toCellKey(snake[0]);
      const canUse =
        isInsideBoard(snake[0], width, height) &&
        !occupiedCells.has(headKey);

      if (canUse) {
        candidates.push({ snake, direction });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const choiceIndex = randomIntInclusive(0, candidates.length - 1, randomFn);
  const choice = candidates[choiceIndex];

  return {
    id,
    active: true,
    snake: cloneSnake(choice.snake),
    direction: choice.direction,
    emergingTicks: EMERGING_SEGMENTS,
    respawnTicks: 0
  };
}

export function moveRogueSnake(
  rogue,
  food,
  width,
  height,
  blockedCells,
  randomFn = Math.random
) {
  if (!rogue.active || rogue.snake.length === 0) {
    return null;
  }

  const head = rogue.snake[0];
  const emergingTicks = rogue.emergingTicks ?? 0;
  const options = [];
  const directionsToEvaluate =
    emergingTicks > 0 ? [rogue.direction] : DIRECTION_ORDER;

  for (const direction of directionsToEvaluate) {
    if (
      emergingTicks === 0 &&
      rogue.snake.length > 1 &&
      OPPOSITE_DIRECTIONS[rogue.direction] === direction
    ) {
      continue;
    }

    const directionVector = DIRECTIONS[direction];
    const newHead = {
      x: head.x + directionVector.x,
      y: head.y + directionVector.y
    };

    if (!isInsideBoard(newHead, width, height)) {
      continue;
    }

    const ateFood = Boolean(food) && positionsEqual(newHead, food);
    const bodyToCheck = ateFood ? rogue.snake : rogue.snake.slice(0, -1);
    const hitsOwnBody = bodyToCheck.some((part) => positionsEqual(part, newHead));
    if (hitsOwnBody) {
      continue;
    }

    if (blockedCells.has(toCellKey(newHead))) {
      continue;
    }

    options.push({
      direction,
      newHead,
      ateFood,
      distanceToFood: food ? manhattanDistance(newHead, food) : 0
    });
  }

  if (options.length === 0) {
    return null;
  }

  let bestOptions = options;
  if (food) {
    const bestDistance = Math.min(
      ...options.map((option) => option.distanceToFood)
    );
    bestOptions = options.filter(
      (option) => option.distanceToFood === bestDistance
    );
  }

  const choiceIndex = randomIntInclusive(0, bestOptions.length - 1, randomFn);
  const choice = bestOptions[choiceIndex];
  const snake = [choice.newHead, ...rogue.snake];
  if (!choice.ateFood) {
    snake.pop();
  }

  return {
    rogue: {
      ...rogue,
      active: true,
      direction: choice.direction,
      snake,
      emergingTicks: Math.max(0, emergingTicks - 1)
    },
    ateFood: choice.ateFood
  };
}
