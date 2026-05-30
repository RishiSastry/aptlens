import { useState } from "react";
import type { AnalyzeRequest } from "@aptlens/shared";
import { analyzeApartments } from "./api/client";
import { ComparisonTables } from "./components/ComparisonTables";
import { FloorPlanAnalysis } from "./components/FloorPlanAnalysis";
import { IntakeForm } from "./components/IntakeForm";
import { MissingInfoPanel } from "./components/MissingInfoPanel";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { SummaryCards } from "./components/SummaryCards";
import { TourPlan } from "./components/TourPlan";
import type { AnalyzeResult, AppStatus, ResultsTab } from "./types/ui";
import { filterUnitsByPreferences } from "./utils/unitFilters";

const tabs: Array<{ id: ResultsTab; label: string }> = [
  { id: "tour", label: "Tour Plan" },
  { id: "apartmentComparison", label: "Apartment Comparison" },
  { id: "unitComparison", label: "Unit Comparison" },
  { id: "missing", label: "Missing Info" },
];

export default function App() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [lastRequest, setLastRequest] = useState<AnalyzeRequest | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>("tour");
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(request: AnalyzeRequest) {
    setStatus("analyzing");
    setError(null);

    try {
      const response = await analyzeApartments(request);
      setResult(response);
      setLastRequest(request);
      setActiveTab("tour");
      setStatus("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
      setStatus("error");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">AptLens</p>
          <h1>Apartment due diligence before the tour.</h1>
          <p>
            Know which properties to tour, which units to ask for, what to email
            before touring, and what to skip because it does not fit your constraints.
          </p>
        </div>
      </section>

      <section className="workspace">
        <aside className="intake-panel">
          <div className="section-heading">
            <div>
              <h2>Start with apartments and preferences</h2>
              <p>Tell AptLens what matters before it compares the units.</p>
            </div>
          </div>
          <IntakeForm disabled={status === "analyzing"} onSubmit={handleAnalyze} />
          <ProgressTimeline status={status} />
          {error && <p className="error-message">{error}</p>}
        </aside>

        <section className="results-panel">
          {!result && (
            <div className="empty-state">
              <h2>Ready for a tour plan</h2>
              <p>
                Add apartment URLs and preferences to get tour priorities, units to
                ask for, leasing-office questions, and clear skip reasons.
              </p>
            </div>
          )}

          {result && (
            <>
              <SummaryCards
                summary={summaryForPreferences(result, lastRequest?.preferences)}
              />

              <nav className="tabs" aria-label="Results tabs">
                {tabs.map((tab) => (
                  <button
                    className={activeTab === tab.id ? "active" : ""}
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="tab-panel">
                {activeTab === "tour" && (
                  <TourPlan
                    result={result}
                    preferences={lastRequest?.preferences}
                  />
                )}
                {activeTab === "apartmentComparison" && (
                  <ComparisonTables
                    result={result}
                    preferences={lastRequest?.preferences}
                  />
                )}
                {activeTab === "unitComparison" && (
                  <FloorPlanAnalysis
                    result={result}
                    preferences={lastRequest?.preferences}
                  />
                )}
                {activeTab === "missing" && (
                  <MissingInfoPanel items={result.missingInfo} />
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function summaryForPreferences(
  result: AnalyzeResult,
  preferences?: AnalyzeRequest["preferences"]
) {
  const units = filterUnitsByPreferences(result.rankedUnits, preferences);
  const propertyIds = new Set(units.map((unit) => unit.propertyId));

  return {
    ...result.summary,
    propertiesAnalyzed: propertyIds.size,
    unitsFound: units.length,
    viableUnitsFound: units.filter((unit) => unit.tourPriority !== "skip").length,
    tourFirstCount: units.filter((unit) => unit.tourPriority === "tour_first").length,
    askBeforeTouringCount: units.filter(
      (unit) => unit.tourPriority === "ask_before_touring"
    ).length,
    skipCount: units.filter(
      (unit) => unit.tourPriority === "skip" || unit.budgetStatus === "over_budget"
    ).length,
  };
}
