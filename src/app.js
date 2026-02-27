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
import {
  createDefaultHighScores,
  getBestScore,
  migrateHighScores,
  normalizeHighScores,
  toHighScoreRows,
  upsertBestScore
} from "./highScoreLogic.js";
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_MODES,
  getTickMs
} from "./difficultyConfig.js";

const ALL_DIFFICULTIES = Object.values(DIFFICULTY_MODES);
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
const ROGUE_THEME_CLASSES = ["rogue-theme-red", "rogue-theme-blue"];
const DIFFICULTY_LABELS = {
  [DIFFICULTY_MODES.EASY]: "Easy",
  [DIFFICULTY_MODES.MEDIUM]: "Medium",
  [DIFFICULTY_MODES.HARD]: "Hard",
  [DIFFICULTY_MODES.STORY]: "Story"
};

const boardElement = document.getElementById("board");
const scoreElement = document.getElementById("score");
const rogueStatusElement = document.getElementById("rogue-status");
const statusElement = document.getElementById("status");
const rogueCountSelect = document.getElementById("rogue-count");
const modalRogueCountSelect = document.getElementById("modal-rogue-count");
const difficultySelect = document.getElementById("difficulty");
const modalDifficultySelect = document.getElementById("modal-difficulty");
const startButton = document.getElementById("start-btn");
const restartButton = document.getElementById("restart-btn");
const pauseButton = document.getElementById("pause-btn");
const controlsToggleButton = document.getElementById("controls-toggle-btn");
const directionButtons = document.querySelectorAll("[data-direction]");
const controlsElement = document.querySelector(".controls");
const modalElement = document.getElementById("game-over-modal");
const modalMessageElement = document.getElementById("modal-message");
const modalScoreElement = document.getElementById("modal-score");
const modalRestartButton = document.getElementById("modal-restart-btn");
const bestAiCountElement = document.getElementById("best-ai-count");
const bestDifficultyElement = document.getElementById("best-difficulty");
const highScoreElement = document.getElementById("high-score");
const scoresToggleButton = document.getElementById("scores-toggle-btn");
const scoresPanelElement = document.getElementById("scores-panel");
const scoresListElement = document.getElementById("scores-list");
const HIGH_SCORES_STORAGE_KEY = "snake_highScoresByAiCount";
const LEGACY_HIGH_SCORE_STORAGE_KEY = "snake_highScore";

const boardCells = [];
boardElement.style.setProperty("--grid-width", DEFAULT_GRID_WIDTH.toString());
boardElement.style.setProperty("--grid-height", DEFAULT_GRID_HEIGHT.toString());

for (let y = 0; y < DEFAULT_GRID_HEIGHT; y += 1) {
  for (let x = 0; x < DEFAULT_GRID_WIDTH; x += 1) {
    const cell = document.createElement("div");
    const tileClass = (x + y) % 2 === 0 ? "tile-even" : "tile-odd";
    cell.className = `cell ${tileClass}`;
    cell.dataset.baseClass = cell.className;
    boardCells.push(cell);
    boardElement.append(cell);
  }
}

function getCellIndex(x, y, width) {
  return y * width + x;
}

function getDirectionNameFromDelta(deltaX, deltaY) {
  if (deltaX === 1 && deltaY === 0) {
    return "RIGHT";
  }

  if (deltaX === -1 && deltaY === 0) {
    return "LEFT";
  }

  if (deltaX === 0 && deltaY === -1) {
    return "UP";
  }

  if (deltaX === 0 && deltaY === 1) {
    return "DOWN";
  }

  return null;
}

function getDirectionName(from, to) {
  return getDirectionNameFromDelta(to.x - from.x, to.y - from.y);
}

function toDirectionClass(direction) {
  if (direction === "UP") {
    return "dir-up";
  }

  if (direction === "DOWN") {
    return "dir-down";
  }

  if (direction === "LEFT") {
    return "dir-left";
  }

  return "dir-right";
}

function getTurnClass(directionA, directionB) {
  if (!directionA || !directionB) {
    return null;
  }

  const hasUp = directionA === "UP" || directionB === "UP";
  const hasDown = directionA === "DOWN" || directionB === "DOWN";
  const hasLeft = directionA === "LEFT" || directionB === "LEFT";
  const hasRight = directionA === "RIGHT" || directionB === "RIGHT";

  if (hasUp && hasRight) {
    return "turn-ur";
  }

  if (hasRight && hasDown) {
    return "turn-rd";
  }

  if (hasDown && hasLeft) {
    return "turn-dl";
  }

  if (hasLeft && hasUp) {
    return "turn-lu";
  }

  return null;
}

