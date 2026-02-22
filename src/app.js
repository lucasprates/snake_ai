import {
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  END_REASONS,
  createInitialState,
  isInsideBoard,
  placeFood,
  setDirection,
  stepState,
  togglePause
} from "./gameLogic.js";
import {
  clampRogueCount,
  createRogueSlots,
  getActiveRogueSegments,
  getRogueCollisionResult,
  MAX_ROGUE_SNAKES,
  moveRogueSnake,
  randomRespawnTicks,
  spawnRogueSnake,
  toCellKey
} from "./rogueLogic.js";

const TICK_MS = 140;
const DIRECTION_KEYS = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  KeyW: "UP",
  KeyS: "DOWN",
  KeyA: "LEFT",
  KeyD: "RIGHT"
};

const boardElement = document.getElementById("board");
const scoreElement = document.getElementById("score");
const rogueStatusElement = document.getElementById("rogue-status");
const statusElement = document.getElementById("status");
const rogueCountSelect = document.getElementById("rogue-count");
const modalRogueCountSelect = document.getElementById("modal-rogue-count");
const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");
const pauseButton = document.getElementById("pause-btn");
const directionButtons = document.querySelectorAll("[data-direction]");
const modalElement = document.getElementById("game-over-modal");
const modalMessageElement = document.getElementById("modal-message");
const modalRestartButton = document.getElementById("modal-restart-btn");

const boardCells = [];
boardElement.style.setProperty("--grid-width", DEFAULT_GRID_WIDTH.toString());
boardElement.style.setProperty("--grid-height", DEFAULT_GRID_HEIGHT.toString());

for (let y = 0; y < DEFAULT_GRID_HEIGHT; y += 1) {
  for (let x = 0; x < DEFAULT_GRID_WIDTH; x += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    boardCells.push(cell);
    boardElement.append(cell);
  }
}

function getCellIndex(x, y, width) {
  return y * width + x;
}

function getGameOverMessage(reason) {
  if (reason === END_REASONS.HIT_WALL) {
    return "You hit the wall.";
  }

  if (reason === END_REASONS.HIT_ROGUE) {
    return "You hit a rogue snake.";
  }

  if (reason === END_REASONS.FILLED_BOARD) {
    return "You filled the entire board.";
  }

  if (reason === END_REASONS.HIT_SELF) {
    return "You ran into yourself.";
  }

  return "Game finished.";
}

let state = createInitialState();
let rogues = [];
let configuredRogueCount = 0;
let selectedRogueCount = 0;
let sessionStarted = false;

function resetCellClasses() {
  for (const cell of boardCells) {
    cell.className = "cell";
  }
}

function setSelectedRogueCount(value) {
  const clampedValue = clampRogueCount(value);
  selectedRogueCount = clampedValue;
  const valueText = String(clampedValue);
  rogueCountSelect.value = valueText;
  modalRogueCountSelect.value = valueText;
  return clampedValue;
}

function readConfiguredRogueCount() {
  return setSelectedRogueCount(Number.parseInt(rogueCountSelect.value, 10));
}

function readModalConfiguredRogueCount() {
  return setSelectedRogueCount(
    Number.parseInt(modalRogueCountSelect.value, 10)
  );
}

function countActiveRogues() {
  return rogues.filter((rogue) => rogue.active).length;
}

function markPlayerDefeatedByRogue() {
  state = {
    ...state,
    gameOver: true,
    endReason: END_REASONS.HIT_ROGUE
  };
}

function buildSpawnOccupiedCells(excludeRogueId = null) {
  const occupiedCells = new Set();

  for (const part of state.snake) {
    occupiedCells.add(toCellKey(part));
  }

  if (state.food) {
    occupiedCells.add(toCellKey(state.food));
  }

  for (const rogue of rogues) {
    if (!rogue.active || rogue.id === excludeRogueId) {
      continue;
    }

    for (const part of rogue.snake) {
      occupiedCells.add(toCellKey(part));
    }
  }

  return occupiedCells;
}

