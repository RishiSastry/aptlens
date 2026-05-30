import { useState } from "react";
import type { AnalyzeRequest, RankedUnitCard } from "@aptlens/shared";
import { analyzeApartments } from "./api/client";
import { ComparisonCharts } from "./components/ComparisonCharts";
import { ComparisonMatrix } from "./components/ComparisonMatrix";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { IntakeForm } from "./components/IntakeForm";
import { MissingInfoPanel } from "./components/MissingInfoPanel";
import { ProgressTimeline } from "./components/ProgressTimeline";
import { RankedUnitsTable } from "./components/RankedUnitsTable";
import { SummaryCards } from "./components/SummaryCards";
import { TourPlan } from "./components/TourPlan";
import type { AnalyzeResult, AppStatus, ResultsTab } from "./types/ui";

const tabs: Array<{ id: ResultsTab; label: string }> = [
  { id: "tour", label: "Tour Plan" },
  { id: "ranked", label: "Ranked Units" },
  { id: "comparison", label: "Comparison" },
  { id: "missing", label: "Missing Info" },
  { id: "evidence", label: "Evidence" },
];

export default function App() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>("tour");
  const [selectedUnit, setSelectedUnit] = useState<RankedUnitCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(request: AnalyzeRequest) {
    setStatus("analyzing");
    setError(null);
    setSelectedUnit(null);

    try {
      const response = await analyzeApartments(request);
      setResult(response);
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
          <p className="eyebrow">AptLens MVP</p>
          <h1>Apartment due diligence before the tour.</h1>
          <p>
            Paste apartment links and constraints. AptLens turns scattered listings,
            fees, pet rules, floor-plan signals, and missing details into a tour-ready
            action plan.
          </p>
        </div>
      </section>

      <section className="workspace">
        <aside className="intake-panel">
          <div className="section-heading">
            <div>
              <h2>Analyze Listings</h2>
              <p>Demo defaults match the current mock backend response.</p>
            </div>
          </div>
          <IntakeForm disabled={status === "analyzing"} onSubmit={handleAnalyze} />
          <ProgressTimeline status={status} />
          {error && <p className="error-message">{error}</p>}
        </aside>

        <section className="results-panel">
          {!result && (
            <div className="empty-state">
              <h2>Ready for a decision packet</h2>
              <p>
                Run the analysis to see tour priorities, ranked units, comparison
                charts, leasing questions, and evidence.
              </p>
            </div>
          )}

          {result && (
            <>
              <SummaryCards summary={result.summary} />

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
                {activeTab === "tour" && <TourPlan tourPlan={result.tourPlan} />}
                {activeTab === "ranked" && (
                  <RankedUnitsTable
                    units={result.rankedUnits}
                    onSelectUnit={setSelectedUnit}
                  />
                )}
                {activeTab === "comparison" && (
                  <>
                    <ComparisonCharts comparisonViews={result.comparisonViews} />
                    <ComparisonMatrix comparisonViews={result.comparisonViews} />
                  </>
                )}
                {activeTab === "missing" && (
                  <MissingInfoPanel items={result.missingInfo} />
                )}
                {activeTab === "evidence" && (
                  <RankedUnitsTable
                    units={result.rankedUnits}
                    onSelectUnit={setSelectedUnit}
                  />
                )}
              </div>
            </>
          )}
        </section>
      </section>

      <EvidenceDrawer unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </main>
  );
}
