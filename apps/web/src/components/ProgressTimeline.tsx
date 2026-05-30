import { CheckCircle2, CircleDashed } from "lucide-react";
import type { AppStatus } from "../types/ui";

const steps = [
  "Crawl listings",
  "Extract facts",
  "Analyze floor plans",
  "Compare apartments",
  "Generate tour plan",
  "Save evidence packet",
];

type ProgressTimelineProps = {
  status: AppStatus;
};

export function ProgressTimeline({ status }: ProgressTimelineProps) {
  const active = status === "analyzing";
  const complete = status === "complete";

  return (
    <div className="timeline" aria-live="polite">
      {steps.map((step, index) => {
        const done = complete || (active && index < 3);
        return (
          <div className="timeline-step" key={step}>
            {done ? <CheckCircle2 size={18} /> : <CircleDashed size={18} />}
            <span>{step}</span>
          </div>
        );
      })}
    </div>
  );
}
