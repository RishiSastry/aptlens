import type {
  EvidenceField,
  EvidenceItem,
  PropertyFacts,
  UnitCandidate,
  UserPreferences,
} from "@aptlens/shared";
import { clamp } from "./math.js";

/** A field is "known" when it has an actual value backed by a non-missing/unclear status. */
export function isKnown<T>(f: EvidenceField<T> | undefined): f is EvidenceField<T> {
  return (
    !!f &&
    f.value !== null &&
    f.value !== undefined &&
    f.status !== "missing" &&
    f.status !== "unclear"
  );
}

/** Extract a known numeric value, or null when missing/non-numeric. */
export function numValue(f: EvidenceField<number | null> | undefined): number | null {
  return isKnown(f) && typeof f.value === "number" ? f.value : null;
}

const fmt = (v: unknown): string => (v === null || v === undefined ? "—" : String(v));

/** Turn a single evidence field into a display row for the evidence drawer. */
export function field<T extends string | number | boolean | null>(
  label: string,
  f: EvidenceField<T> | undefined
): EvidenceItem {
  return {
    label,
    value: f ? fmt(f.value) : "—",
    status: f?.status ?? "missing",
    sourceUrl: f?.sourceUrl,
    snippet: f?.evidenceSnippet,
  };
}

/** The fields that matter for due-diligence completeness, as evidence rows. */
export function buildEvidence(
  unit: UnitCandidate,
  facts: PropertyFacts | undefined,
  prefs: UserPreferences
): EvidenceItem[] {
  const rows: EvidenceItem[] = [
    field("Rent", unit.rent),
    field("Square footage", unit.sqft),
    field("Bedrooms", unit.bedrooms),
    field("Bathrooms", unit.bathrooms),
    field("Available date", unit.availableDate),
  ];

  if (facts) {
    if (prefs.pet.hasPet) {
      rows.push(field("Pets allowed", facts.petAllowed));
      rows.push(field("Pet rent", facts.petRent));
      rows.push(field("Breed restrictions", facts.breedRestrictions));
    }
    if (prefs.parking !== "not_needed") {
      rows.push(field("Parking policy", facts.parkingPolicy));
      rows.push(field("Parking fee", facts.parkingFee));
    }
    rows.push(field("Utilities included", facts.utilitiesIncluded));
  }

  return rows;
}

/** Fraction of relevant evidence rows that are confirmed/likely, scaled 0–100. */
export function evidenceCompletenessScore(evidence: EvidenceItem[]): number {
  if (evidence.length === 0) return 0;
  const known = evidence.filter((e) => e.status === "confirmed" || e.status === "likely").length;
  return clamp((known / evidence.length) * 100);
}

/** Open questions to ask leasing before touring, derived from missing key fields. */
export function buildMissingQuestions(
  unit: UnitCandidate,
  facts: PropertyFacts | undefined,
  prefs: UserPreferences
): string[] {
  const qs: string[] = [];
  if (!isKnown(unit.rent)) qs.push("What is the monthly rent for this unit?");
  if (!isKnown(unit.sqft)) qs.push("What is the square footage?");
  if (!isKnown(unit.availableDate)) qs.push("When is this unit available?");
  if (prefs.pet.hasPet && !isKnown(facts?.petAllowed)) {
    const kind = prefs.pet.type ?? "pet";
    qs.push(`Are ${kind}s allowed, and what are the weight/breed limits and pet rent?`);
  }
  if (
    prefs.parking !== "not_needed" &&
    !isKnown(facts?.parkingPolicy) &&
    !isKnown(facts?.parkingFee)
  ) {
    qs.push("Is parking available, and what does it cost per month?");
  }
  return qs;
}
