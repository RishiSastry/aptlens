import type { PropertyCandidate, UnitCandidate } from "@aptlens/shared";
import type { PipelineState } from "../state.js";
import { propertyIdFromUrl, propertyNameFromUrl } from "./crawlUrls.js";

// TODO (Task 7): replace stubs with LLM extraction using
//   extract_property_facts.md, extract_unit_facts.md, extract_pet_policy.md
export async function extractFacts(state: PipelineState): Promise<PipelineState> {
  const { urls } = state.request;

  console.log(`[extractFacts] Building placeholder properties for ${urls.length} URLs`);

  const properties: PropertyCandidate[] = urls.map((url) => {
    const propertyId = propertyIdFromUrl(url);
    const name = propertyNameFromUrl(url);

    return {
      propertyId,
      name,
      url,
      units: [],
      propertyFacts: {
        petAllowed:        { value: null, status: "missing", confidence: "low" },
        petRent:           { value: null, status: "missing", confidence: "low" },
        petDeposit:        { value: null, status: "missing", confidence: "low" },
        oneTimePetFee:     { value: null, status: "missing", confidence: "low" },
        petWeightLimit:    { value: null, status: "missing", confidence: "low" },
        breedRestrictions: { value: null, status: "missing", confidence: "low" },
        parkingFee:        { value: null, status: "missing", confidence: "low" },
        parkingPolicy:     { value: null, status: "missing", confidence: "low" },
        utilitiesIncluded: { value: null, status: "missing", confidence: "low" },
        amenityFee:        { value: null, status: "missing", confidence: "low" },
        applicationFee:    { value: null, status: "missing", confidence: "low" },
        adminFee:          { value: null, status: "missing", confidence: "low" },
        securityDeposit:   { value: null, status: "missing", confidence: "low" },
      },
    };
  });

  // One placeholder unit per property until real extraction runs
  const units: UnitCandidate[] = properties.map((prop, i) => ({
    unitId:       `${prop.propertyId}-unit-1`,
    propertyId:   prop.propertyId,
    propertyName: prop.name,
    unitName:     "Unit TBD",
    rent:          { value: null, status: "missing", confidence: "low" },
    sqft:          { value: null, status: "missing", confidence: "low" },
    bedrooms:      { value: null, status: "missing", confidence: "low" },
    bathrooms:     { value: null, status: "missing", confidence: "low" },
    availableDate: { value: null, status: "missing", confidence: "low" },
    floorPlanAssets: [],
    viability: "maybe_viable_needs_clarification",
  }));

  // Attach units back to their properties
  const propertiesWithUnits = properties.map((prop) => ({
    ...prop,
    units: units.filter((u) => u.propertyId === prop.propertyId),
  }));

  return { ...state, properties: propertiesWithUnits, units };
}
