import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyzeResponse } from "@aptlens/shared";

type ComparisonChartsProps = {
  comparisonViews: AnalyzeResponse["comparisonViews"];
};

export function ComparisonCharts({ comparisonViews }: ComparisonChartsProps) {
  return (
    <div className="comparison-grid">
      <section className="chart-panel">
        <h2>Constraint Fit</h2>
        <ResponsiveContainer height={320}>
          <BarChart data={comparisonViews.constraintFit}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="unitLabel" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="cost" fill="#2563eb" name="Cost" />
            <Bar dataKey="petFit" fill="#16a34a" name="Pet" />
            <Bar dataKey="wfhFit" fill="#d97706" name="WFH" />
            <Bar dataKey="parking" fill="#7c3aed" name="Parking" />
            <Bar dataKey="storage" fill="#0891b2" name="Storage" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-panel">
        <h2>Known Monthly Cost</h2>
        <ResponsiveContainer height={320}>
          <BarChart data={comparisonViews.costBreakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="unitLabel" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="baseRent" stackId="cost" fill="#2563eb" name="Rent" />
            <Bar dataKey="parkingFee" stackId="cost" fill="#64748b" name="Parking" />
            <Bar dataKey="petRent" stackId="cost" fill="#16a34a" name="Pet rent" />
            <Bar dataKey="amenityFee" stackId="cost" fill="#d97706" name="Amenity" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="chart-panel wide">
        <h2>Evidence Quality</h2>
        <ResponsiveContainer height={320}>
          <BarChart data={comparisonViews.evidenceQuality}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="unitLabel" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="confirmed" stackId="evidence" fill="#16a34a" name="Confirmed" />
            <Bar dataKey="likely" stackId="evidence" fill="#84cc16" name="Likely" />
            <Bar dataKey="unclear" stackId="evidence" fill="#f59e0b" name="Unclear" />
            <Bar dataKey="missing" stackId="evidence" fill="#ef4444" name="Missing" />
            <Bar dataKey="conflicting" stackId="evidence" fill="#7f1d1d" name="Conflicting" />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
