import type { AnalyzeRequest, AnalyzeResponse, RankedUnitCard } from "@aptlens/shared";
import { formatCurrency, titleCase } from "../utils/format";
import { filterUnitsByPreferences, inferBathLabel } from "../utils/unitFilters";

type TourPlanProps = {
  result: AnalyzeResponse;
  preferences?: AnalyzeRequest["preferences"];
};

const sections = [
  { key: "tour_first", title: "Tour First", tone: "good" },
  { key: "ask_before_touring", title: "Ask Before Touring", tone: "warn" },
  { key: "skip", title: "Skip", tone: "bad" },
] as const;

type SectionKey = (typeof sections)[number]["key"];

export function TourPlan({ result, preferences }: TourPlanProps) {
  const units = filterUnitsByPreferences(result.rankedUnits, preferences);
  const grouped = groupByTourAction(units);

  return (
    <div className="tour-columns">
      {sections.map((section) => (
        <section className={`tour-section ${section.tone}`} key={section.key}>
          <h2>{section.title}</h2>
          {(grouped[section.key] ?? []).length > 0 ? (
            grouped[section.key].map((property) => (
              <Recommendation
                key={`${section.key}-${property.propertyId}`}
                property={property}
                preferences={preferences}
              />
            ))
          ) : (
            <p className="muted">No matching properties in this group.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Recommendation({
  property,
  preferences,
}: {
  property: PropertyUnitGroup;
  preferences?: AnalyzeRequest["preferences"];
}) {
  const primaryUnit = property.units[0];
  const missing = unique(property.units.flatMap((unit) => unit.missingQuestions)).slice(0, 3);
  const questions = buildTourQuestions(property.units).slice(0, 3);
  const matches = buildMatchedPriorities(property.units, preferences).slice(0, 5);

  return (
    <article className="recommendation">
      <div className="recommendation-header">
        <div>
          <h3>{property.propertyName}</h3>
          <span>Ask to see: {property.units.map((unit) => unit.unitName).join(", ")}</span>
        </div>
        <span className={`pill ${property.tourPriority}`}>
          {titleCase(property.tourPriority)}
        </span>
      </div>

      <div className="unit-chip-row">
        {property.units.map((unit) => (
          <span className="unit-chip" key={unit.unitId}>
            {unit.unitName}
            <small>
              {formatCurrency(unit.trueMonthlyCostKnown) ?? "Cost unknown"} · {inferBathLabel(unit)}
            </small>
          </span>
        ))}
      </div>

      <div className="tour-card-grid">
        <div className="scan-list">
          <strong>Matched Priorities</strong>
          {matches.length > 0 ? (
            <ul>
              {matches.map((match) => (
                <li key={match}>{match}</li>
              ))}
            </ul>
          ) : (
            <p>No strong preference match yet.</p>
          )}
        </div>

        <div className="scan-list">
          <strong>Missing Information</strong>
          <ul>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="scan-list">
          <strong>Tour Questions</strong>
          <ul>
            {questions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {primaryUnit.risks.length > 0 && (
        <p className="tour-risk">Watch: {primaryUnit.risks[0]}</p>
      )}
    </article>
  );
}

type PropertyUnitGroup = {
  propertyId: string;
  propertyName: string;
  tourPriority: SectionKey;
  units: RankedUnitCard[];
};

function groupByTourAction(units: RankedUnitCard[]) {
  const grouped: Record<SectionKey, PropertyUnitGroup[]> = {
    tour_first: [],
    ask_before_touring: [],
    skip: [],
  };

  for (const unit of units) {
    const action = getTourAction(unit);
    const existing = grouped[action].find((group) => group.propertyId === unit.propertyId);
    if (existing) {
      existing.units.push(unit);
    } else {
      grouped[action].push({
        propertyId: unit.propertyId,
        propertyName: unit.propertyName,
        tourPriority: action,
        units: [unit],
      });
    }
  }

  return grouped;
}

function getTourAction(unit: RankedUnitCard): SectionKey {
  if (unit.tourPriority === "skip" || unit.budgetStatus === "over_budget") return "skip";
  if (unit.tourPriority === "tour_first") return "tour_first";
  return "ask_before_touring";
}

function buildMatchedPriorities(
  units: RankedUnitCard[],
  preferences?: AnalyzeRequest["preferences"]
) {
  const prefs = preferences?.spacePreferences;
  const matches: string[] = [];

  if (prefs?.largerBedroom && units.some((unit) => unit.floorPlanSignals.queenBedFit === "confirmed")) {
    matches.push("Bedroom has confirmed queen-bed fit evidence");
  }

  if (prefs?.largerBathroom && units.some((unit) => inferBathLabel(unit).startsWith("2"))) {
    matches.push("Includes 2-bath layouts");
  }

  if (prefs?.largerKitchen) {
    matches.push("Kitchen size needs tour confirmation");
  }

  if (prefs?.largerLivingRoom && units.some((unit) => unit.scores.wfhFit >= 80)) {
    matches.push("Layout suggests flexible living/work space");
  }

  if (prefs?.moreStorage && units.some((unit) => unit.scores.storage >= 80)) {
    matches.push("Strong storage signal compared with other units");
  }

  if (prefs?.betterWfhLayout && units.some((unit) => unit.floorPlanSignals.deskFit === "confirmed")) {
    matches.push("Desk fit is confirmed or strongly supported");
  }

  if (prefs?.outdoorSpace) {
    matches.push("Outdoor space still needs confirmation");
  }

  return unique(matches);
}

function buildTourQuestions(units: RankedUnitCard[]) {
  return unique([
    ...units.flatMap((unit) => unit.missingQuestions),
    "Can you confirm whether the bedroom shape still works after placing a queen bed?",
    "Can you confirm closet type and usable storage depth?",
  ]);
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}