function getStraightDirectionClass(directionA, directionB) {
  const horizontal =
    (directionA === "LEFT" || directionA === "RIGHT") &&
    (directionB === "LEFT" || directionB === "RIGHT");
  if (horizontal) {
    return "dir-right";
  }

  const vertical =
    (directionA === "UP" || directionA === "DOWN") &&
    (directionB === "UP" || directionB === "DOWN");
  if (vertical) {
    return "dir-down";
  }

  return "dir-right";
}

function getRogueThemeClass(rogueId) {
  const themeIndex = Math.abs((rogueId ?? 1) - 1) % ROGUE_THEME_CLASSES.length;
  return ROGUE_THEME_CLASSES[themeIndex];
}

function getSnakeRenderDescriptors(snake, fallbackDirection) {
  if (!snake || snake.length === 0) {
    return [];
  }

  const descriptors = [];

  for (let index = 0; index < snake.length; index += 1) {
    const part = snake[index];

    if (index === 0) {
      const neck = snake[1] ?? null;
      const headDirection = neck
        ? getDirectionName(neck, part)
        : fallbackDirection;
      descriptors.push({
        part,
        roleClass: "segment-head",
        orientationClass: toDirectionClass(headDirection)
      });
      continue;
    }

    if (index === snake.length - 1) {
      const previous = snake[index - 1] ?? null;
      const tailDirection = previous
        ? getDirectionName(previous, part)
        : fallbackDirection;
      descriptors.push({
        part,
        roleClass: "segment-tail",
        orientationClass: toDirectionClass(tailDirection)
      });
      continue;
    }

    const previous = snake[index - 1];
    const next = snake[index + 1];
    const directionToPrevious = getDirectionName(part, previous);
    const directionToNext = getDirectionName(part, next);
    const turnClass = getTurnClass(directionToPrevious, directionToNext);

    if (turnClass) {
      descriptors.push({
        part,
        roleClass: "segment-turn",
        orientationClass: turnClass
      });
      continue;
    }

    descriptors.push({
      part,
      roleClass: "segment-body",
      orientationClass: getStraightDirectionClass(
        directionToPrevious,
        directionToNext
      )
    });
  }

  return descriptors;
}

