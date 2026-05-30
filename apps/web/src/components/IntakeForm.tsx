import { useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { AnalyzeRequest } from "@aptlens/shared";

type IntakeFormProps = {
  disabled: boolean;
  onSubmit: (request: AnalyzeRequest) => void;
};

const maxUrlCount = 8;
const apartmentTypeOptions = [
  { value: "studio", label: "Studio" },
  { value: "1b", label: "1 bed" },
  { value: "2b", label: "2 bed" },
  { value: "3b", label: "3 bed" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
] as const;

const bathroomOptions = [
  { value: "1", label: "1 bath" },
  { value: "1.5", label: "1.5 baths" },
  { value: "2", label: "2 baths" },
  { value: "2.5+", label: "2.5+ baths" },
] as const;

const lifestyleOptions = [
  ["worksFromHome", "Work from home"],
  ["hostGuestsOften", "Host guests often"],
] as const;

const spacePriorityOptions = [
  ["largerBedroom", "Larger bedroom"],
  ["largerBathroom", "Larger bathroom"],
  ["largerKitchen", "Larger kitchen"],
  ["largerLivingRoom", "Larger living room"],
  ["moreStorage", "More storage"],
  ["betterWfhLayout", "Better WFH layout"],
  ["outdoorSpace", "Outdoor space"],
] as const;

const amenityOptions = [
  ["grill", "Grill / BBQ"],
  ["pool", "Pool"],
  ["gym", "Gym"],
  ["coworking", "Coworking"],
  ["packageRoom", "Package room"],
  ["dogWash", "Dog wash"],
  ["evCharging", "EV charging"],
] as const;

type ApartmentType = NonNullable<AnalyzeRequest["preferences"]["apartmentTypes"]>[number];

type SpacePreferenceKey = keyof NonNullable<
  AnalyzeRequest["preferences"]["spacePreferences"]
>;

type SpacePriorityKey = Exclude<SpacePreferenceKey, "preferredOrientation">;

type LifestylePreferenceKey = keyof NonNullable<
  AnalyzeRequest["preferences"]["lifestylePreferences"]
>;

type AmenityPreferenceKey = keyof NonNullable<
  AnalyzeRequest["preferences"]["amenityPreferences"]
>;

const defaultLifestylePreferences = {
  worksFromHome: true,
  hostGuestsOften: false,
};

const defaultSpacePreferences = {
  largerBedroom: true,
  largerBathroom: true,
  largerKitchen: false,
  largerLivingRoom: false,
  moreStorage: true,
  betterWfhLayout: false,
  outdoorSpace: false,
  preferredOrientation: "",
};

const defaultAmenityPreferences = {
  grill: true,
  pool: true,
  gym: false,
  coworking: true,
  packageRoom: false,
  dogWash: false,
  evCharging: false,
};

export function IntakeForm({ disabled, onSubmit }: IntakeFormProps) {
  const [urls, setUrls] = useState(["", ""]);
  const [budget, setBudget] = useState("2800");
  const [moveInBy, setMoveInBy] = useState("2026-07-01");
  const [apartmentTypes, setApartmentTypes] = useState<ApartmentType[]>(["1b", "2b"]);
  const [bathrooms, setBathrooms] = useState<string[]>(["1", "2"]);
  const [lifestylePreferences, setLifestylePreferences] = useState(
    defaultLifestylePreferences
  );
  const [spacePreferences, setSpacePreferences] = useState(defaultSpacePreferences);
  const [amenityPreferences, setAmenityPreferences] = useState(defaultAmenityPreferences);
  const [hasPet, setHasPet] = useState(true);
  const [petCount, setPetCount] = useState("1");
  const [petBreed, setPetBreed] = useState("");
  const [petWeight, setPetWeight] = useState("45");
  const [parking, setParking] =
    useState<AnalyzeRequest["preferences"]["parking"]>("required");
  const [parkingPreference, setParkingPreference] =
    useState<NonNullable<AnalyzeRequest["preferences"]["parkingPreference"]>>("covered");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedUrls = urls.map((url) => url.trim()).filter(Boolean);
    const worksFromHome =
      lifestylePreferences.worksFromHome || spacePreferences.betterWfhLayout;

    onSubmit({
      urls: parsedUrls,
      preferences: {
        budgetMaxMonthly: Number(budget),
        moveInBy,
        bedrooms: apartmentTypes.filter((type) => ["studio", "1b", "2b", "3b"].includes(type)),
        bathrooms,
        apartmentTypes,
        lifestylePreferences,
        spacePreferences,
        amenityPreferences,
        pet: {
          hasPet,
          type: hasPet ? "dog" : undefined,
          count: hasPet ? Number(petCount) : undefined,
          breed: hasPet && petBreed.trim() ? petBreed.trim() : undefined,
          weightLb: hasPet ? Number(petWeight) : undefined,
        },
        parking,
        parkingPreference,
        worksFromHome,
        priorities: {
          cost: 9,
          petFit: hasPet ? 9 : 4,
          wfhFit: worksFromHome || spacePreferences.betterWfhLayout ? 9 : 5,
          parking: parking === "required" ? 9 : 5,
          storage: spacePreferences.moreStorage ? 8 : 4,
          evidenceCompleteness: 7,
        },
      },
    });
  }

  function toggleApartmentType(value: ApartmentType) {
    setApartmentTypes((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function toggleBathroom(value: string) {
    setBathrooms((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  function toggleLifestylePreference(key: LifestylePreferenceKey) {
    setLifestylePreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleSpacePreference(key: SpacePriorityKey) {
    setSpacePreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleAmenityPreference(key: AmenityPreferenceKey) {
    setAmenityPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  return (
    <form className="intake" onSubmit={handleSubmit}>
      <section className="form-section">
        <div className="field-row">
          <span className="field-label">Apartment URLs</span>
          <span className="field-count">{parsedUrlCount(urls)} / {maxUrlCount}</span>
        </div>

        <div className="url-slots">
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
        </div>

        <button
          className="secondary-action add-url"
          type="button"
          onClick={() => setUrls([...urls, ""])}
          disabled={disabled || urls.length >= maxUrlCount}
        >
          <Plus size={17} />
          Add apartment
        </button>
      </section>

      <section className="form-section">
        <span className="field-label">Must Have</span>
        <div className="field-grid">
          <label>
            Monthly budget
            <input
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              type="number"
              min="0"
              disabled={disabled}
            />
          </label>
          <label>
            Move-in by
            <input
              value={moveInBy}
              onChange={(event) => setMoveInBy(event.target.value)}
              type="date"
              disabled={disabled}
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <span className="field-label">Nice To Have</span>
        <div className="preference-group">
          <span className="field-subtitle">Apartment type</span>
          <div className="choice-grid">
            {apartmentTypeOptions.map((option) => (
              <label className="choice-pill" key={option.value}>
                <input
                  checked={apartmentTypes.includes(option.value)}
                  onChange={() => toggleApartmentType(option.value)}
                  type="checkbox"
                  disabled={disabled}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="preference-group">
          <span className="field-subtitle">Bathrooms</span>
          <div className="choice-grid">
            {bathroomOptions.map((option) => (
              <label className="choice-pill" key={option.value}>
                <input
                  checked={bathrooms.includes(option.value)}
                  onChange={() => toggleBathroom(option.value)}
                  type="checkbox"
                  disabled={disabled}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="preference-group">
          <span className="field-subtitle">Lifestyle</span>
          <div className="choice-grid">
            {lifestyleOptions.map(([key, label]) => (
              <label className="choice-pill" key={key}>
                <input
                  checked={lifestylePreferences[key]}
                  onChange={() => toggleLifestylePreference(key)}
                  type="checkbox"
                  disabled={disabled}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="preference-group">
          <div className="field-row">
            <span className="field-subtitle">Space Priorities</span>
            <span className="field-count">{selectedSpacePriorityCount(spacePreferences)} / 3</span>
          </div>
          <div className="choice-grid">
            {spacePriorityOptions.map(([key, label]) => (
              <label className="choice-pill" key={key}>
                <input
                  checked={Boolean(spacePreferences[key])}
                  onChange={() => toggleSpacePreference(key)}
                  type="checkbox"
                  disabled={
                    disabled ||
                    (!spacePreferences[key] &&
                      selectedSpacePriorityCount(spacePreferences) >= 3)
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <label>
          Orientation preference
          <input
            value={spacePreferences.preferredOrientation}
            onChange={(event) =>
              setSpacePreferences((current) => ({
                ...current,
                preferredOrientation: event.target.value,
              }))
            }
            placeholder="Optional, e.g. south-facing, east-facing, high floor"
            disabled={disabled}
          />
        </label>
      </section>

      <section className="form-section">
        <span className="field-label">Pets</span>
        <label className="checkbox-field">
          <input
            checked={hasPet}
            onChange={(event) => setHasPet(event.target.checked)}
            type="checkbox"
            disabled={disabled}
          />
          I have a pet
        </label>
        <div className="field-grid">
          <label>
            Number of pets
            <input
              value={petCount}
              onChange={(event) => setPetCount(event.target.value)}
              type="number"
              min="1"
              disabled={disabled || !hasPet}
            />
          </label>
          <label>
            Breed
            <input
              value={petBreed}
              onChange={(event) => setPetBreed(event.target.value)}
              placeholder="Optional"
              disabled={disabled || !hasPet}
            />
          </label>
          <label>
            Weight
            <input
              value={petWeight}
              onChange={(event) => setPetWeight(event.target.value)}
              type="number"
              min="0"
              disabled={disabled || !hasPet}
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <span className="field-label">Parking</span>
        <div className="field-grid">
          <label>
            Parking need
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
          <label>
            Parking type
            <select
              value={parkingPreference}
              onChange={(event) =>
                setParkingPreference(
                  event.target.value as NonNullable<
                    AnalyzeRequest["preferences"]["parkingPreference"]
                  >
                )
              }
              disabled={disabled}
            >
              <option value="covered">Covered</option>
              <option value="outdoor">Outdoor</option>
              <option value="either">Either</option>
            </select>
          </label>
        </div>
      </section>

      <details className="form-section advanced-preferences">
        <summary>Amenities</summary>
        <div className="choice-grid">
          {amenityOptions.map(([key, label]) => (
            <label className="choice-pill" key={key}>
              <input
                checked={amenityPreferences[key]}
                onChange={() => toggleAmenityPreference(key)}
                type="checkbox"
                disabled={disabled}
              />
              {label}
            </label>
          ))}
        </div>
      </details>

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

function selectedSpacePriorityCount(
  spacePreferences: typeof defaultSpacePreferences
) {
  return spacePriorityOptions.filter(([key]) => spacePreferences[key]).length;
}
