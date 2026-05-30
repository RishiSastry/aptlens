import type { AnalyzeRequest, AnalyzeResponse, RankedUnitCard } from "@aptlens/shared";
import { titleCase } from "../utils/format";
import { filterUnitsByPreferences } from "../utils/unitFilters";

type ComparisonTablesProps = {
  result: AnalyzeResponse;
  preferences?: AnalyzeRequest["preferences"];
};

export function ComparisonTables({ result, preferences }: ComparisonTablesProps) {
  const units = filterUnitsByPreferences(result.rankedUnits, preferences);
  const unitsByProperty = groupUnitsByProperty(units);
  const insights = buildInsights(units, result);

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
      <section className="insight-panel">
        <h2>What the comparison shows</h2>
        <div className="insight-grid">
          {insights.map((insight) => (
            <article className="insight-card" key={insight.title}>
              <strong>{insight.title}</strong>
              <p>{insight.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="comparison-section">
        <h2>Apartment comparison</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Apartment</th>
                <th>Pet / parking</th>
                <th>Amenities signal</th>
                <th>Known extra fees</th>
                <th>Missing critical info</th>
                <th>Insight</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(unitsByProperty.entries()).map(([propertyName, propertyUnits]) => (
                <tr key={propertyName}>
                  <td>{propertyName}</td>
                  <td>
                    Pet: {titleCase(propertyUnits[0]?.petSignals.petAllowed ?? "unclear")}
                    <span>Parking fee: {missingLabel(propertyUnits, "parking")}</span>
                  </td>
                  <td>
                    Evidence mentions property amenities
                    <span>Confirm coworking, package room, dog wash, EV charging</span>
                  </td>
                  <td>{missingLabel(propertyUnits, "fee")}</td>
                  <td>
                    {propertyUnits
                      .flatMap((unit) => unit.missingQuestions)
                      .slice(0, 2)
                      .join(" ") || "No blocking questions"}
                  </td>
                  <td>{propertyUnits[0]?.topReasons[0] ?? "Needs more evidence"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

function buildInsights(units: RankedUnitCard[], result: AnalyzeResponse) {
  const unknownCostCount = units.filter((unit) => !unit.trueMonthlyCostKnown).length;
  const overBudget = units.filter((unit) => unit.budgetStatus === "over_budget");
  const askFirst = result.tourPlan.askBeforeTouring.length;

  return [
    {
      title: "Cost clarity",
      body:
        unknownCostCount > 0
          ? `${unknownCostCount} units still need rent or fee confirmation before true monthly cost is reliable.`
          : "Every compared unit has a known monthly cost baseline.",
    },
    {
      title: "Property vs. unit evidence",
      body:
        "This tab only compares property-level policy, fees, and amenities. Floor-plan fit lives in Unit Comparison.",
    },
    {
      title: "Before spending tour time",
      body:
        askFirst > 0
          ? `${askFirst} apartments should be emailed first because pet, parking, rent, or layout evidence is incomplete.`
          : "No apartment is currently blocked by missing information.",
    },
    {
      title: "Budget boundary",
      body:
        overBudget.length > 0
          ? `${overBudget.map((unit) => unit.unitName).join(", ")} exceed the target budget before unknown fees.`
          : "No compared unit is clearly over budget from known rent alone.",
    },
  ];
}

function missingLabel(units: RankedUnitCard[], keyword: string) {
  const matches = units.flatMap((unit) =>
    unit.costBreakdown.unknownCostFields.filter((field) => field.includes(keyword))
  );
  return matches.length > 0 ? Array.from(new Set(matches)).join(", ") : "Not flagged";
}