function spawnRogueAtIndex(index) {
  const slot = rogues[index];
  const occupiedCells = buildSpawnOccupiedCells(slot.id);
  const spawnedRogue = spawnRogueSnake(
    slot.id,
    state.width,
    state.height,
    occupiedCells
  );

  if (spawnedRogue) {
    rogues[index] = spawnedRogue;
    return;
  }

  rogues[index] = {
    ...slot,
    active: false,
    snake: [],
    emergingTicks: 0,
    respawnTicks: randomRespawnTicks()
  };
}

function defeatRogueAtIndex(index) {
  const rogue = rogues[index];
  rogues[index] = {
    ...rogue,
    active: false,
    snake: [],
    emergingTicks: 0,
    respawnTicks: randomRespawnTicks()
  };
}

function respawnFoodWithRogues() {
  const blockedPositions = getActiveRogueSegments(rogues);
  const nextFood = placeFood(
    state.snake,
    state.width,
    state.height,
    Math.random,
    blockedPositions
  );

  state = {
    ...state,
    food: nextFood
  };

  if (nextFood === null) {
    state = {
      ...state,
      gameOver: true,
      endReason: END_REASONS.FILLED_BOARD
    };
  }
}

function tickRogueLifecycle() {
  for (let index = 0; index < rogues.length; index += 1) {
    const rogue = rogues[index];

    if (!rogue.active) {
      if (rogue.respawnTicks > 0) {
        rogues[index] = {
          ...rogue,
          respawnTicks: rogue.respawnTicks - 1
        };
        continue;
      }

      spawnRogueAtIndex(index);
      continue;
    }

    const moved = moveRogueSnake(
      rogue,
      state.food,
      state.width,
      state.height,
      new Set()
    );

    if (!moved) {
      defeatRogueAtIndex(index);
      continue;
    }

    rogues[index] = moved.rogue;

    if (moved.ateFood) {
      respawnFoodWithRogues();
      if (state.gameOver) {
        return;
      }
    }
  }
}

function resolveRogueCollisions(previousPlayerHead, previousRogueHeads) {
  const { defeatedRogueIds, playerDefeated } = getRogueCollisionResult(
    rogues,
    state.snake,
    {
      previousPlayerHead,
      previousRogueHeads
    }
  );

  if (defeatedRogueIds.length === 0 && !playerDefeated) {
    return;
  }

  const defeatedSet = new Set(defeatedRogueIds);
  for (let index = 0; index < rogues.length; index += 1) {
    if (!rogues[index].active) {
      continue;
    }

    if (defeatedSet.has(rogues[index].id)) {
      defeatRogueAtIndex(index);
    }
  }

  if (playerDefeated) {
    markPlayerDefeatedByRogue();
  }
}

function startGame(rogueCount) {
  configuredRogueCount = clampRogueCount(rogueCount);
  setSelectedRogueCount(configuredRogueCount);
  state = createInitialState();
  rogues = createRogueSlots(configuredRogueCount);
  sessionStarted = true;

  for (let index = 0; index < rogues.length; index += 1) {
    if (rogues[index].respawnTicks === 0) {
      spawnRogueAtIndex(index);
    }
  }

  render();
}

