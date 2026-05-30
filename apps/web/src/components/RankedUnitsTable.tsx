import { Eye } from "lucide-react";
import type { RankedUnitCard } from "@aptlens/shared";
import { formatCurrency, titleCase } from "../utils/format";

type RankedUnitsTableProps = {
  units: RankedUnitCard[];
  onSelectUnit: (unit: RankedUnitCard) => void;
};

export function RankedUnitsTable({ units, onSelectUnit }: RankedUnitsTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Property</th>
            <th>Unit</th>
            <th>Score</th>
            <th>Known monthly</th>
            <th>Pet fit</th>
            <th>WFH fit</th>
            <th>Priority</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => (
            <tr key={unit.unitId}>
              <td>#{unit.rank}</td>
              <td>{unit.propertyName}</td>
              <td>
                <strong>{unit.unitName}</strong>
                <span>{unit.floorPlanName}</span>
              </td>
              <td>{unit.overallScore}</td>
              <td>{formatCurrency(unit.trueMonthlyCostKnown)}</td>
              <td>{unit.scores.petFit}</td>
              <td>{unit.scores.wfhFit}</td>
              <td>
                <span className={`pill ${unit.tourPriority}`}>
                  {titleCase(unit.tourPriority)}
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onSelectUnit(unit)}
                  aria-label={`View evidence for ${unit.unitName}`}
                >
                  <Eye size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
