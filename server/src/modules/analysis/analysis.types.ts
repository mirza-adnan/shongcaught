import type { AlertSeverity, AnomalyCategory } from "../../db/schema.js";

export interface VoterResult {
  voter: string;
  fired: boolean;
  category?: AnomalyCategory;
  severity?: AlertSeverity;
  confidence: number;
  rationale: string;
  evidence?: Record<string, unknown>;
}

export function abstain(voter: string, rationale = "No signal from this check."): VoterResult {
  return { voter, fired: false, confidence: 0.2, rationale };
}
