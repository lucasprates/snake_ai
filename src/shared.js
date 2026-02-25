export const OPPOSITE_DIRECTIONS = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT"
};

export function clampRandom(value) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  if (value >= 1) {
    return 0.999999999999;
  }

  return value;
}

export function clampIntRange(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  const integerValue = Math.trunc(value);

  if (integerValue < min) {
    return min;
  }

  if (integerValue > max) {
    return max;
  }

  return integerValue;
}

export function toCellKey(position) {
  return `${position.x},${position.y}`;
}

export function cloneSnake(snake) {
  return snake.map((part) => ({ x: part.x, y: part.y }));
}
