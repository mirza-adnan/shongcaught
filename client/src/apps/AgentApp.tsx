import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import { getMyAgent, type AgentWithBalances } from "@/lib/agentsApi";
import { listAlerts, type Alert } from "@/lib/alertsApi";
import { AlertList } from "@/components/AlertList";

const PROVIDER_LABELS = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" } as const;

export function AgentDashboard() {
  const [agent, setAgent] = useState<AgentWithBalances | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [agentData, alertData] = await Promise.all([getMyAgent(), listAlerts()]);
        if (cancelled) return;
        setAgent(agentData);
        setAlerts(alertData);
      } catch {
        if (cancelled) return;
        toast.error("Your session is out of date — signing you out.");
        useAuthStore.getState().logout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Physical cash</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    ৳{Number(agent.cashBalance).toLocaleString()}
                  </CardContent>
                </Card>
                {(Object.keys(PROVIDER_LABELS) as (keyof typeof PROVIDER_LABELS)[]).map((provider) => (
                  <Card key={provider} className="border-border/60 bg-card/50">
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
              <AlertList alerts={alerts} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
