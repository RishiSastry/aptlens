import type { EvidenceStatus, FloorPlanAnalysis, RankedUnitCard, UnitCandidate } from "@aptlens/shared";

type FloorPlanSignals = RankedUnitCard["floorPlanSignals"];

/** Map a 0–100 fit score to an evidence status, capped by the analysis confidence. */
function fitStatus(score: number | undefined, confidence: FloorPlanAnalysis["confidence"]): EvidenceStatus {
  if (score === undefined) return "missing";
  if (score >= 65) return confidence === "low" ? "unclear" : "likely";
  if (score >= 35) return "unclear";
  return "missing";
}

const firstDimensions = (rooms: { dimensionsText?: string }[]): string | undefined =>
  rooms.find((r) => r.dimensionsText)?.dimensionsText;

/** Derive the card's floor-plan signals from a unit's vision analysis (or all-missing if none). */
export function floorPlanSignalsFor(unit: UnitCandidate): FloorPlanSignals {
  const fp = unit.floorPlanAnalysis;
  if (!fp) {
    return {
      bedroomDimensions: undefined,
      livingRoomDimensions: undefined,
      queenBedFit: "missing",
      deskFit: "missing",
      floorPlanConfidence: "low",
    };
  }

  return {
    bedroomDimensions: firstDimensions(fp.rooms.bedrooms),
    livingRoomDimensions: firstDimensions(fp.rooms.livingRooms),
    queenBedFit: fitStatus(fp.usabilityScores.bedroomFitScore, fp.confidence),
    deskFit: fitStatus(fp.usabilityScores.wfhFitScore, fp.confidence),
    floorPlanConfidence: fp.confidence,
  };
}
