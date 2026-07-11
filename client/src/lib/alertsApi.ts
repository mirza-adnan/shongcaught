import { api } from "@/lib/axios";

export type AlertType = "liquidity" | "anomaly" | "trend";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "escalated" | "resolved";

export interface LiquidityEvidence {
  windowHours: number;
  sampleCount: number;
  burnPerHour: number;
  currentBalance: number;
  maxGapHours: number;
  hoursToZero: number;
}

export interface AnomalyEvidence {
  windowHours: number;
  transactionCount: number;
}

export interface TrendEvidence {
  windowDays: number;
  weekday: string;
  occurrences: number;
  avgOnDay: number;
  overallAvgPerDay: number;
  ratio: number;
  daysAhead: number;
}

export interface VoterResult {
  voter: string;
  fired: boolean;
  category?: string;
  severity?: AlertSeverity;
  confidence: number;
  rationale: string;
  evidence?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  agentId: string | null;
  provider: "bkash" | "nagad" | "rocket" | null;
  blockId: string;
  title: string;
  description: string;
  banglishSummary: string | null;
  evidence: LiquidityEvidence | AnomalyEvidence | TrendEvidence | Record<string, unknown>;
  confidence: string;
  status: AlertStatus;
  ownerUserId: string | null;
  predictedShortageAt: string | null;
  category: string | null;
  votes: VoterResult[] | null;
  createdAt: string;
  resolvedAt: string | null;
  scenarioTag: string | null;
}

export interface MetricsBucket {
  total: number;
  scenarioDriven: number;
  background: number;
  falsePositiveRate: number | null;
}

export interface AnalysisMetrics {
  overall: MetricsBucket;
  byType: Record<AlertType, MetricsBucket>;
  byCategory: Record<string, MetricsBucket>;
}

export function getAnalysisMetrics() {
  return api.get<AnalysisMetrics>("/analysis/metrics").then((res) => res.data);
}

export function listAlerts(agentId?: string) {
  return api
    .get<{ alerts: Alert[] }>("/analysis/alerts", { params: agentId ? { agentId } : undefined })
    .then((res) => res.data.alerts);
}

export function actOnAlert(alertId: string, action: "acknowledge" | "escalate" | "resolve", note?: string) {
  return api
    .patch<{ alert: Alert }>(`/analysis/alerts/${alertId}`, { action, note })
    .then((res) => res.data.alert);
}

export function agentAckAlert(alertId: string) {
  return api.patch<{ alert: Alert }>(`/analysis/alerts/${alertId}/agent-ack`).then((res) => res.data.alert);
}

export function requestSupport(alertId: string, note: string) {
  return api
    .post<{ alert: Alert }>(`/analysis/alerts/${alertId}/request-support`, { note })
    .then((res) => res.data.alert);
}
