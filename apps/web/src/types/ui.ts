import type { AnalyzeResponse, RankedUnitCard } from "@aptlens/shared";

export type ResultsTab =
  | "tour"
  | "apartmentComparison"
  | "unitComparison"
  | "missing";

export type AppStatus = "idle" | "analyzing" | "complete" | "error";

export type AnalyzeResult = AnalyzeResponse;

export type EvidenceSelection = RankedUnitCard | null;
