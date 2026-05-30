import type { RankedUnitCard, UserPreferences } from "@aptlens/shared";
import type { CostBreakdown } from "./cost.js";
import type { Viability } from "./constraints.js";

export function tourPriorityFor(
  score: number,
  viability: Viability
): RankedUnitCard["tourPriority"] {
  if (viability === "not_viable") return "skip";
  let priority: RankedUnitCard["tourPriority"];
  if (score >= 75) priority = "tour_first";
  else if (score >= 55) priority = "backup";
  else if (score >= 35) priority = "ask_before_touring";
  else priority = "skip";

  // Never auto-skip a unit that's only low because of unknowns.
  if (priority === "skip" && viability === "maybe_viable_needs_clarification") {
    return "ask_before_touring";
  }
  return priority;
}

export function buildTopReasons(
  scores: RankedUnitCard["scores"],
  breakdown: CostBreakdown,
  budget: number | undefined,
  prefs: UserPreferences
): string[] {
  const reasons: string[] = [];
  if (breakdown.knownMonthlyTotal !== undefined && budget !== undefined) {
    const pct = Math.round((breakdown.knownMonthlyTotal / budget) * 100);
    reasons.push(
      `Est. ${breakdown.knownMonthlyTotal.toLocaleString()}/mo known cost (${pct}% of budget)`
    );
  }
  if (prefs.pet.hasPet && scores.petFit >= 80) reasons.push("Pet-friendly per listing");
  if (prefs.worksFromHome && scores.wfhFit >= 70) reasons.push("Good work-from-home fit");
  if (prefs.parking !== "not_needed" && scores.parking >= 80) reasons.push("Parking available");
  if (reasons.length === 0) reasons.push("Awaiting more details to assess fit");
  return reasons.slice(0, 4);
}

export function buildRisks(
  viability: Viability,
  scores: RankedUnitCard["scores"],
  missingQuestions: string[]
): string[] {
  const risks: string[] = [];
  if (viability === "not_viable") risks.push("Fails a hard requirement — likely not viable");
  if (viability === "maybe_viable_needs_clarification") {
    risks.push("Key details unconfirmed — verify before committing");
  }
  if (scores.evidenceCompleteness < 40) risks.push("Sparse listing data — low confidence");
  if (missingQuestions.length > 0) {
    risks.push(
      `${missingQuestions.length} open question${missingQuestions.length > 1 ? "s" : ""} before touring`
    );
  }
  return risks.slice(0, 4);
}
