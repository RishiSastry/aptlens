import type { AnalyzeResponse } from "@aptlens/shared";
import { titleCase } from "../utils/format";

type ComparisonMatrixProps = {
  comparisonViews: AnalyzeResponse["comparisonViews"];
};

export function ComparisonMatrix({ comparisonViews }: ComparisonMatrixProps) {
  if (
    comparisonViews.petMatrix.length === 0 &&
    comparisonViews.floorPlanMatrix.length === 0
  ) {
    return null;
  }

  return (
    <div className="matrix-grid">
      <section>
        <h2>Pet Compatibility</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Pets</th>
                <th>Rent</th>
                <th>Deposit</th>
                <th>Weight</th>
                <th>Restrictions</th>
                <th>Fit</th>
              </tr>
            </thead>
            <tbody>
              {comparisonViews.petMatrix.map((row) => (
                <tr key={row.unitId}>
                  <td>{row.unitLabel}</td>
                  <td>{titleCase(row.petsAllowed)}</td>
                  <td>{row.petRent ?? "Unknown"}</td>
                  <td>{row.petDeposit ?? "Unknown"}</td>
                  <td>{row.weightLimit ?? "Unknown"}</td>
                  <td>{titleCase(row.breedRestrictions)}</td>
                  <td>{titleCase(row.compatibility)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Floor Plan / WFH</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Bedroom</th>
                <th>Living room</th>
                <th>Queen</th>
                <th>Desk</th>
                <th>WFH</th>
                <th>Storage</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {comparisonViews.floorPlanMatrix.map((row) => (
                <tr key={row.unitId}>
                  <td>{row.unitLabel}</td>
                  <td>{row.bedroomDimensions ?? "Unknown"}</td>
                  <td>{row.livingRoomDimensions ?? "Unknown"}</td>
                  <td>{titleCase(row.queenBedFit)}</td>
                  <td>{titleCase(row.deskFit)}</td>
                  <td>{row.wfhFitScore}</td>
                  <td>{row.storageScore}</td>
                  <td>{titleCase(row.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
