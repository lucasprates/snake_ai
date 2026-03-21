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
  advanceRogueLifecycle,
  clampRogueCount,
  createRogueSlots,
  getActiveRogueSegments,
  getRogueCollisionResult,
  MAX_ROGUE_SNAKES,
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
const SWIPE_MIN_DISTANCE_PX = 18;
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
const scoresDifficultySelect = document.getElementById("scores-difficulty");
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

function getDirectionNameFromSwipe(deltaX, deltaY) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < SWIPE_MIN_DISTANCE_PX && absY < SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  if (absX > absY) {
    return deltaX > 0 ? "RIGHT" : "LEFT";
  }

  if (absY > absX) {
    return deltaY > 0 ? "DOWN" : "UP";
  }

  return null;
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

function appendOverlayClassName(overlayClassNamesByIndex, index, overlayClassName) {
  const existing = overlayClassNamesByIndex[index];
  overlayClassNamesByIndex[index] = existing
    ? `${existing} ${overlayClassName}`
    : overlayClassName;
}

function queueSnakeSprites(
  overlayClassNamesByIndex,
  snake,
  fallbackDirection,
  ownerClasses
) {
  if (!snake || snake.length === 0) {
    return;
  }

  const ownerClassName = ownerClasses.join(" ");

  for (let segmentIndex = 0; segmentIndex < snake.length; segmentIndex += 1) {
    const part = snake[segmentIndex];

    if (!isInsideBoard(part, state.width, state.height)) {
      continue;
    }

    let roleClass = "segment-body";
    let orientationClass = "dir-right";

    if (segmentIndex === 0) {
      const neck = snake[1] ?? null;
      const headDirection = neck
        ? getDirectionName(neck, part)
        : fallbackDirection;
      roleClass = "segment-head";
      orientationClass = toDirectionClass(headDirection);
    } else if (segmentIndex === snake.length - 1) {
      const previous = snake[segmentIndex - 1] ?? null;
      const tailDirection = previous
        ? getDirectionName(previous, part)
        : fallbackDirection;
      roleClass = "segment-tail";
      orientationClass = toDirectionClass(tailDirection);
    } else {
      const previous = snake[segmentIndex - 1];
      const next = snake[segmentIndex + 1];
      const directionToPrevious = getDirectionName(part, previous);
      const directionToNext = getDirectionName(part, next);
      const turnClass = getTurnClass(directionToPrevious, directionToNext);

      orientationClass = turnClass ?? getStraightDirectionClass(
        directionToPrevious,
        directionToNext
      );
      roleClass = turnClass ? "segment-turn" : "segment-body";
    }

    const index = getCellIndex(part.x, part.y, state.width);
    appendOverlayClassName(
      overlayClassNamesByIndex,
      index,
      `segment ${roleClass} ${orientationClass} ${ownerClassName}`
    );
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
let scoresViewDifficulty = DEFAULT_DIFFICULTY;
let lastHighScoreFingerprint = "";
let modalWasVisible = false;
let swipeTouchId = null;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeConsumed = false;
let renderedOverlayClassByIndex = new Array(boardCells.length).fill("");

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
  if (visible) {
    setScoresViewDifficulty(getDisplayedBestDifficulty());
  }
  scoresPanelElement?.classList.toggle("hidden", !visible);

  if (!scoresToggleButton) {
    return;
  }

  scoresToggleButton.textContent = visible
    ? "Close Best Scores"
    : "Show Best Scores";
  scoresToggleButton.setAttribute("aria-pressed", visible ? "true" : "false");
}

function setTextContentIfChanged(element, value) {
  if (element && element.textContent !== value) {
    element.textContent = value;
  }
}

function setDisabledIfChanged(element, value) {
  if (element && element.disabled !== value) {
    element.disabled = value;
  }
}

function setClassToggleIfChanged(element, className, force) {
  if (!element) {
    return;
  }

  const hasClass = element.classList.contains(className);
  if (hasClass !== force) {
    element.classList.toggle(className, force);
  }
}

function applyBoardOverlays(nextOverlayClassNamesByIndex) {
  for (let index = 0; index < boardCells.length; index += 1) {
    const nextOverlayClassName = nextOverlayClassNamesByIndex[index] ?? "";
    const previousOverlayClassName = renderedOverlayClassByIndex[index] ?? "";

    if (nextOverlayClassName === previousOverlayClassName) {
      continue;
    }

    const cell = boardCells[index];
    if (!cell) {
      continue;
    }

    const baseClass = cell.dataset.baseClass ?? "cell";
    cell.className = nextOverlayClassName
      ? `${baseClass} ${nextOverlayClassName}`
      : baseClass;
    renderedOverlayClassByIndex[index] = nextOverlayClassName;
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

function setSelectedDifficulty(value) {
  const validated = ALL_DIFFICULTIES.includes(value) ? value : DEFAULT_DIFFICULTY;
  selectedDifficulty = validated;
  difficultySelect.value = validated;
  modalDifficultySelect.value = validated;
  return validated;
}

function setScoresViewDifficulty(value) {
  const validated = ALL_DIFFICULTIES.includes(value) ? value : DEFAULT_DIFFICULTY;
  scoresViewDifficulty = validated;
  if (scoresDifficultySelect) {
    scoresDifficultySelect.value = validated;
  }
  lastHighScoreFingerprint = "";
  return validated;
}

function readConfiguredDifficulty() {
  return setSelectedDifficulty(difficultySelect.value);
}

function readModalConfiguredDifficulty() {
  return setSelectedDifficulty(modalDifficultySelect.value);
}

function markPlayerDefeatedByRogue() {
  state = {
    ...state,
    gameOver: true,
    endReason: END_REASONS.HIT_ROGUE
  };
}

function buildSpawnOccupiedCells(
  playerSnake,
  currentFood,
  currentRogues,
  excludeRogueId = null
) {
  const occupiedCells = new Set();

  for (const part of playerSnake) {
    occupiedCells.add(toCellKey(part));
  }

  if (currentFood) {
    occupiedCells.add(toCellKey(currentFood));
  }

  for (const rogue of currentRogues) {
    if (!rogue.active || rogue.id === excludeRogueId) {
      continue;
    }

    for (const part of rogue.snake) {
      occupiedCells.add(toCellKey(part));
    }
  }

  return occupiedCells;
}

function createDefeatedRogueSlot(rogue) {
  return {
    ...rogue,
    active: false,
    snake: [],
    emergingTicks: 0,
    respawnTicks: randomRespawnTicks()
  };
}

function createSpawnedRogueSlot(slot, currentRogues, currentFood) {
  const occupiedCells = buildSpawnOccupiedCells(
    state.snake,
    currentFood,
    currentRogues,
    slot.id
  );
  const spawnedRogue = spawnRogueSnake(
    slot.id,
    state.width,
    state.height,
    occupiedCells
  );

  if (spawnedRogue) {
    return spawnedRogue;
  }

  return createDefeatedRogueSlot(slot);
}

function getRespawnedFoodState(currentRogues) {
  const blockedPositions = getActiveRogueSegments(currentRogues);
  const nextFood = placeFood(
    state.snake,
    state.width,
    state.height,
    Math.random,
    blockedPositions
  );

  return {
    food: nextFood,
    ...(nextFood === null && {
      gameOver: true,
      endReason: END_REASONS.FILLED_BOARD
    })
  };
}

function tickRogueLifecycle() {
  const result = advanceRogueLifecycle(rogues, {
    food: state.food,
    width: state.width,
    height: state.height,
    spawnRogue({ rogue, rogues: currentRogues, food }) {
      return createSpawnedRogueSlot(rogue, currentRogues, food);
    },
    defeatRogue({ rogue }) {
      return createDefeatedRogueSlot(rogue);
    },
    respawnFood({ rogues: currentRogues }) {
      return getRespawnedFoodState(currentRogues);
    }
  });

  rogues = result.rogues;

  if (result.food !== state.food || result.gameOver) {
    state = {
      ...state,
      food: result.food,
      ...(result.gameOver && {
        gameOver: true,
        endReason: END_REASONS.FILLED_BOARD
      })
    };
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
      rogues[index] = createDefeatedRogueSlot(rogues[index]);
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
  resetSwipeTracking();

  for (let index = 0; index < rogues.length; index += 1) {
    if (rogues[index].respawnTicks === 0) {
      rogues[index] = createSpawnedRogueSlot(rogues[index], rogues, state.food);
    }
  }

  if (scoresPanelVisible) {
    setScoresViewDifficulty(runDifficulty);
  }

  restartTickLoop();
  render();
}

function render() {
  let activeRogueCount = 0;
  const nextOverlayClassNamesByIndex = new Array(boardCells.length);

  if (sessionStarted) {
    for (const rogue of rogues) {
      if (!rogue.active) {
        continue;
      }

      activeRogueCount += 1;
      queueSnakeSprites(nextOverlayClassNamesByIndex, rogue.snake, rogue.direction, [
        "rogue",
        getRogueThemeClass(rogue.id)
      ]);
    }

    queueSnakeSprites(nextOverlayClassNamesByIndex, state.snake, state.direction, ["player"]);

    if (state.food && isInsideBoard(state.food, state.width, state.height)) {
      const foodIndex = getCellIndex(state.food.x, state.food.y, state.width);
      if (boardCells[foodIndex]) {
        appendOverlayClassName(nextOverlayClassNamesByIndex, foodIndex, "food");
      }
    }
  }

  applyBoardOverlays(nextOverlayClassNamesByIndex);

  if (!sessionStarted) {
    setTextContentIfChanged(
      statusElement,
      `Choose rogue snakes (0-${MAX_ROGUE_SNAKES}) and press Start Game.`
    );
    setClassToggleIfChanged(modalElement, "hidden", true);
    gameOverSummary = null;
  } else if (state.gameOver) {
    setTextContentIfChanged(statusElement, "Game over. Press Restart.");
    setTextContentIfChanged(
      modalMessageElement,
      getGameOverMessage(state.endReason)
    );

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
      setTextContentIfChanged(
        modalScoreElement,
        `New Best for AI ${gameOverSummary.rogueCount} ` +
        `(${toDifficultyLabel(gameOverSummary.difficulty)}): ${gameOverSummary.score}!`
      );
      setClassToggleIfChanged(modalScoreElement, "new-record", true);
    } else {
      setTextContentIfChanged(
        modalScoreElement,
        `Score: ${gameOverSummary.score} | ` +
        `Best (AI ${gameOverSummary.rogueCount}, ` +
        `${toDifficultyLabel(gameOverSummary.difficulty)}): ${gameOverSummary.bestScore}`
      );
      setClassToggleIfChanged(modalScoreElement, "new-record", false);
    }
    setClassToggleIfChanged(modalElement, "hidden", false);
  } else {
    setClassToggleIfChanged(modalElement, "hidden", true);
    gameOverSummary = null;

    if (state.paused) {
      setTextContentIfChanged(statusElement, "Paused.");
    } else {
      const storySpeed = runDifficulty === DIFFICULTY_MODES.STORY
        ? ` Speed: ${getCurrentTickMs()}ms.`
        : "";
      setTextContentIfChanged(
        statusElement,
        `Use arrows, WASD, on-screen controls, or swipe on the board. Rogue snakes active: ${activeRogueCount}/${runRogueCount}.${storySpeed}`
      );
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
  const scoresPanelDifficulty = scoresPanelVisible
    ? scoresViewDifficulty
    : displayedBestDifficulty;

  if (scoresPanelVisible) {
    renderHighScoreRows(displayedBestRogueCount, scoresPanelDifficulty);
  }

  setTextContentIfChanged(scoreElement, sessionStarted ? String(state.score) : "0");
  setTextContentIfChanged(highScoreElement, String(displayedBestScore));
  if (bestAiCountElement) {
    setTextContentIfChanged(bestAiCountElement, String(displayedBestRogueCount));
  }
  if (bestDifficultyElement) {
    setTextContentIfChanged(
      bestDifficultyElement,
      toDifficultyLabel(displayedBestDifficulty)
    );
  }
  setTextContentIfChanged(rogueStatusElement, `${activeRogueCount}/${runRogueCount}`);

  setTextContentIfChanged(
    startButton,
    sessionStarted ? "Apply & Restart" : "Start Game"
  );
  setTextContentIfChanged(pauseButton, state.paused ? "Resume" : "Pause");
  setDisabledIfChanged(pauseButton, !sessionStarted || state.gameOver);
  setDisabledIfChanged(restartButton, !sessionStarted);
}

function restartGame() {
  if (!sessionStarted) {
    startGame(readConfiguredRogueCount(), readConfiguredDifficulty());
    return;
  }

  startGame(selectedRogueCount, selectedDifficulty);
}

function applyDirectionInput(direction) {
  if (!sessionStarted || state.gameOver || !direction) {
    return false;
  }

  // Report whether input was actually accepted so swipe tracking can stay open.
  const nextState = setDirection(state, direction);
  const didChange = nextState !== state;
  state = nextState;
  return didChange;
}

function findTouchByIdentifier(touchList, identifier) {
  if (!touchList || typeof touchList.length !== "number") {
    return null;
  }

  if (identifier === null) {
    return touchList[0] ?? null;
  }

  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList[index];
    if (touch?.identifier === identifier) {
      return touch;
    }
  }

  return null;
}

function resetSwipeTracking() {
  swipeTouchId = null;
  swipeStartX = 0;
  swipeStartY = 0;
  swipeConsumed = false;
}

function startSwipeTracking(event) {
  if (!sessionStarted || state.gameOver) {
    return;
  }

  const touch =
    findTouchByIdentifier(event.changedTouches, null) ??
    findTouchByIdentifier(event.touches, null);

  if (!touch) {
    return;
  }

  swipeTouchId = touch.identifier ?? 0;
  swipeStartX = touch.clientX;
  swipeStartY = touch.clientY;
  swipeConsumed = false;
}

function moveSwipeTracking(event) {
  if (
    !sessionStarted ||
    state.gameOver ||
    swipeTouchId === null ||
    swipeConsumed
  ) {
    return;
  }

  const touch =
    findTouchByIdentifier(event.touches, swipeTouchId) ??
    findTouchByIdentifier(event.changedTouches, swipeTouchId);

  if (!touch) {
    return;
  }

  const direction = getDirectionNameFromSwipe(
    touch.clientX - swipeStartX,
    touch.clientY - swipeStartY
  );

  if (!direction) {
    return;
  }

  if (applyDirectionInput(direction)) {
    event.preventDefault();
    swipeConsumed = true;
  }
}

function endSwipeTracking(event) {
  if (swipeTouchId === null) {
    return;
  }

  const activeTouch = findTouchByIdentifier(event.changedTouches, swipeTouchId);
  if (activeTouch) {
    resetSwipeTracking();
  }
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
  if (mappedDirection && applyDirectionInput(mappedDirection)) {
    event.preventDefault();
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

boardElement.addEventListener("touchstart", startSwipeTracking, {
  passive: true
});
boardElement.addEventListener("touchmove", moveSwipeTracking, {
  passive: false
});
boardElement.addEventListener("touchend", endSwipeTracking);
boardElement.addEventListener("touchcancel", resetSwipeTracking);

for (const button of directionButtons) {
  button.addEventListener("click", () => {
    const direction = button.getAttribute("data-direction");
    applyDirectionInput(direction);
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

scoresDifficultySelect?.addEventListener("change", () => {
  setScoresViewDifficulty(scoresDifficultySelect.value);
  render();
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
  if (scoresPanelVisible && !sessionStarted) {
    setScoresViewDifficulty(selectedDifficulty);
  }
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
