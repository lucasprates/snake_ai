import { clampIntRange } from "./shared.js";

function clampRogueCount(value, maxRogueCount) {
  return clampIntRange(value, 0, maxRogueCount);
}

function sanitizeScore(value) {
  return clampIntRange(value, 0, Number.MAX_SAFE_INTEGER);
}

function scoreKey(rogueCount, difficulty) {
  return `${rogueCount}:${difficulty}`;
}

export function createDefaultHighScores(maxRogueCount = 5, difficulties = []) {
  const normalizedMax = clampRogueCount(maxRogueCount, Number.MAX_SAFE_INTEGER);
  const highScores = {};

  if (difficulties.length === 0) {
    for (let count = 0; count <= normalizedMax; count += 1) {
      highScores[String(count)] = 0;
    }
    return highScores;
  }

  for (const diff of difficulties) {
    for (let count = 0; count <= normalizedMax; count += 1) {
      highScores[scoreKey(count, diff)] = 0;
    }
  }

  return highScores;
}

export function normalizeHighScores(rawScores, maxRogueCount = 5, difficulties = []) {
  const normalized = createDefaultHighScores(maxRogueCount, difficulties);

  if (!rawScores || typeof rawScores !== "object") {
    return normalized;
  }

  for (const key of Object.keys(normalized)) {
    if (rawScores[key] !== undefined) {
      normalized[key] = sanitizeScore(rawScores[key]);
    }
  }

  return normalized;
}

export function getBestScore(
  highScores,
  rogueCount,
  difficulty,
  maxRogueCount = 5
) {
  const clampedCount = clampRogueCount(rogueCount, maxRogueCount);
  const key = scoreKey(clampedCount, difficulty);
  return sanitizeScore(highScores?.[key]);
}

export function upsertBestScore(
  highScores,
  rogueCount,
  difficulty,
  score,
  maxRogueCount = 5,
  difficulties = []
) {
  const normalized = normalizeHighScores(highScores, maxRogueCount, difficulties);
  const clampedCount = clampRogueCount(rogueCount, maxRogueCount);
  const key = scoreKey(clampedCount, difficulty);
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

export function toHighScoreRows(highScores, difficulty, maxRogueCount = 5) {
  const rows = [];

  for (let count = 0; count <= maxRogueCount; count += 1) {
    const key = scoreKey(count, difficulty);
    rows.push({
      rogueCount: count,
      bestScore: sanitizeScore(highScores?.[key])
    });
  }

  return rows;
}

export function migrateHighScores(rawScores, maxRogueCount = 5, defaultDifficulty = "MEDIUM") {
  if (!rawScores || typeof rawScores !== "object") {
    return {};
  }

  const migrated = { ...rawScores };
  let didMigrate = false;

  for (let count = 0; count <= maxRogueCount; count += 1) {
    const legacyKey = String(count);
    const newKey = scoreKey(count, defaultDifficulty);

    if (migrated[legacyKey] !== undefined && migrated[newKey] === undefined) {
      migrated[newKey] = migrated[legacyKey];
      delete migrated[legacyKey];
      didMigrate = true;
    }
  }

  return { highScores: migrated, didMigrate };
}
