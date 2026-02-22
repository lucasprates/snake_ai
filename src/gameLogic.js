export const DEFAULT_GRID_WIDTH = 20;
export const DEFAULT_GRID_HEIGHT = 20;

export const DIRECTIONS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 }
};

export const END_REASONS = {
  HIT_WALL: "HIT_WALL",
  HIT_SELF: "HIT_SELF",
  HIT_ROGUE: "HIT_ROGUE",
  FILLED_BOARD: "FILLED_BOARD"
};

const OPPOSITE_DIRECTIONS = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT"
};

function clampRandom(value) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  if (value >= 1) {
    return 0.999999999999;
  }

  return value;
}

function toKey(position) {
  return `${position.x},${position.y}`;
}

function cloneSnake(snake) {
  return snake.map((part) => ({ x: part.x, y: part.y }));
}

function createInitialSnake(width, height) {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  return [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY }
  ];
}

export function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function isInsideBoard(position, width, height) {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < width &&
    position.y < height
  );
}

export function placeFood(
  snake,
  width,
  height,
  randomFn = Math.random,
  blockedPositions = []
) {
  const occupied = new Set(snake.map(toKey));
  for (const blocked of blockedPositions) {
    occupied.add(toKey(blocked));
  }
  const available = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = { x, y };
      if (!occupied.has(toKey(cell))) {
        available.push(cell);
      }
    }
  }

  if (available.length === 0) {
    return null;
  }

  const randomValue = clampRandom(randomFn());
  const index = Math.floor(randomValue * available.length);
  return available[index];
}

export function createInitialState(options = {}) {
  const width = options.width ?? DEFAULT_GRID_WIDTH;
  const height = options.height ?? DEFAULT_GRID_HEIGHT;
  const direction = options.direction ?? "RIGHT";
  const snake = options.snake ? cloneSnake(options.snake) : createInitialSnake(width, height);
  const randomFn = options.randomFn ?? Math.random;
  const blockedPositions = options.blockedPositions ?? [];
  const hasFoodOption = Object.prototype.hasOwnProperty.call(options, "food");
  const food = hasFoodOption
    ? options.food
    : placeFood(snake, width, height, randomFn, blockedPositions);

  return {
    width,
    height,
    snake,
    direction,
    pendingDirection: direction,
    food,
    score: options.score ?? 0,
    paused: false,
    gameOver: false,
    endReason: null
  };
}

export function setDirection(state, direction) {
  if (!DIRECTIONS[direction]) {
    return state;
  }

  if (
    state.snake.length > 1 &&
    OPPOSITE_DIRECTIONS[state.direction] === direction
  ) {
    return state;
  }

  if (state.pendingDirection === direction) {
    return state;
  }

  return { ...state, pendingDirection: direction };
}

export function togglePause(state) {
  if (state.gameOver) {
    return state;
  }

  return { ...state, paused: !state.paused };
}

export function restartState(state, randomFn = Math.random) {
  return createInitialState({
    width: state.width,
    height: state.height,
    randomFn
  });
}

function resolveStepOptions(randomOrOptions) {
  if (typeof randomOrOptions === "function") {
    return {
      randomFn: randomOrOptions,
      blockedPositions: []
    };
  }

  if (randomOrOptions && typeof randomOrOptions === "object") {
    return {
      randomFn: randomOrOptions.randomFn ?? Math.random,
      blockedPositions: randomOrOptions.blockedPositions ?? []
    };
  }

  return {
    randomFn: Math.random,
    blockedPositions: []
  };
}

export function stepState(state, randomOrOptions = Math.random) {
  const { randomFn, blockedPositions } = resolveStepOptions(randomOrOptions);

  if (state.gameOver || state.paused) {
    return state;
  }

  const nextDirection = state.pendingDirection;
  const directionVector = DIRECTIONS[nextDirection];

  if (!directionVector) {
    return state;
  }

  const head = state.snake[0];
  const newHead = {
    x: head.x + directionVector.x,
    y: head.y + directionVector.y
  };

  if (!isInsideBoard(newHead, state.width, state.height)) {
    return {
      ...state,
      direction: nextDirection,
      pendingDirection: nextDirection,
      gameOver: true,
      endReason: END_REASONS.HIT_WALL
    };
  }

  const ateFood = state.food && positionsEqual(newHead, state.food);
  const bodyToCheck = ateFood ? state.snake : state.snake.slice(0, -1);
  const hitSelf = bodyToCheck.some((part) => positionsEqual(part, newHead));

  if (hitSelf) {
    return {
      ...state,
      direction: nextDirection,
      pendingDirection: nextDirection,
      gameOver: true,
      endReason: END_REASONS.HIT_SELF
    };
  }

  const snake = [newHead, ...state.snake];
  if (!ateFood) {
    snake.pop();
  }

  let food = state.food;
  let gameOver = false;
  let endReason = null;
  const score = state.score + (ateFood ? 1 : 0);

  if (ateFood) {
    food = placeFood(
      snake,
      state.width,
      state.height,
      randomFn,
      blockedPositions
    );
    if (food === null) {
      gameOver = true;
      endReason = END_REASONS.FILLED_BOARD;
    }
  }

  return {
    ...state,
    snake,
    direction: nextDirection,
    pendingDirection: nextDirection,
    food,
    score,
    gameOver,
    endReason
  };
}