function render() {
  resetCellClasses();

  if (sessionStarted) {
    for (const rogue of rogues) {
      if (!rogue.active) {
        continue;
      }

      for (const part of rogue.snake) {
        if (!isInsideBoard(part, state.width, state.height)) {
          continue;
        }

        const index = getCellIndex(part.x, part.y, state.width);
        const cell = boardCells[index];
        if (cell) {
          cell.classList.add("rogue");
        }
      }

      const rogueHead = rogue.snake[0];
      if (isInsideBoard(rogueHead, state.width, state.height)) {
        const rogueHeadIndex = getCellIndex(rogueHead.x, rogueHead.y, state.width);
        boardCells[rogueHeadIndex]?.classList.add("rogue-head");
      }
    }

    for (const part of state.snake) {
      if (!isInsideBoard(part, state.width, state.height)) {
        continue;
      }

      const index = getCellIndex(part.x, part.y, state.width);
      const cell = boardCells[index];
      if (cell) {
        cell.classList.add("snake");
      }
    }

    const head = state.snake[0];
    if (isInsideBoard(head, state.width, state.height)) {
      const headIndex = getCellIndex(head.x, head.y, state.width);
      boardCells[headIndex]?.classList.add("head");
    }

    if (state.food && isInsideBoard(state.food, state.width, state.height)) {
      const foodIndex = getCellIndex(state.food.x, state.food.y, state.width);
      boardCells[foodIndex]?.classList.add("food");
    }
  }

  scoreElement.textContent = sessionStarted ? String(state.score) : "0";
  rogueStatusElement.textContent = `${countActiveRogues()}/${configuredRogueCount}`;

  if (!sessionStarted) {
    statusElement.textContent = `Choose rogue snakes (0-${MAX_ROGUE_SNAKES}) and press Start Game.`;
    modalElement.classList.add("hidden");
  } else if (state.gameOver) {
    statusElement.textContent = "Game over. Press Restart.";
    modalMessageElement.textContent = getGameOverMessage(state.endReason);
    modalElement.classList.remove("hidden");
  } else {
    modalElement.classList.add("hidden");

    if (state.paused) {
      statusElement.textContent = "Paused.";
    } else {
      statusElement.textContent = `Use arrows or WASD to move. Rogue snakes active: ${countActiveRogues()}/${configuredRogueCount}.`;
    }
  }

  startButton.textContent = sessionStarted ? "Apply & Restart" : "Start Game";
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  pauseButton.disabled = !sessionStarted || state.gameOver;
  restartButton.disabled = !sessionStarted;
}

function restartGame() {
  if (!sessionStarted) {
    startGame(readConfiguredRogueCount());
    return;
  }

  startGame(selectedRogueCount);
}

window.addEventListener("keydown", (event) => {
  if (!sessionStarted) {
    if (event.code === "KeyR") {
      event.preventDefault();
      startGame(readConfiguredRogueCount());
    }
    return;
  }

  const mappedDirection = DIRECTION_KEYS[event.code];
  if (mappedDirection && !state.gameOver) {
    event.preventDefault();
    state = setDirection(state, mappedDirection);
    return;
  }

  if (event.code === "Space" && !state.gameOver) {
    event.preventDefault();
    state = togglePause(state);
    render();
    return;
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    restartGame();
  }
});

for (const button of directionButtons) {
  button.addEventListener("click", () => {
    if (!sessionStarted || state.gameOver) {
      return;
    }

    const direction = button.getAttribute("data-direction");
    if (direction) {
      state = setDirection(state, direction);
    }
  });
}

pauseButton.addEventListener("click", () => {
  if (!sessionStarted || state.gameOver) {
    return;
  }

  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  restartGame();
});

startButton.addEventListener("click", () => {
  startGame(readConfiguredRogueCount());
});

rogueCountSelect.addEventListener("change", () => {
  readConfiguredRogueCount();
});

modalRogueCountSelect.addEventListener("change", () => {
  readModalConfiguredRogueCount();
});

modalRestartButton.addEventListener("click", () => {
  startGame(readModalConfiguredRogueCount());
});

setInterval(() => {
  if (!sessionStarted) {
    render();
    return;
  }

  const previousPlayerHead = state.snake[0] ? { ...state.snake[0] } : null;
  const previousRogueHeads = new Map();
  for (const rogue of rogues) {
    if (!rogue.active || rogue.snake.length === 0) {
      continue;
    }

    previousRogueHeads.set(rogue.id, { ...rogue.snake[0] });
  }

  const blockedPositions = getActiveRogueSegments(rogues);
  const nextState = stepState(state, {
    randomFn: Math.random,
    blockedPositions
  });
  state = nextState;

  if (!state.gameOver && !state.paused) {
    tickRogueLifecycle();
    resolveRogueCollisions(previousPlayerHead, previousRogueHeads);
  }

  render();
}, TICK_MS);

setSelectedRogueCount(0);
render();
