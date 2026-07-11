import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertList } from "@/components/AlertList";
import { TransactionFeed } from "@/components/TransactionFeed";
import { DaysOfInterestPanel } from "@/components/DaysOfInterestPanel";
import { useAuthStore } from "@/store/useAuthStore";
import { getMyAgent, getMyTransactions, type AgentTransaction, type AgentWithBalances } from "@/lib/agentsApi";
import {
  agentAckAlert,
  listAlerts,
  requestSupport,
  type Alert,
  type LiquidityEvidence,
} from "@/lib/alertsApi";

const PROVIDER_LABELS = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" } as const;
type BalanceKey = "cash" | keyof typeof PROVIDER_LABELS;

const CARD_SEVERITY_STYLES: Record<Alert["severity"], string> = {
  low: "border-border/60",
  medium: "border-yellow-500/50 bg-yellow-500/5",
  high: "border-orange-500/50 bg-orange-500/5",
  critical: "border-red-500/60 bg-red-500/5",
};

export function AgentDashboard() {
  const [agent, setAgent] = useState<AgentWithBalances | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [transactions, setTransactions] = useState<AgentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const seenAlertIds = useRef<Set<string> | null>(null);

  async function load() {
    try {
      const [agentData, alertData, transactionData] = await Promise.all([
        getMyAgent(),
        listAlerts(),
        getMyTransactions(),
      ]);

      const currentIds = new Set(alertData.map((a) => a.id));
      if (seenAlertIds.current) {
        for (const a of alertData) {
          if (!seenAlertIds.current.has(a.id)) {
            toast.info(`New alert: ${a.title}`);
          }
        }
      }
      seenAlertIds.current = currentIds;

      setAgent(agentData);
      setAlerts(alertData);
      setTransactions(transactionData);
    } catch {
      toast.error("Your session is out of date — signing you out.");
      useAuthStore.getState().logout();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await load();
    }

    tick();
    const interval = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleAcknowledge(alertId: string) {
    try {
      await agentAckAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success("Alert acknowledged and removed from your dashboard");
    } catch {
      toast.error("Could not acknowledge the alert");
    }
  }

  async function handleRequestSupport(alertId: string) {
    const note = window.prompt("What do you need help with?");
    if (!note) return;

    try {
      await requestSupport(alertId, note);
      toast.success("Request sent to your operations team");
    } catch {
      toast.error("Could not send the request");
    }
  }

  const openLiquidityByProvider = new Map<BalanceKey, Alert>();
  for (const alert of alerts) {
    if (alert.type !== "liquidity" || alert.status === "resolved") continue;
    const key: BalanceKey = alert.provider ?? "cash";
    const existing = openLiquidityByProvider.get(key);
    const evidence = alert.evidence as LiquidityEvidence;
    const existingEvidence = existing?.evidence as LiquidityEvidence | undefined;
    if (!existing || evidence.hoursToZero < existingEvidence!.hoursToZero) {
      openLiquidityByProvider.set(key, alert);
    }
  }

  const mostUrgent = [...openLiquidityByProvider.values()].sort(
    (a, b) => (a.evidence as LiquidityEvidence).hoursToZero - (b.evidence as LiquidityEvidence).hoursToZero,
  )[0];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader title="Agent Dashboard" />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
        {loading || !agent ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                {agent.name} — {agent.phone}
              </h2>

              {mostUrgent && (
                <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-500">
                  <span className="font-medium">{mostUrgent.title}</span> —{" "}
                  {(mostUrgent.evidence as LiquidityEvidence).hoursToZero.toFixed(1)}h until projected shortage.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card
                  className={`border ${
                    openLiquidityByProvider.has("cash")
                      ? CARD_SEVERITY_STYLES[openLiquidityByProvider.get("cash")!.severity]
                      : "border-border/60 bg-card/50"
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Physical cash</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    ৳{Number(agent.cashBalance).toLocaleString()}
                  </CardContent>
                </Card>
                {(Object.keys(PROVIDER_LABELS) as (keyof typeof PROVIDER_LABELS)[]).map((provider) => (
                  <Card
                    key={provider}
                    className={`border ${
                      openLiquidityByProvider.has(provider)
                        ? CARD_SEVERITY_STYLES[openLiquidityByProvider.get(provider)!.severity]
                        : "border-border/60 bg-card/50"
                    }`}
                  >
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">
                        {PROVIDER_LABELS[provider]}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      ৳{Number(agent.balances[provider] ?? 0).toLocaleString()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Alerts</h2>
              <div className="scrollbar-thin max-h-[32rem] overflow-y-auto overflow-x-hidden rounded-lg border border-border/60 p-3">
                <AlertList
                  alerts={alerts}
                  onAcknowledge={handleAcknowledge}
                  onRequestSupport={handleRequestSupport}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent transactions</h2>
              <TransactionFeed transactions={transactions} />
            </section>

            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Days of interest</h2>
              <DaysOfInterestPanel canCreate={false} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
