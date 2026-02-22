import {
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  END_REASONS,
  createInitialState,
  restartState,
  setDirection,
  stepState,
  togglePause
} from "./gameLogic.js";

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
const statusElement = document.getElementById("status");
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

  if (reason === END_REASONS.FILLED_BOARD) {
    return "You filled the entire board.";
  }

  if (reason === END_REASONS.HIT_SELF) {
    return "You ran into yourself.";
  }

  return "Game finished.";
}

let state = createInitialState();

function resetCellClasses() {
  for (const cell of boardCells) {
    cell.className = "cell";
  }
}

function render() {
  resetCellClasses();

  for (const part of state.snake) {
    const index = getCellIndex(part.x, part.y, state.width);
    const cell = boardCells[index];
    if (cell) {
      cell.classList.add("snake");
    }
  }

  const head = state.snake[0];
  const headIndex = getCellIndex(head.x, head.y, state.width);
  boardCells[headIndex]?.classList.add("head");

  if (state.food) {
    const foodIndex = getCellIndex(state.food.x, state.food.y, state.width);
    boardCells[foodIndex]?.classList.add("food");
  }

  scoreElement.textContent = String(state.score);

  if (state.gameOver) {
    statusElement.textContent = "Game over. Press Restart.";
    modalMessageElement.textContent = getGameOverMessage(state.endReason);
    modalElement.classList.remove("hidden");
  } else {
    modalElement.classList.add("hidden");

    if (state.paused) {
      statusElement.textContent = "Paused.";
    } else {
      statusElement.textContent = "Use arrows or WASD to move.";
    }
  }

  pauseButton.textContent = state.paused ? "Resume" : "Pause";
}

function restartGame() {
  state = restartState(state);
  render();
}

window.addEventListener("keydown", (event) => {
  const mappedDirection = DIRECTION_KEYS[event.code];
  if (mappedDirection) {
    event.preventDefault();
    state = setDirection(state, mappedDirection);
    return;
  }

  if (event.code === "Space") {
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
    const direction = button.getAttribute("data-direction");
    if (direction) {
      state = setDirection(state, direction);
    }
  });
}

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  restartGame();
});

modalRestartButton.addEventListener("click", () => {
  restartGame();
});

setInterval(() => {
  const nextState = stepState(state);
  if (nextState !== state) {
    state = nextState;
  }
  render();
}, TICK_MS);

render();
