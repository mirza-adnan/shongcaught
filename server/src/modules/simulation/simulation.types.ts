export type Provider = "bkash" | "nagad" | "rocket";
export type TransactionType = "cash_in" | "cash_out" | "send_money" | "payment";

export const SCENARIO_NAMES = [
  "hidden_provider_shortage",
  "cash_and_anomaly_spike",
  "near_identical_amounts",
  "provider_feed_gap",
] as const;

export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export interface ScenarioDefinition {
  name: ScenarioName;
  label: string;
  description: string;
  requiresProvider: boolean;
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    name: "hidden_provider_shortage",
    label: "Hidden provider shortage",
    description:
      "Heavy cash-in demand drains one provider's e-money float while cash and other providers look healthy (Scenario A).",
    requiresProvider: true,
  },
  {
    name: "cash_and_anomaly_spike",
    label: "Liquidity pressure with unusual activity",
    description:
      "Physical cash falls quickly while repeated near-identical transactions appear on one provider (Scenario B).",
    requiresProvider: true,
  },
  {
    name: "near_identical_amounts",
    label: "Near-identical repeated amounts",
    description:
      "A small rotating set of counterparties transact the same amount repeatedly in a short window.",
    requiresProvider: true,
  },
  {
    name: "provider_feed_gap",
    label: "Provider data gap",
    description:
      "Simulates a late/missing provider feed by suppressing new transactions for one provider (Scenario C).",
    requiresProvider: true,
  },
];

export interface ActiveScenario {
  scenario: ScenarioName;
  agentId: string;
  provider: Provider;
  startedAtVirtual: string;
  expiresAtVirtual: string;
}

export interface SimulationStatus {
  running: boolean;
  speedMultiplier: number;
  virtualNow: string;
  activeScenarios: ActiveScenario[];
}
