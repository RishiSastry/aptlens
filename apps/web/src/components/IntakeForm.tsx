import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import type { AnalyzeRequest } from "@aptlens/shared";

type IntakeFormProps = {
  disabled: boolean;
  onSubmit: (request: AnalyzeRequest) => void;
};

const sampleUrls = [
  "https://unionslu.example.com/apartments",
  "https://avalonbelltown.example.com/floorplans",
  "https://pineandminor.example.com/availability",
  "https://harborview.example.com/apartments",
].join("\n");

export function IntakeForm({ disabled, onSubmit }: IntakeFormProps) {
  const [urls, setUrls] = useState(sampleUrls);
  const [budget, setBudget] = useState("2800");
  const [petWeight, setPetWeight] = useState("45");
  const [parking, setParking] =
    useState<AnalyzeRequest["preferences"]["parking"]>("required");
  const [worksFromHome, setWorksFromHome] = useState(true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedUrls = urls
      .split(/\n|,/)
      .map((url) => url.trim())
      .filter(Boolean);

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
      <div>
        <label htmlFor="urls">Apartment URLs</label>
        <textarea
          id="urls"
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          rows={7}
          disabled={disabled}
        />
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
