export const DIFFICULTY_MODES = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
  STORY: "STORY"
};

export const DEFAULT_DIFFICULTY = "MEDIUM";

export const DIFFICULTY_TICK_MS = {
  EASY: 220,
  MEDIUM: 160,
  HARD: 90
};

const STORY_BASE_TICK_MS = 160;
const STORY_MIN_TICK_MS = 60;
const STORY_SCORE_STEP = 3;
const STORY_TICK_DECREASE = 12;

export function getStoryTickMs(score) {
  const steps = Math.floor(Math.max(0, score) / STORY_SCORE_STEP);
  const tickMs = STORY_BASE_TICK_MS - steps * STORY_TICK_DECREASE;
  return Math.max(tickMs, STORY_MIN_TICK_MS);
}

export function getTickMs(difficulty, score = 0) {
  if (difficulty === DIFFICULTY_MODES.STORY) {
    return getStoryTickMs(score);
  }

  return DIFFICULTY_TICK_MS[difficulty] ?? DIFFICULTY_TICK_MS[DEFAULT_DIFFICULTY];
}