function paintSnakeSprites(snake, fallbackDirection, ownerClasses) {
  const descriptors = getSnakeRenderDescriptors(snake, fallbackDirection);

  for (const descriptor of descriptors) {
    const { part, roleClass, orientationClass } = descriptor;

    if (!isInsideBoard(part, state.width, state.height)) {
      continue;
    }

    const index = getCellIndex(part.x, part.y, state.width);
    const cell = boardCells[index];
    if (!cell) {
      continue;
    }

    cell.classList.add("segment", roleClass, orientationClass, ...ownerClasses);
    markCellDirty(index);
  }
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

function loadHighScoresByRogueCount() {
  const fallback = createDefaultHighScores(MAX_ROGUE_SNAKES, ALL_DIFFICULTIES);

  try {
    const stored = localStorage.getItem(HIGH_SCORES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const { highScores: migrated, didMigrate } = migrateHighScores(
        parsed,
        MAX_ROGUE_SNAKES,
        DEFAULT_DIFFICULTY
      );
      const normalized = normalizeHighScores(migrated, MAX_ROGUE_SNAKES, ALL_DIFFICULTIES);
      if (didMigrate) {
        try {
          localStorage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify(normalized));
        } catch {
          // localStorage unavailable
        }
      }
      return normalized;
    }

    const legacyStored = localStorage.getItem(LEGACY_HIGH_SCORE_STORAGE_KEY);
    const legacyScore = Number.parseInt(legacyStored, 10);
    if (Number.isFinite(legacyScore) && legacyScore > 0) {
      fallback[`0:${DEFAULT_DIFFICULTY}`] = legacyScore;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function persistHighScoresByRogueCount() {
  try {
    localStorage.setItem(
      HIGH_SCORES_STORAGE_KEY,
      JSON.stringify(highScoresByRogueCount)
    );
  } catch {
    // localStorage unavailable
  }
}

function getDisplayedBestRogueCount() {
  if (sessionStarted) {
    return runRogueCount;
  }

  return selectedRogueCount;
}

function getDisplayedBestDifficulty() {
  if (sessionStarted) {
    return runDifficulty;
  }

  return selectedDifficulty;
}

function toDifficultyLabel(difficulty) {
  return DIFFICULTY_LABELS[difficulty] ?? DIFFICULTY_LABELS[DEFAULT_DIFFICULTY];
}

function renderHighScoreRows(activeRogueCount, difficulty) {
  if (!scoresListElement) {
    return;
  }

  const rows = toHighScoreRows(highScoresByRogueCount, difficulty, MAX_ROGUE_SNAKES);
  const fingerprint = `${difficulty}:${activeRogueCount}:${rows.map((r) => r.bestScore).join(",")}`;

  if (fingerprint === lastHighScoreFingerprint) {
    return;
  }

  lastHighScoreFingerprint = fingerprint;
  scoresListElement.textContent = "";

  for (const row of rows) {
    const item = document.createElement("li");
    if (row.rogueCount === activeRogueCount) {
      item.classList.add("active");
    }

    const label = document.createElement("span");
    label.textContent = `AI ${row.rogueCount}`;

    const value = document.createElement("strong");
    value.textContent = String(row.bestScore);

    item.append(label, value);
    scoresListElement.append(item);
  }
}

let state = createInitialState();
let rogues = [];
let runRogueCount = 0;
let runDifficulty = DEFAULT_DIFFICULTY;
let selectedRogueCount = 0;
let selectedDifficulty = DEFAULT_DIFFICULTY;
let sessionStarted = false;
let highScoresByRogueCount = loadHighScoresByRogueCount();
let gameOverSummary = null;
let didPersistGameOverScore = false;
let controlsVisible = false;
let scoresPanelVisible = false;
let lastHighScoreFingerprint = "";
let modalWasVisible = false;

function setControlsVisible(visible) {
  controlsVisible = visible;
  controlsElement?.classList.toggle("controls-visible", visible);

  if (!controlsToggleButton) {
    return;
  }

  controlsToggleButton.textContent = visible
    ? "Hide On-Screen Controls"
    : "Show On-Screen Controls";
  controlsToggleButton.setAttribute("aria-pressed", visible ? "true" : "false");
}

function setScoresPanelVisible(visible) {
  scoresPanelVisible = visible;
  scoresPanelElement?.classList.toggle("hidden", !visible);

  if (!scoresToggleButton) {
    return;
  }

  scoresToggleButton.textContent = visible
    ? "Hide Best Scores by AI"
    : "Show Best Scores by AI";
  scoresToggleButton.setAttribute("aria-pressed", visible ? "true" : "false");
}

const dirtyCells = new Set();

function markCellDirty(index) {
  dirtyCells.add(index);
}

function resetDirtyCells() {
  for (const index of dirtyCells) {
    const cell = boardCells[index];
    if (cell) {
      cell.className = cell.dataset.baseClass ?? "cell";
    }
  }
  dirtyCells.clear();
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

function setSelectedDifficulty(value) {
  const validated = ALL_DIFFICULTIES.includes(value) ? value : DEFAULT_DIFFICULTY;
  selectedDifficulty = validated;
  difficultySelect.value = validated;
  modalDifficultySelect.value = validated;
  return validated;
}

function readConfiguredDifficulty() {
  return setSelectedDifficulty(difficultySelect.value);
}

function readModalConfiguredDifficulty() {
  return setSelectedDifficulty(modalDifficultySelect.value);
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
    food: nextFood,
    ...(nextFood === null && {
      gameOver: true,
      endReason: END_REASONS.FILLED_BOARD
    })
  };
}

function addSnakeToOccupancy(occupancyByCell, snake) {
  for (const part of snake) {
    const key = toCellKey(part);
    occupancyByCell.set(key, (occupancyByCell.get(key) ?? 0) + 1);
  }
}

function removeSnakeFromOccupancy(occupancyByCell, snake) {
  for (const part of snake) {
    const key = toCellKey(part);
    const nextCount = (occupancyByCell.get(key) ?? 0) - 1;
    if (nextCount <= 0) {
      occupancyByCell.delete(key);
    } else {
      occupancyByCell.set(key, nextCount);
    }
  }
}

function createRogueOccupancyByCell() {
  const occupancyByCell = new Map();

  for (const rogue of rogues) {
    if (!rogue.active) {
      continue;
    }

    addSnakeToOccupancy(occupancyByCell, rogue.snake);
  }

  return occupancyByCell;
}

function createOtherRogueBlockedLookup(occupancyByCell, snake) {
  const ownCells = new Set(snake.map(toCellKey));

  return {
    has(cellKey) {
      const occupancyCount = occupancyByCell.get(cellKey) ?? 0;

      if (occupancyCount === 0) {
        return false;
      }

      if (!ownCells.has(cellKey)) {
        return true;
      }

      return occupancyCount > 1;
    }
  };
}

function tickRogueLifecycle() {
  const occupancyByCell = createRogueOccupancyByCell();

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
      if (rogues[index].active) {
        addSnakeToOccupancy(occupancyByCell, rogues[index].snake);
      }
      continue;
    }

    const blockedCells = createOtherRogueBlockedLookup(
      occupancyByCell,
      rogue.snake
    );
    const moved = moveRogueSnake(
      rogue,
      state.food,
      state.width,
      state.height,
      blockedCells
    );

    if (!moved) {
      removeSnakeFromOccupancy(occupancyByCell, rogue.snake);
      defeatRogueAtIndex(index);
      continue;
    }

    removeSnakeFromOccupancy(occupancyByCell, rogue.snake);
    addSnakeToOccupancy(occupancyByCell, moved.rogue.snake);
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

let tickTimeoutId = null;

function stopTickLoop() {
  if (tickTimeoutId !== null) {
    clearTimeout(tickTimeoutId);
    tickTimeoutId = null;
  }
}

function getCurrentTickMs() {
  return getTickMs(runDifficulty, state.score);
}

function gameTick() {
  if (!sessionStarted) {
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
}

function scheduleTick() {
  if (
    tickTimeoutId !== null ||
    !sessionStarted ||
    state.gameOver ||
    state.paused
  ) {
    return;
  }

  tickTimeoutId = setTimeout(() => {
    tickTimeoutId = null;
    gameTick();
    scheduleTick();
  }, getCurrentTickMs());
}

function restartTickLoop() {
  stopTickLoop();
  scheduleTick();
}

function startGame(rogueCount, difficulty) {
  runRogueCount = clampRogueCount(rogueCount);
  runDifficulty = setSelectedDifficulty(difficulty);
  setSelectedRogueCount(runRogueCount);
  highScoresByRogueCount = loadHighScoresByRogueCount();
  gameOverSummary = null;
  didPersistGameOverScore = false;
  lastHighScoreFingerprint = "";
  state = createInitialState();
  rogues = createRogueSlots(runRogueCount);
  sessionStarted = true;

  for (let index = 0; index < rogues.length; index += 1) {
    if (rogues[index].respawnTicks === 0) {
      spawnRogueAtIndex(index);
    }
  }

  restartTickLoop();
  render();
}

function render() {
  resetDirtyCells();
  const activeRogueCount = countActiveRogues();

  if (sessionStarted) {
    for (const rogue of rogues) {
      if (!rogue.active) {
        continue;
      }

      paintSnakeSprites(rogue.snake, rogue.direction, [
        "rogue",
        getRogueThemeClass(rogue.id)
      ]);
    }

    paintSnakeSprites(state.snake, state.direction, ["player"]);

    if (state.food && isInsideBoard(state.food, state.width, state.height)) {
      const foodIndex = getCellIndex(state.food.x, state.food.y, state.width);
      if (boardCells[foodIndex]) {
        boardCells[foodIndex].classList.add("food");
        markCellDirty(foodIndex);
      }
    }
  }

  if (!sessionStarted) {
    statusElement.textContent = `Choose rogue snakes (0-${MAX_ROGUE_SNAKES}) and press Start Game.`;
    modalElement.classList.add("hidden");
    gameOverSummary = null;
  } else if (state.gameOver) {
    statusElement.textContent = "Game over. Press Restart.";
    modalMessageElement.textContent = getGameOverMessage(state.endReason);

    if (!didPersistGameOverScore) {
      const updatedScores = upsertBestScore(
        highScoresByRogueCount,
        runRogueCount,
        runDifficulty,
        state.score,
        MAX_ROGUE_SNAKES,
        ALL_DIFFICULTIES
      );
      highScoresByRogueCount = updatedScores.highScores;
      if (updatedScores.isNewRecord) {
        persistHighScoresByRogueCount();
      }

      gameOverSummary = {
        score: state.score,
        rogueCount: runRogueCount,
        difficulty: runDifficulty,
        bestScore: updatedScores.bestScore,
        isNewRecord: updatedScores.isNewRecord
      };
      didPersistGameOverScore = true;
    }

    if (gameOverSummary.isNewRecord && gameOverSummary.score > 0) {
      modalScoreElement.textContent =
        `New Best for AI ${gameOverSummary.rogueCount} ` +
        `(${toDifficultyLabel(gameOverSummary.difficulty)}): ${gameOverSummary.score}!`;
      modalScoreElement.classList.add("new-record");
    } else {
      modalScoreElement.textContent =
        `Score: ${gameOverSummary.score} | ` +
        `Best (AI ${gameOverSummary.rogueCount}, ` +
        `${toDifficultyLabel(gameOverSummary.difficulty)}): ${gameOverSummary.bestScore}`;
      modalScoreElement.classList.remove("new-record");
    }
    modalElement.classList.remove("hidden");
  } else {
    modalElement.classList.add("hidden");
    gameOverSummary = null;

    if (state.paused) {
      statusElement.textContent = "Paused.";
    } else {
      const storySpeed = runDifficulty === DIFFICULTY_MODES.STORY
        ? ` Speed: ${getCurrentTickMs()}ms.`
        : "";
      statusElement.textContent = `Use arrows or WASD to move. Rogue snakes active: ${activeRogueCount}/${runRogueCount}.${storySpeed}`;
    }
  }

  const modalIsVisible = !modalElement.classList.contains("hidden");
  if (modalIsVisible && !modalWasVisible) {
    modalRestartButton.focus();
  } else if (!modalIsVisible && modalWasVisible) {
    startButton.focus();
  }
  modalWasVisible = modalIsVisible;

  const displayedBestRogueCount = getDisplayedBestRogueCount();
  const displayedBestDifficulty = getDisplayedBestDifficulty();
  const displayedBestScore = getBestScore(
    highScoresByRogueCount,
    displayedBestRogueCount,
    displayedBestDifficulty,
    MAX_ROGUE_SNAKES
  );

  renderHighScoreRows(displayedBestRogueCount, displayedBestDifficulty);

  scoreElement.textContent = sessionStarted ? String(state.score) : "0";
  highScoreElement.textContent = String(displayedBestScore);
  if (bestAiCountElement) {
    bestAiCountElement.textContent = String(displayedBestRogueCount);
  }
  if (bestDifficultyElement) {
    bestDifficultyElement.textContent = toDifficultyLabel(displayedBestDifficulty);
  }
  rogueStatusElement.textContent = `${activeRogueCount}/${runRogueCount}`;

  startButton.textContent = sessionStarted ? "Apply & Restart" : "Start Game";
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  pauseButton.disabled = !sessionStarted || state.gameOver;
  restartButton.disabled = !sessionStarted;
}

function restartGame() {
  if (!sessionStarted) {
    startGame(readConfiguredRogueCount(), readConfiguredDifficulty());
    return;
  }

  startGame(selectedRogueCount, selectedDifficulty);
}

window.addEventListener("keydown", (event) => {
  if (!sessionStarted) {
    if (event.code === "KeyR") {
      event.preventDefault();
      startGame(readConfiguredRogueCount(), readConfiguredDifficulty());
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
    if (state.paused) {
      stopTickLoop();
    } else {
      scheduleTick();
    }
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
  if (state.paused) {
    stopTickLoop();
  } else {
    scheduleTick();
  }
  render();
});

restartButton.addEventListener("click", () => {
  restartGame();
});

controlsToggleButton?.addEventListener("click", () => {
  setControlsVisible(!controlsVisible);
});

scoresToggleButton?.addEventListener("click", () => {
  setScoresPanelVisible(!scoresPanelVisible);
});

startButton.addEventListener("click", () => {
  startGame(readConfiguredRogueCount(), readConfiguredDifficulty());
});

rogueCountSelect.addEventListener("change", () => {
  readConfiguredRogueCount();
  render();
});

modalRogueCountSelect.addEventListener("change", () => {
  readModalConfiguredRogueCount();
  render();
});

modalRestartButton.addEventListener("click", () => {
  startGame(readModalConfiguredRogueCount(), readModalConfiguredDifficulty());
});

difficultySelect.addEventListener("change", () => {
  readConfiguredDifficulty();
  lastHighScoreFingerprint = "";
  render();
});

modalDifficultySelect.addEventListener("change", () => {
  readModalConfiguredDifficulty();
  lastHighScoreFingerprint = "";
  render();
});

setSelectedRogueCount(0);
setSelectedDifficulty(DEFAULT_DIFFICULTY);
setControlsVisible(false);
setScoresPanelVisible(false);
render();
