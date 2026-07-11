import { api } from "@/lib/axios";

export interface ActiveScenario {
  scenario: string;
  agentId: string;
  provider: "bkash" | "nagad" | "rocket";
  startedAtVirtual: string;
  expiresAtVirtual: string;
}

export interface SimulationStatus {
  running: boolean;
  speedMultiplier: number;
  virtualNow: string;
  activeScenarios: ActiveScenario[];
}

export interface ScenarioDefinition {
  name: string;
  label: string;
  description: string;
  requiresProvider: boolean;
}

export interface SimBlock {
  id: string;
  name: string;
}

export function getStatus() {
  return api.get<SimulationStatus>("/simulation/status").then((res) => res.data);
}

export function startSimulation(speedMultiplier?: number) {
  return api.post<SimulationStatus>("/simulation/start", { speedMultiplier }).then((res) => res.data);
}

export function stopSimulation() {
  return api.post<SimulationStatus>("/simulation/stop").then((res) => res.data);
}

export function setSpeed(speedMultiplier: number) {
  return api.post<SimulationStatus>("/simulation/speed", { speedMultiplier }).then((res) => res.data);
}

export function listScenarios() {
  return api.get<ScenarioDefinition[]>("/simulation/scenarios").then((res) => res.data);
}

export function listSimBlocks() {
  return api.get<{ blocks: SimBlock[] }>("/simulation/blocks").then((res) => res.data.blocks);
}

export function triggerScenario(input: {
  blockId: string;
  scenario: string;
  provider: "bkash" | "nagad" | "rocket";
  durationSeconds?: number;
}) {
  return api.post<SimulationStatus>("/simulation/scenarios/trigger", input).then((res) => res.data);
}
