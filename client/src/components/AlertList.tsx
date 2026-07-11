import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Alert, LiquidityEvidence, AnomalyEvidence } from "@/lib/alertsApi";

const SEVERITY_STYLES: Record<Alert["severity"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-500/15 text-yellow-500",
  high: "bg-orange-500/15 text-orange-500",
  critical: "bg-red-500/15 text-red-500",
};

const STATUS_LABELS: Record<Alert["status"], string> = {
  open: "Open",
  acknowledged: "Alerted",
  escalated: "Escalated",
  resolved: "Dismissed",
};

export function AlertList({
  alerts,
  onAction,
  onSelectAgent,
}: {
  alerts: Alert[];
  onAction?: (alertId: string, action: "acknowledge" | "escalate" | "resolve") => void;
  onSelectAgent?: (agentId: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">No alerts right now.</p>;
  }

  function toggleExpanded(alertId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => {
        const expanded = expandedIds.has(alert.id);

        return (
          <div
            key={alert.id}
            onClick={() => onSelectAgent?.(alert.agentId)}
            className={`rounded-lg border border-border/60 p-4 ${
              onSelectAgent ? "cursor-pointer transition-colors hover:border-border" : ""
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${SEVERITY_STYLES[alert.severity]}`}
                >
                  {alert.severity}
                </span>
                <span className="text-xs text-muted-foreground">{STATUS_LABELS[alert.status]}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(Number(alert.confidence) * 100)}% confidence
                </span>
                {onAction && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      alert.scenarioTag
                        ? "bg-blue-500/15 text-blue-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={
                      alert.scenarioTag
                        ? "Fired during a deliberately triggered simulation scenario"
                        : "Fired from ambient background simulation noise, no scenario active"
                    }
                  >
                    {alert.scenarioTag ? "Scenario" : "Background"}
                  </span>
                )}
              </div>
              {alert.provider && (
                <span className="text-xs uppercase text-muted-foreground">{alert.provider}</span>
              )}
            </div>

            <p className="text-sm font-medium">{alert.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
            {alert.banglishSummary && (
              <p className="mt-1 text-sm text-muted-foreground italic">{alert.banglishSummary}</p>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(alert.id);
              }}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span
                className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                ▸
              </span>
              {expanded ? "Hide evidence" : "Show evidence"}
            </button>

            {expanded && (
              <div className="mt-2 rounded-md border border-border/40 bg-muted/20 p-3">
                <EvidenceView alert={alert} />
              </div>
            )}

            {onAction && alert.status !== "resolved" && (
              <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                {alert.status === "open" && (
                  <Button variant="outline" className="px-4" onClick={() => onAction(alert.id, "acknowledge")}>
                    Alert agent
                  </Button>
                )}
                {alert.status !== "escalated" && (
                  <Button
                    variant="outline"
                    className="px-4 text-orange-500 hover:text-orange-500"
                    onClick={() => onAction(alert.id, "escalate")}
                  >
                    Escalate to risk/compliance
                  </Button>
                )}
                <Button className="px-4" onClick={() => onAction(alert.id, "resolve")}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvidenceView({ alert }: { alert: Alert }) {
  if (alert.type === "liquidity") {
    const evidence = alert.evidence as LiquidityEvidence;
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
        <Metric label="Window" value={`${evidence.windowHours}h`} />
        <Metric label="Transactions in window" value={evidence.sampleCount} />
        <Metric label="Burn rate" value={`${Math.round(evidence.burnPerHour)}/hr`} />
        <Metric label="Current balance" value={`৳${Math.round(evidence.currentBalance).toLocaleString()}`} />
        <Metric label="Largest gap" value={`${evidence.maxGapHours.toFixed(1)}h`} />
        <Metric label="Projected hours to zero" value={evidence.hoursToZero.toFixed(1)} />
      </dl>
    );
  }

  const evidence = alert.evidence as AnomalyEvidence;

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Metric label="Window" value={`${evidence.windowHours}h`} />
        <Metric label="Transactions in window" value={evidence.transactionCount} />
      </dl>

      {alert.votes && alert.votes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Voter breakdown ({alert.votes.filter((v) => v.fired).length}/{alert.votes.length} flagged)
          </p>
          {alert.votes.map((vote) => (
            <div key={vote.voter} className="flex items-start gap-2 text-xs">
              <span className={vote.fired ? "text-foreground" : "text-muted-foreground"}>
                {vote.fired ? "●" : "○"}
              </span>
              <div>
                <span className="font-medium capitalize">{vote.voter.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground"> — {vote.rationale}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[0.7rem] uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
