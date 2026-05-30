import type { EvidenceStatus, PropertyFacts, UnitCandidate, UserPreferences } from "@aptlens/shared";
import { clamp, lerp } from "./math.js";
import { isKnown, numValue } from "./evidence.js";

// --- Pet -------------------------------------------------------------------

export function petScore(facts: PropertyFacts | undefined, prefs: UserPreferences): number {
  if (!prefs.pet.hasPet) return 90; // no pet — not a constraint
  const allowed = facts?.petAllowed;
  if (isKnown(allowed)) {
    if (allowed.value === false) return 0; // hard fail (also flagged not_viable)
    // Allowed — start high, shave for weight/breed concerns we can see.
    let score = 90;
    if (isKnown(facts?.breedRestrictions)) score -= 15;
    if (isKnown(facts?.petWeightLimit)) score -= 5;
    return clamp(score);
  }
  return 40; // unknown — needs confirmation before touring
}

export function petCompatStatus(facts: PropertyFacts | undefined): EvidenceStatus {
  return facts?.petAllowed?.status ?? "missing";
}

// --- Parking ---------------------------------------------------------------

/** True when property facts confirm parking is unavailable. */
export function parkingUnavailable(facts: PropertyFacts | undefined): boolean {
  const policy = facts?.parkingPolicy;
  if (!isKnown(policy) || typeof policy.value !== "string") return false;
  return /no parking|not available|unavailable|none/i.test(policy.value);
}

export function parkingScore(facts: PropertyFacts | undefined, prefs: UserPreferences): number {
  if (prefs.parking === "not_needed") return 90;
  const policyKnown = isKnown(facts?.parkingPolicy) || isKnown(facts?.parkingFee);
  if (parkingUnavailable(facts)) return prefs.parking === "required" ? 0 : 35;
  if (policyKnown) return 85;
  return prefs.parking === "required" ? 40 : 55; // unknown
}

// --- WFH + storage (pre-vision; refined once floor plans analyzed in Task 7) -

export function wfhScore(unit: UnitCandidate, prefs: UserPreferences): number {
  const vision = unit.floorPlanAnalysis?.usabilityScores.wfhFitScore;
  if (typeof vision === "number") return clamp(vision);
  if (!prefs.worksFromHome) return 70; // not a priority
  const beds = numValue(unit.bedrooms);
  const sqft = numValue(unit.sqft);
  if (beds === null && sqft === null) return 45; // unknown
  let score = 45;
  if (beds !== null && beds >= 2) score += 25; // room for a dedicated office
  if (sqft !== null) score += clamp(lerp(sqft, 600, 1100, 0, 25), 0, 25);
  return clamp(score);
}

export function storageScore(unit: UnitCandidate): number {
  const vision = unit.floorPlanAnalysis?.usabilityScores.closetStorageScore;
  if (typeof vision === "number") return clamp(vision);
  const sqft = numValue(unit.sqft);
  if (sqft === null) return 50; // unknown — neutral
  return clamp(lerp(sqft, 600, 1100, 40, 80));
}
