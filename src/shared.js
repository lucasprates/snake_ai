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

export function cloneSnake(snake) {
  return snake.map((part) => ({ x: part.x, y: part.y }));
}
