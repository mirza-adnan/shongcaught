import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { AlertList } from "@/components/AlertList";
import { AgentMap } from "@/components/AgentMap";
import { DaysOfInterestPanel } from "@/components/DaysOfInterestPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import { listBlockAgents, type AgentWithBalances, type Block } from "@/lib/agentsApi";
import { actOnAlert, listAlerts, type Alert, type AlertSeverity, type AlertStatus, type AlertType } from "@/lib/alertsApi";
import { nativeSelectClass } from "@/lib/uiClasses";

const PROVIDER_LABELS = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" } as const;
type ProviderKey = keyof typeof PROVIDER_LABELS;

export function OpsDashboard() {
  const [block, setBlock] = useState<Block | null>(null);
  const [agents, setAgents] = useState<AgentWithBalances[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AlertType | "">("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "">("");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "">("");
  const [providerFilter, setProviderFilter] = useState<ProviderKey | "">("");
  const [originFilter, setOriginFilter] = useState<"scenario" | "background" | "">("");

  async function refresh() {
    try {
      const [{ block: blockData, agents: agentData }, alertData] = await Promise.all([
        listBlockAgents(),
        listAlerts(),
      ]);
      setBlock(blockData);
      setAgents(agentData);
      setAlerts(alertData);
    } catch {
      toast.error("Your session is out of date — signing you out.");
      useAuthStore.getState().logout();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, []);

  async function handleAction(alertId: string, action: "acknowledge" | "escalate" | "resolve") {
    try {
      await actOnAlert(alertId, action);
      await refresh();
    } catch {
      toast.error("Could not update the alert");
    }
  }

  function handleSelectAgentFromAlert(agentId: string) {
    setSelectedAgentId(agentId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const alertedAgentIds = new Set(alerts.filter((a) => a.status !== "resolved").map((a) => a.agentId));

  const filteredAgents = agents.filter((agent) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return agent.name.toLowerCase().includes(q) || agent.phone.includes(q);
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const displayBalances = selectedAgent
    ? {
        cash: Number(selectedAgent.cashBalance),
        bkash: Number(selectedAgent.balances.bkash ?? 0),
        nagad: Number(selectedAgent.balances.nagad ?? 0),
        rocket: Number(selectedAgent.balances.rocket ?? 0),
      }
    : agents.reduce(
        (acc, a) => ({
          cash: acc.cash + Number(a.cashBalance),
          bkash: acc.bkash + Number(a.balances.bkash ?? 0),
          nagad: acc.nagad + Number(a.balances.nagad ?? 0),
          rocket: acc.rocket + Number(a.balances.rocket ?? 0),
        }),
        { cash: 0, bkash: 0, nagad: 0, rocket: 0 },
      );

  const scopedAlerts = alerts
    .filter((a) => !selectedAgentId || a.agentId === selectedAgentId)
    .filter((a) => !typeFilter || a.type === typeFilter)
    .filter((a) => !severityFilter || a.severity === severityFilter)
    .filter((a) => !providerFilter || a.provider === providerFilter)
    .filter((a) => (statusFilter ? a.status === statusFilter : a.status !== "resolved"))
    .filter((a) => {
      if (!originFilter) return true;
      return originFilter === "scenario" ? Boolean(a.scenarioTag) : !a.scenarioTag;
    });

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader title="Operations Dashboard" />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        {loading || !block ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <section>
              {selectedAgent && (
                <h1 className="mb-1 text-xl font-medium">{selectedAgent.name}</h1>
              )}
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {block.name} block{selectedAgent ? "" : " — all agents"}
                </h2>
                {selectedAgent && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedAgentId(null)}>
                    Clear selection
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/60 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Physical cash</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">
                    ৳{displayBalances.cash.toLocaleString()}
                  </CardContent>
                </Card>
                {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map((provider) => (
                  <Card key={provider} className="border-border/60 bg-card/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">
                        {PROVIDER_LABELS[provider]}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">
                      ৳{displayBalances[provider].toLocaleString()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="flex flex-col gap-8 lg:col-span-2">
                <section>
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">Agent map</h2>
                  <AgentMap
                    block={block}
                    agents={filteredAgents}
                    alertedAgentIds={alertedAgentIds}
                    selectedAgentId={selectedAgentId}
                    onSelect={setSelectedAgentId}
                  />
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Agents in your block ({filteredAgents.length}/{agents.length})
                    </h2>
                    <Input
                      placeholder="Search by name or phone"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2">Agent</th>
                          <th className="px-4 py-2">Phone</th>
                          <th className="px-4 py-2 text-right">Cash</th>
                          <th className="px-4 py-2 text-right">bKash</th>
                          <th className="px-4 py-2 text-right">Nagad</th>
                          <th className="px-4 py-2 text-right">Rocket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAgents.map((agent) => (
                          <tr
                            key={agent.id}
                            onClick={() => setSelectedAgentId(selectedAgentId === agent.id ? null : agent.id)}
                            className={`cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40 ${
                              selectedAgentId === agent.id ? "bg-muted/60" : ""
                            }`}
                          >
                            <td className="px-4 py-2">
                              {agent.name}
                              {alertedAgentIds.has(agent.id) && (
                                <span className="ml-2 text-xs text-red-500">●</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{agent.phone}</td>
                            <td className="px-4 py-2 text-right">
                              ৳{Number(agent.cashBalance).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right">
                              ৳{Number(agent.balances.bkash ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right">
                              ৳{Number(agent.balances.nagad ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right">
                              ৳{Number(agent.balances.rocket ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="flex flex-col gap-8">
                <section>
                  <div className="mb-3 flex flex-col gap-3">
                    <h2 className="text-sm font-medium text-muted-foreground">
                      Alerts ({scopedAlerts.length})
                    </h2>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <FilterSelect
                        value={typeFilter}
                        onChange={setTypeFilter}
                        options={["liquidity", "anomaly"]}
                        placeholder="All types"
                      />
                      <FilterSelect
                        value={severityFilter}
                        onChange={setSeverityFilter}
                        options={["low", "medium", "high", "critical"]}
                        placeholder="All severities"
                      />
                      <FilterSelect
                        value={providerFilter}
                        onChange={setProviderFilter}
                        options={["bkash", "nagad", "rocket"]}
                        placeholder="All providers"
                      />
                      <FilterSelect
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={["open", "acknowledged", "escalated", "resolved"]}
                        placeholder="Open + in progress"
                      />
                      <FilterSelect
                        value={originFilter}
                        onChange={setOriginFilter}
                        options={["scenario", "background"]}
                        placeholder="Scenario + background"
                      />
                    </div>
                  </div>
                  <AlertList
                    alerts={scopedAlerts}
                    onAction={handleAction}
                    onSelectAgent={handleSelectAgentFromAlert}
                  />
                </section>

                <section>
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">Days of interest</h2>
                  <DaysOfInterestPanel canCreate />
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | "";
  onChange: (value: T | "") => void;
  options: T[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T | "")}
      className={`${nativeSelectClass} capitalize`}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option} className="capitalize">
          {option}
        </option>
      ))}
    </select>
  );
}
