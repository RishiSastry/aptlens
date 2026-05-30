import { useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { AnalyzeRequest } from "@aptlens/shared";

type IntakeFormProps = {
  disabled: boolean;
  onSubmit: (request: AnalyzeRequest) => void;
};

const maxUrlCount = 8;

export function IntakeForm({ disabled, onSubmit }: IntakeFormProps) {
  const [urls, setUrls] = useState(["", ""]);
  const [budget, setBudget] = useState("2800");
  const [petWeight, setPetWeight] = useState("45");
  const [parking, setParking] =
    useState<AnalyzeRequest["preferences"]["parking"]>("required");
  const [worksFromHome, setWorksFromHome] = useState(true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedUrls = urls.map((url) => url.trim()).filter(Boolean);

    onSubmit({
      urls: parsedUrls,
      preferences: {
        budgetMaxMonthly: Number(budget),
        moveInBy: "2026-07-01",
        bedrooms: ["studio", "1"],
        pet: {
          hasPet: true,
          type: "dog",
          weightLb: Number(petWeight),
        },
        parking,
        worksFromHome,
        priorities: {
          cost: 9,
          petFit: 9,
          wfhFit: 8,
          parking: parking === "required" ? 8 : 4,
          storage: 5,
          evidenceCompleteness: 7,
        },
      },
    });
  }

  return (
    <form className="intake" onSubmit={handleSubmit}>
      <div className="url-slots">
        <div className="field-row">
          <span className="field-label">Apartment URLs</span>
          <span className="field-count">{parsedUrlCount(urls)} / {maxUrlCount}</span>
        </div>

        {urls.map((url, index) => (
          <label className="url-slot" key={`url-${index + 1}`}>
            <span>Apartment {index + 1}</span>
            <div className="url-input-row">
              <input
                value={url}
                onChange={(event) => {
                  const next = [...urls];
                  next[index] = event.target.value;
                  setUrls(next);
                }}
                placeholder="https://example.com/apartments"
                type="url"
                disabled={disabled}
              />
              {urls.length > 2 && (
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => setUrls(urls.filter((_, urlIndex) => urlIndex !== index))}
                  disabled={disabled}
                  aria-label={`Remove apartment ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </label>
        ))}

        <button
          className="secondary-action add-url"
          type="button"
          onClick={() => setUrls([...urls, ""])}
          disabled={disabled || urls.length >= maxUrlCount}
        >
          <Plus size={17} />
          Add apartment
        </button>
      </div>

      <div className="field-grid">
        <label>
          Budget
          <input
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            type="number"
            min="0"
            disabled={disabled}
          />
        </label>

        <label>
          Dog weight
          <input
            value={petWeight}
            onChange={(event) => setPetWeight(event.target.value)}
            type="number"
            min="0"
            disabled={disabled}
          />
        </label>

        <label>
          Parking
          <select
            value={parking}
            onChange={(event) =>
              setParking(event.target.value as AnalyzeRequest["preferences"]["parking"])
            }
            disabled={disabled}
          >
            <option value="required">Required</option>
            <option value="nice_to_have">Nice to have</option>
            <option value="not_needed">Not needed</option>
          </select>
        </label>

        <label className="checkbox-field">
          <input
            checked={worksFromHome}
            onChange={(event) => setWorksFromHome(event.target.checked)}
            type="checkbox"
            disabled={disabled}
          />
          Works from home
        </label>
      </div>

      <button className="primary-action" type="submit" disabled={disabled}>
        <Search size={18} />
        Generate Tour Plan
      </button>
    </form>
  );
}

function parsedUrlCount(urls: string[]) {
  return urls.filter((url) => url.trim()).length;
}
