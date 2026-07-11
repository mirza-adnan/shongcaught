import { api } from "@/lib/axios";

export interface AgentWithBalances {
  id: string;
  name: string;
  phone: string;
  blockId: string;
  lat: number;
  lng: number;
  cashBalance: string;
  createdAt: string;
  balances: Partial<Record<"bkash" | "nagad" | "rocket", string>>;
}

export interface Block {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  createdAt: string;
}

export function getMyAgent() {
  return api.get<{ agent: AgentWithBalances }>("/agents/me").then((res) => res.data.agent);
}

export function listBlockAgents() {
  return api
    .get<{ block: Block; agents: AgentWithBalances[] }>("/agents")
    .then((res) => res.data);
}
