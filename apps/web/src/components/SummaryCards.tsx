import type { AnalyzeResponse } from "@aptlens/shared";

type SummaryCardsProps = {
  summary: AnalyzeResponse["summary"];
};

const labels: Array<[keyof AnalyzeResponse["summary"], string]> = [
  ["propertiesAnalyzed", "Apartments"],
  ["unitsFound", "Units found"],
  ["missingInfoCount", "Missing details"],
  ["tourFirstCount", "Tour first"],
];

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="summary-grid" aria-label="Analysis summary">
      {labels.map(([key, label]) => (
        <div className="metric" key={key}>
          <strong>{summary[key]}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}
