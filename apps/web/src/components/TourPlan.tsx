import type { AnalyzeResponse, PropertyRecommendation } from "@aptlens/shared";

type TourPlanProps = {
  tourPlan: AnalyzeResponse["tourPlan"];
};

const sections: Array<{
  key: keyof AnalyzeResponse["tourPlan"];
  title: string;
  tone: string;
}> = [
  { key: "tourFirst", title: "Tour First", tone: "good" },
  { key: "askBeforeTouring", title: "Ask Before Touring", tone: "warn" },
  { key: "skip", title: "Skip", tone: "bad" },
];

function Recommendation({ item }: { item: PropertyRecommendation }) {
  return (
    <article className="recommendation">
      <div className="recommendation-header">
        <h3>{item.propertyName}</h3>
        {item.unitsToAskFor.length > 0 && (
          <span>Ask for: {item.unitsToAskFor.join(", ")}</span>
        )}
      </div>

      <ul>
        {item.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      {item.verifyDuringTour.length > 0 && (
        <div className="note-list">
          <strong>Verify during tour</strong>
          <p>{item.verifyDuringTour.join(" ")}</p>
        </div>
      )}

      {item.askBeforeTouring.length > 0 && (
        <div className="note-list">
          <strong>Ask before touring</strong>
          <p>{item.askBeforeTouring.join(" ")}</p>
        </div>
      )}
    </article>
  );
}

export function TourPlan({ tourPlan }: TourPlanProps) {
  return (
    <div className="tour-columns">
      {sections.map((section) => (
        <section className={`tour-section ${section.tone}`} key={section.key}>
          <h2>{section.title}</h2>
          {tourPlan[section.key].map((item) => (
            <Recommendation item={item} key={item.propertyId} />
          ))}
        </section>
      ))}
    </div>
  );
}
