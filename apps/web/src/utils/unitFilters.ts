import type { AnalyzeRequest, RankedUnitCard } from "@aptlens/shared";

type Preferences = AnalyzeRequest["preferences"];

export function filterUnitsByPreferences(
  units: RankedUnitCard[],
  preferences?: Preferences
) {
  return units.filter((unit) => matchesBedroom(unit, preferences));
}

function matchesBedroom(unit: RankedUnitCard, preferences?: Preferences) {
  const selectedBedrooms = preferences?.apartmentTypes?.filter((type) =>
    ["studio", "1b", "2b", "3b"].includes(type)
  );

  if (!selectedBedrooms || selectedBedrooms.length === 0) return true;

  const unitBeds = inferBedroomKey(unit);
  if (!unitBeds) return true;
  return selectedBedrooms.includes(unitBeds);
}

export function inferBedroomKey(unit: RankedUnitCard) {
  const searchable = [
    unit.unitName,
    unit.floorPlanName,
    unit.floorPlanSignals.bedroomDimensions,
    ...unit.evidence.map((item) => item.value),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\bstudio\b/.test(searchable)) return "studio";
  if (/\b1\s*(bed|bedroom|br)\b/.test(searchable)) return "1b";
  if (/\b2\s*(bed|bedroom|br)\b/.test(searchable)) return "2b";
  if (/\b3\s*(bed|bedroom|br)\b/.test(searchable)) return "3b";
  return undefined;
}

export function inferBathLabel(unit: RankedUnitCard) {
  const searchable = [
    unit.floorPlanSignals.bedroomDimensions,
    ...unit.evidence.map((item) => item.value),
  ]
    .filter(Boolean)
    .join(" ");

  const bathMatch = searchable.match(/(\d(?:\.\d)?)\s*bath/i);
  return bathMatch ? `${bathMatch[1]} bath` : "Bath unknown";
}
