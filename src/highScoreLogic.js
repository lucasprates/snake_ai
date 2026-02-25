import { clampIntRange } from "./shared.js";

function clampRogueCount(value, maxRogueCount) {
  return clampIntRange(value, 0, maxRogueCount);
}

function sanitizeScore(value) {
  return clampIntRange(value, 0, Number.MAX_SAFE_INTEGER);
}

export function createDefaultHighScores(maxRogueCount = 5) {
  const normalizedMax = clampRogueCount(maxRogueCount, Number.MAX_SAFE_INTEGER);
  const highScores = {};

  for (let count = 0; count <= normalizedMax; count += 1) {
    highScores[String(count)] = 0;
  }

  return highScores;
}

export function normalizeHighScores(rawScores, maxRogueCount = 5) {
  const normalized = createDefaultHighScores(maxRogueCount);

  if (!rawScores || typeof rawScores !== "object") {
    return normalized;
  }

  for (let count = 0; count <= maxRogueCount; count += 1) {
    const key = String(count);
    normalized[key] = sanitizeScore(rawScores[key]);
  }

  return normalized;
}

export function getBestScoreForRogueCount(
  highScores,
  rogueCount,
  maxRogueCount = 5
) {
  const normalized = normalizeHighScores(highScores, maxRogueCount);
  const clampedCount = clampRogueCount(rogueCount, maxRogueCount);
  return normalized[String(clampedCount)] ?? 0;
}

export function upsertBestScoreForRogueCount(
  highScores,
  rogueCount,
  score,
  maxRogueCount = 5
) {
  const normalized = normalizeHighScores(highScores, maxRogueCount);
  const clampedCount = clampRogueCount(rogueCount, maxRogueCount);
  const key = String(clampedCount);
  const previousBest = normalized[key] ?? 0;
  const nextCandidate = sanitizeScore(score);
  const bestScore = Math.max(previousBest, nextCandidate);

  return {
    highScores: {
      ...normalized,
      [key]: bestScore
    },
    previousBest,
    bestScore,
    isNewRecord: bestScore > previousBest
  };
}

export function toHighScoreRows(highScores, maxRogueCount = 5) {
  const normalized = normalizeHighScores(highScores, maxRogueCount);
  const rows = [];

  for (let count = 0; count <= maxRogueCount; count += 1) {
    rows.push({
      rogueCount: count,
      bestScore: normalized[String(count)] ?? 0
    });
  }

  return rows;
}
