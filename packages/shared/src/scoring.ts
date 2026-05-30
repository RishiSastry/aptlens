import type { UserPreferences } from "./types.js";

export type ScoreWeights = {
  cost: number;
  petFit: number;
  wfhFit: number;
  parking: number;
  storage: number;
  evidenceCompleteness: number;
};

export function defaultWeights(): ScoreWeights {
  return { cost: 0.30, petFit: 0.25, wfhFit: 0.20, parking: 0.10, storage: 0.05, evidenceCompleteness: 0.10 };
}

export function weightsFromPreferences(prefs: UserPreferences): ScoreWeights {
  const p = prefs.priorities;
  const total = p.cost + p.petFit + p.wfhFit + p.parking + p.storage + p.evidenceCompleteness || 1;
  return {
    cost: p.cost / total,
    petFit: p.petFit / total,
    wfhFit: p.wfhFit / total,
    parking: p.parking / total,
    storage: p.storage / total,
    evidenceCompleteness: p.evidenceCompleteness / total,
  };
}

export function computeOverallScore(
  scores: Record<keyof ScoreWeights, number>,
  weights: ScoreWeights
): number {
  return (
    scores.cost * weights.cost +
    scores.petFit * weights.petFit +
    scores.wfhFit * weights.wfhFit +
    scores.parking * weights.parking +
    scores.storage * weights.storage +
    scores.evidenceCompleteness * weights.evidenceCompleteness
  );
}
