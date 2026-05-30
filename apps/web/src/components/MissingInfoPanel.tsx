import { Clipboard } from "lucide-react";
import type { MissingInfoItem } from "@aptlens/shared";

type MissingInfoPanelProps = {
  items: MissingInfoItem[];
};

const priorities: MissingInfoItem["priority"][] = [
  "blocking",
  "important",
  "nice_to_have",
];

export function MissingInfoPanel({ items }: MissingInfoPanelProps) {
  function copyQuestions() {
    void navigator.clipboard.writeText(
      items.map((item) => `- ${item.question}`).join("\n")
    );
  }

  return (
    <section className="missing-panel">
      <div className="section-heading">
        <div>
          <h2>Missing Information</h2>
          <p>{items.length} questions to resolve before committing tour time.</p>
        </div>
        <button className="secondary-action" type="button" onClick={copyQuestions}>
          <Clipboard size={17} />
          Copy questions
        </button>
      </div>

      <div className="missing-groups">
        {priorities.map((priority) => {
          const group = items.filter((item) => item.priority === priority);
          return (
            <section className="missing-group" key={priority}>
              <h3>{priority.replace(/_/g, " ")}</h3>
              {group.map((item) => (
                <article className="question-row" key={`${item.field}-${item.question}`}>
                  <strong>
                    {item.propertyName}
                    {item.unitName ? `, ${item.unitName}` : ""}
                  </strong>
                  <p>{item.question}</p>
                  <span>{item.reason}</span>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </section>
  );
}
