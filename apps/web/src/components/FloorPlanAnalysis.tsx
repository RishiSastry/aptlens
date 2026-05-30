import { useState } from "react";
import { Eye } from "lucide-react";
import type { AnalyzeRequest, AnalyzeResponse, RankedUnitCard } from "@aptlens/shared";
import { formatCurrency, titleCase } from "../utils/format";
import { filterUnitsByPreferences, inferBathLabel } from "../utils/unitFilters";
import { EvidenceDrawer } from "./EvidenceDrawer";

type FloorPlanAnalysisProps = {
  result: AnalyzeResponse;
  preferences?: AnalyzeRequest["preferences"];
};

export function FloorPlanAnalysis({ result, preferences }: FloorPlanAnalysisProps) {
  const [selectedUnit, setSelectedUnit] = useState<RankedUnitCard | null>(null);
  const units = filterUnitsByPreferences(result.rankedUnits, preferences);
  const grouped = groupUnitsByProperty(units);

  if (units.length === 0) {
    return (
      <div className="empty-state compact">
        <h2>No matching floor plans</h2>
        <p>Try adding another bedroom type or apartment URL.</p>
      </div>
    );
  }

  return (
    <div className="floor-plan-list">
      <section className="insight-panel">
        <h2>Unit Comparison</h2>
        <p>
          Compare the units side by side first, then open the evidence drawer for
          the insight and source detail behind each row.
        </p>
      </section>

      <section className="comparison-section">
        <h2>All units</h2>
        <UnitTable units={units} onViewEvidence={setSelectedUnit} />
      </section>

      <section className="comparison-section">
        <h2>Grouped by apartment</h2>
        {Array.from(grouped.entries()).map(([propertyName, propertyUnits]) => (
          <div className="same-property-group" key={propertyName}>
            <h3>{propertyName}</h3>
            <UnitTable units={propertyUnits} onViewEvidence={setSelectedUnit} compact />
          </div>
        ))}
      </section>

      <EvidenceDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </div>
  );
}

function UnitTable({
  units,
  onViewEvidence,
  compact = false,
}: {
  units: RankedUnitCard[];
  onViewEvidence: (unit: RankedUnitCard) => void;
  compact?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="unit-comparison-table">
        <thead>
          <tr>
            {!compact && <th>Apartment</th>}
            <th>Unit</th>
            <th>Rent / size</th>
            <th>Bed</th>
            <th>Bath</th>
            <th>Bedroom fit</th>
            <th>Kitchen</th>
            <th>Storage</th>
            <th>WFH</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr key={unit.unitId}>
              {!compact && <td>{unit.propertyName}</td>}
              <td>
                <strong>{unit.unitName}</strong>
                <span className={`pill ${unit.tourPriority}`}>
                  {titleCase(unit.tourPriority)}
                </span>
              </td>
              <td>
                {formatCurrency(unit.trueMonthlyCostKnown)}
                <span>{inferSqft(unit)}</span>
              </td>
              <td>
                {inferBedLabel(unit)}
                {isMissing(unit, "bedroom") && <span className="missing-badge">Dimensions missing</span>}
              </td>
              <td>
                {inferBathLabel(unit)}
                {isMissing(unit, "bath") && <span className="missing-badge">Type missing</span>}
              </td>
              <td>
                Queen: {titleCase(unit.floorPlanSignals.queenBedFit)}
                <span>{bedroomInsight(unit)}</span>
              </td>
              <td>
                {kitchenInsight(unit)}
                {isMissing(unit, "kitchen") && <span className="missing-badge">Needs confirmation</span>}
              </td>
              <td>
                {storageInsight(unit)}
                {isMissing(unit, "closet") && <span className="missing-badge">Closet type missing</span>}
              </td>
              <td>
                Desk: {titleCase(unit.floorPlanSignals.deskFit)}
                <span>{wfhInsight(unit)}</span>
              </td>
              <td>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onViewEvidence(unit)}
                  aria-label={`View evidence for ${unit.unitName}`}
                >
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupUnitsByProperty(units: RankedUnitCard[]) {
  const groups = new Map<string, RankedUnitCard[]>();
  for (const unit of units) {
    groups.set(unit.propertyName, [...(groups.get(unit.propertyName) ?? []), unit]);
  }
  return groups;
}

function inferBedLabel(unit: RankedUnitCard) {
  const text = [
    unit.unitName,
    unit.floorPlanName,
    unit.floorPlanSignals.bedroomDimensions,
    ...unit.evidence.map((item) => item.value),
  ]
    .filter(Boolean)
    .join(" ");
  if (/studio/i.test(text)) return "Studio";
  const match = text.match(/(\d)\s*(bed|bedroom|br)/i);
  return match ? `${match[1]} bed` : "Beds unclear";
}

function inferSqft(unit: RankedUnitCard) {
  const text = [
    unit.floorPlanSignals.bedroomDimensions,
    ...unit.evidence.map((item) => item.value),
  ].join(" ");
  const match = text.match(/([\d,]+)\s*sqft/i);
  return match ? `${match[1]} sqft` : "Sqft unknown";
}

function bedroomInsight(unit: RankedUnitCard) {
  if (unit.floorPlanSignals.bedroomDimensions) return unit.floorPlanSignals.bedroomDimensions;
  return "Dimensions need confirmation";
}

function storageInsight(unit: RankedUnitCard) {
  if (unit.scores.storage >= 80) return "Strong storage signal";
  if (unit.scores.storage >= 60) return "Moderate storage signal";
  return "Closet type unclear";
}

function kitchenInsight(unit: RankedUnitCard) {
  return unit.missingQuestions.some((question) => question.toLowerCase().includes("kitchen"))
    ? "Needs confirmation"
    : "Not flagged";
}

function wfhInsight(unit: RankedUnitCard) {
  if (unit.floorPlanSignals.deskFit === "confirmed") return "Dedicated desk fit evidence";
  if (unit.floorPlanSignals.deskFit === "likely") return "Likely workable";
  return "Needs tour check";
}

function isMissing(unit: RankedUnitCard, keyword: string) {
  return unit.missingQuestions.some((question) =>
    question.toLowerCase().includes(keyword)
  );
}
