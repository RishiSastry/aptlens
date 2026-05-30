import { ExternalLink } from "lucide-react";
import type { AnalyzeResponse } from "@aptlens/shared";

type ArtifactLinksProps = {
  artifacts: AnalyzeResponse["artifacts"];
};

const artifactLabels: Array<[keyof AnalyzeResponse["artifacts"], string]> = [
  ["boxProjectUrl", "Box project"],
  ["comparisonReportBoxUrl", "Comparison report"],
  ["missingInfoTrackerBoxUrl", "Missing info tracker"],
  ["tourChecklistBoxUrl", "Tour checklist"],
  ["leasingQuestionsBoxUrl", "Leasing questions"],
];

export function ArtifactLinks({ artifacts }: ArtifactLinksProps) {
  const links = artifactLabels.filter(([key]) => Boolean(artifacts[key]));

  if (links.length === 0) {
    return (
      <section className="artifact-panel">
        <div>
          <h2>Evidence Packet</h2>
          <p>Box artifact links will appear here once report upload is connected.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="artifact-panel">
      <div>
        <h2>Evidence Packet</h2>
        <p>Generated files for reviewing and sharing before the tour.</p>
      </div>
      <div className="artifact-links">
        {links.map(([key, label]) => (
          <a href={artifacts[key]} key={key} target="_blank" rel="noreferrer">
            {label}
            <ExternalLink size={15} />
          </a>
        ))}
      </div>
    </section>
  );
}
