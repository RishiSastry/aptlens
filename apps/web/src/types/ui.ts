import type { AnalyzeResponse, RankedUnitCard } from "@aptlens/shared";

export type ResultsTab =
  | "tour"
  | "ranked"
  | "comparison"
  | "missing"
  | "evidence";

export type AppStatus = "idle" | "analyzing" | "complete" | "error";

export type AnalyzeResult = AnalyzeResponse;

export type EvidenceSelection = RankedUnitCard | null;
