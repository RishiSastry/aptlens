import { X } from "lucide-react";
import type { RankedUnitCard } from "@aptlens/shared";
import { formatCurrency, titleCase } from "../utils/format";

type EvidenceDrawerProps = {
  unit: RankedUnitCard | null;
  onClose: () => void;
};

export function EvidenceDrawer({ unit, onClose }: EvidenceDrawerProps) {
  if (!unit) {
    return null;
  }

  return (
    <aside className="drawer" aria-label="Evidence drawer">
      <div className="drawer-header">
        <div>
          <span>{unit.propertyName}</span>
          <h2>{unit.unitName}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="drawer-section">
        <h3>Insights</h3>
        <ul>
          {unit.topReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="drawer-section">
        <h3>Cost & unknowns</h3>
        <p>
          Known monthly total:{" "}
          <strong>{formatCurrency(unit.costBreakdown.knownMonthlyTotal)}</strong>
        </p>
        <p>Unknown: {unit.costBreakdown.unknownCostFields.join(", ") || "None"}</p>
      </div>

      <div className="drawer-section">
        <h3>Tour checks</h3>
        <ul>
          {unit.risks.map((risk) => (
            <li key={risk}>{risk}</li>
          ))}
        </ul>
      </div>

      <div className="drawer-section">
        <h3>Evidence</h3>
        {unit.evidence.map((item) => (
          <article className="evidence-item" key={`${item.label}-${item.value}`}>
            <div>
              <strong>{item.label}</strong>
              <span className={`status ${item.status}`}>{titleCase(item.status)}</span>
            </div>
            <p>{item.value}</p>
            {item.snippet && <blockquote>{item.snippet}</blockquote>}
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
