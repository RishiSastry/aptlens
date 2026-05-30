import type { AnalyzeResponse } from "@aptlens/shared";
import type { PipelineState } from "../state.js";

export async function buildReport(state: PipelineState): Promise<AnalyzeResponse> {
  const { rankedUnits, tourPlan, missingInfo, comparisonViews, artifacts, units } = state;

  const tourFirst       = tourPlan?.tourFirst       ?? [];
  const askBeforeTouring = tourPlan?.askBeforeTouring ?? [];
  const skip            = tourPlan?.skip            ?? [];

  const floorPlansFound = units.filter((u) => u.floorPlanAssets.length > 0).length;

  const response: AnalyzeResponse = {
    summary: {
      propertiesAnalyzed:        state.properties.length,
      unitsFound:                units.length,
      viableUnitsFound:          units.filter((u) => u.viability === "viable").length,
      floorPlansFound,
      missingInfoCount:          missingInfo.length,
      tourFirstCount:            tourFirst.length,
      askBeforeTouringCount:     askBeforeTouring.length,
      skipCount:                 skip.length,
      estimatedTimeSavedMinutes: Math.max(30, units.length * 15),
    },

    tourPlan: { tourFirst, askBeforeTouring, skip },

    rankedUnits,
    missingInfo,

    comparisonViews: comparisonViews ?? {
      constraintFit:      [],
      costBreakdown:      [],
      evidenceQuality:    [],
      petMatrix:          [],
      floorPlanMatrix:    [],
      propertyTourGroups: [],
    },

    artifacts,
  };

  return response;
}
