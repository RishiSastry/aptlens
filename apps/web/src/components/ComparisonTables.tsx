import { useState } from "react";
import { Eye } from "lucide-react";
import type { AnalyzeRequest, AnalyzeResponse, RankedUnitCard } from "@aptlens/shared";
import { titleCase } from "../utils/format";
import { filterUnitsByPreferences } from "../utils/unitFilters";
import { EvidenceDrawer } from "./EvidenceDrawer";

type ComparisonTablesProps = {
  result: AnalyzeResponse;
  preferences?: AnalyzeRequest["preferences"];
};

export function ComparisonTables({ result, preferences }: ComparisonTablesProps) {
  const [selectedUnit, setSelectedUnit] = useState<RankedUnitCard | null>(null);
  const units = filterUnitsByPreferences(result.rankedUnits, preferences);
  const unitsByProperty = groupUnitsByProperty(units);

  if (units.length === 0) {
    return (
      <div className="empty-state compact">
        <h2>No comparison data yet</h2>
        <p>Comparison tables will appear after unit extraction finds candidates.</p>
      </div>
    );
  }

  return (
    <div className="comparison-tables">
      <section className="comparison-section">
        <h2>Apartment comparison</h2>
        <p className="table-note">
          Selected amenities and policy claims should be confirmed by evidence. Open the eye
          icon to see why each apartment is a stronger or weaker match.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Apartment</th>
                <th>Pet</th>
                <th>Parking</th>
                <th>Amenities signal</th>
                <th>Extra fees</th>
                <th>Preference fit</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(unitsByProperty.entries()).map(([propertyName, propertyUnits]) => (
                <tr key={propertyName}>
                  <td>{propertyName}</td>
                  <td>
                    {titleCase(propertyUnits[0]?.petSignals.petAllowed ?? "unclear")}
                    {hasMissing(propertyUnits, "pet") && <span className="missing-badge">Missing fee or rules</span>}
                  </td>
                  <td>
                    {hasMissing(propertyUnits, "parking") ? (
                      <span className="missing-badge">Parking fee missing</span>
                    ) : (
                      "Not flagged"
                    )}
                  </td>
                  <td>
                    {amenityFit(preferences)}
                  </td>
                  <td>
                    {missingLabel(propertyUnits, "fee")}
                    {missingLabel(propertyUnits, "utilities") !== "Not flagged" && (
                      <span className="missing-badge">Utilities missing</span>
                    )}
                  </td>
                  <td>
                    <span className={`match-badge ${preferenceMatchLevel(propertyUnits, preferences)}`}>
                      {preferenceMatchLabel(propertyUnits, preferences)}
                    </span>
                    <span>{preferenceMatchSummary(propertyUnits, preferences)}</span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setSelectedUnit(propertyUnits[0] ?? null)}
                      aria-label={`View evidence for ${propertyName}`}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <EvidenceDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
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

function missingLabel(units: RankedUnitCard[], keyword: string) {
  const matches = units.flatMap((unit) =>
    unit.costBreakdown.unknownCostFields.filter((field) => field.includes(keyword))
  );
  return matches.length > 0 ? Array.from(new Set(matches)).join(", ") : "Not flagged";
}

function hasMissing(units: RankedUnitCard[], keyword: string) {
  return units.some((unit) =>
    [...unit.costBreakdown.unknownCostFields, ...unit.missingQuestions].some((field) =>
      field.toLowerCase().includes(keyword)
    )
  );
}

function amenityFit(preferences?: AnalyzeRequest["preferences"]) {
  const selected = preferences?.amenityPreferences;
  if (!selected) return "Preferences not selected";
  const labels = [
    selected.grill && "grill",
    selected.pool && "pool",
    selected.coworking && "coworking",
    selected.packageRoom && "package room",
    selected.dogWash && "dog wash",
    selected.evCharging && "EV charging",
  ].filter(Boolean);
  return labels.length > 0 ? `Check: ${labels.join(", ")}` : "No amenity priority selected";
}

function preferenceMatchLevel(
  units: RankedUnitCard[],
  preferences?: AnalyzeRequest["preferences"]
) {
  const hardIssues = [
    preferences?.pet.hasPet && units[0]?.petSignals.petAllowed === "unclear",
    preferences?.parking === "required" && hasMissing(units, "parking"),
  ].filter(Boolean).length;
  const strongSignals = [
    preferences?.lifestylePreferences?.worksFromHome &&
      units.some((unit) => unit.scores.wfhFit >= 80),
    preferences?.spacePreferences?.moreStorage &&
      units.some((unit) => unit.scores.storage >= 80),
  ].filter(Boolean).length;

  if (hardIssues === 0 && strongSignals > 0) return "strong";
  if (hardIssues <= 1) return "medium";
  return "weak";
}

function preferenceMatchLabel(
  units: RankedUnitCard[],
  preferences?: AnalyzeRequest["preferences"]
) {
  const level = preferenceMatchLevel(units, preferences);
  if (level === "strong") return "Strong match";
  if (level === "medium") return "Medium match";
  return "Weak match";
}

function preferenceMatchSummary(
  units: RankedUnitCard[],
  preferences?: AnalyzeRequest["preferences"]
) {
  const signals: string[] = [];
  if (preferences?.pet.hasPet) {
    signals.push(`Pet ${titleCase(units[0]?.petSignals.petAllowed ?? "unclear")}`);
  }
  if (preferences?.parking === "required") {
    signals.push(hasMissing(units, "parking") ? "parking unclear" : "parking not flagged");
  }
  if (preferences?.lifestylePreferences?.worksFromHome) {
    signals.push(units.some((unit) => unit.scores.wfhFit >= 80) ? "WFH units found" : "WFH unclear");
  }
  return signals.slice(0, 2).join(" · ") || "Open evidence for detail";
}
