import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStatus,
  listScenarios,
  listSimBlocks,
  setSpeed,
  startSimulation,
  stopSimulation,
  triggerScenario,
  type ScenarioDefinition,
  type SimBlock,
  type SimulationStatus,
} from "@/lib/simulationApi";
import { getAnalysisMetrics, type AnalysisMetrics, type MetricsBucket } from "@/lib/alertsApi";
import { nativeSelectClass as selectClass } from "@/lib/uiClasses";

const PROVIDERS = ["bkash", "nagad", "rocket"] as const;
type ProviderKey = (typeof PROVIDERS)[number];

export function SimulatorPage() {
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [blocks, setBlocks] = useState<SimBlock[]>([]);
  const [metrics, setMetrics] = useState<AnalysisMetrics | null>(null);
  const [speedInput, setSpeedInput] = useState("300");
  const [toggling, setToggling] = useState(false);

  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>("bkash");
  const [durationSeconds, setDurationSeconds] = useState("14400");
  const [triggering, setTriggering] = useState(false);

  async function refreshStatus() {
    try {
      setStatus(await getStatus());
    } catch {
      // transient — next poll will retry
    }
  }

  async function refreshMetrics() {
    try {
      setMetrics(await getAnalysisMetrics());
    } catch {
      // transient — next poll will retry
    }
  }

  useEffect(() => {
    refreshStatus();
    refreshMetrics();
    listScenarios().then(setScenarios);
    listSimBlocks().then(setBlocks);
    const statusInterval = setInterval(refreshStatus, 3000);
    const metricsInterval = setInterval(refreshMetrics, 5000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(metricsInterval);
    };
  }, []);

  async function handleToggleRunning() {
    setToggling(true);
    try {
      if (status?.running) {
        setStatus(await stopSimulation());
        toast.success("Simulation stopped");
      } else {
        setStatus(await startSimulation(Number(speedInput)));
        toast.success("Simulation started");
      }
    } catch {
      toast.error(status?.running ? "Could not stop the simulation" : "Could not start the simulation");
    } finally {
      setToggling(false);
    }
  }

  async function handleSetSpeed() {
    try {
      setStatus(await setSpeed(Number(speedInput)));
      toast.success("Speed updated");
    } catch {
      toast.error("Could not update speed");
    }
  }

  async function handleTrigger(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedBlockId || !selectedScenario) {
      toast.error("Pick an operations team and a scenario first");
      return;
    }

    setTriggering(true);
    try {
      setStatus(
        await triggerScenario({
          blockId: selectedBlockId,
          scenario: selectedScenario,
          provider: selectedProvider,
          durationSeconds: Number(durationSeconds),
        }),
      );
      const blockName = blocks.find((b) => b.id === selectedBlockId)?.name;
      toast.success(`Scenario triggered for every agent in ${blockName}`);
    } catch {
      toast.error("Could not trigger the scenario");
    } finally {
      setTriggering(false);
    }
  }

  function scenarioLabel(name: string) {
    return scenarios.find((s) => s.name === name)?.label ?? name.replace(/_/g, " ");
  }

  const activeScenarioDescription = scenarios.find((s) => s.name === selectedScenario)?.description;

  const activeScenarioSummary = status
    ? Object.values(
        status.activeScenarios.reduce<Record<string, { scenario: string; provider: string; count: number }>>(
          (acc, s) => {
            const key = `${s.scenario}:${s.provider}`;
            acc[key] ??= { scenario: s.scenario, provider: s.provider, count: 0 };
            acc[key].count += 1;
            return acc;
          },
          {},
        ),
      )
    : [];

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border/60 px-6 py-4">
        <h1 className="text-lg font-semibold">Simulation Control</h1>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Status</h2>
          {status ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-border/60 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">State</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      {status.running && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex size-2.5 rounded-full ${
                          status.running ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                    </span>
                    <p className={`text-lg font-semibold ${status.running ? "text-green-500" : "text-red-500"}`}>
                      {status.running ? "Running" : "Stopped"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Speed: {status.speedMultiplier}x</p>
                  <p className="text-sm text-muted-foreground">
                    Virtual time: {new Date(status.virtualNow).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">
                    Active scenarios ({status.activeScenarios.length} agents affected)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {activeScenarioSummary.length === 0 && <p>None right now.</p>}
                  {activeScenarioSummary.map((s) => (
                    <p key={s.scenario + s.provider}>
                      {scenarioLabel(s.scenario)} on {s.provider} — {s.count} agent{s.count === 1 ? "" : "s"}
                    </p>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Controls</h2>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-4">
            <Button
              onClick={handleToggleRunning}
              disabled={toggling}
              variant={status?.running ? "destructive" : "default"}
              className="px-5"
            >
              {status?.running ? "Stop simulation" : "Start simulation"}
            </Button>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                value={speedInput}
                onChange={(e) => setSpeedInput(e.target.value)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">x speed</span>
            </div>

            <Button variant="outline" onClick={handleSetSpeed} className="px-5">
              Set speed
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Inject a scenario</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Applies to every agent in the selected operations team's block.
          </p>
          <form
            onSubmit={handleTrigger}
            className="flex flex-col gap-3 rounded-lg border border-border/60 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className={selectClass}
              >
                <option value="">Select an operations team</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedScenario}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className={selectClass}
              >
                <option value="">Select a scenario</option>
                {scenarios.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as ProviderKey)}
                className={selectClass}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>

              <Input
                type="number"
                min="1"
                placeholder="Duration (seconds)"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
              />
            </div>

            {activeScenarioDescription && (
              <p className="text-xs text-muted-foreground">{activeScenarioDescription}</p>
            )}

            <Button type="submit" disabled={triggering} className="self-start px-5">
              {triggering ? "Triggering..." : "Trigger scenario"}
            </Button>
          </form>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Validation metrics</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            "Scenario" alerts fired on transactions from a deliberately triggered scenario.
            "Background" alerts fired from ordinary random-walk simulation noise with no
            scenario active — a real proxy for the false-positive rate, computed from every
            alert ever written, not a manual estimate.
          </p>
          {metrics ? (
            <div className="flex flex-col gap-4 rounded-lg border border-border/60 p-4">
              <MetricsRow label="Overall" bucket={metrics.overall} />
              <MetricsRow label="Liquidity alerts" bucket={metrics.byType.liquidity} />
              <MetricsRow label="Anomaly alerts" bucket={metrics.byType.anomaly} />
              {Object.entries(metrics.byCategory).length > 0 && (
                <div className="border-t border-border/40 pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">By anomaly category</p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(metrics.byCategory).map(([category, bucket]) => (
                      <MetricsRow key={category} label={category.replace(/_/g, " ")} bucket={bucket} compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricsRow({ label, bucket, compact }: { label: string; bucket: MetricsBucket; compact?: boolean }) {
  const fpr = bucket.falsePositiveRate;
  const fprColor =
    fpr === null ? "text-muted-foreground" : fpr > 0.5 ? "text-red-500" : fpr > 0.2 ? "text-yellow-500" : "text-green-500";

  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? "text-xs" : "text-sm"}`}>
      <span className="capitalize text-foreground">{label}</span>
      <span className="text-muted-foreground">
        {bucket.total} total · {bucket.scenarioDriven} scenario · {bucket.background} background
      </span>
      <span className={`font-medium ${fprColor}`}>
        {fpr === null ? "—" : `${Math.round(fpr * 100)}% FPR`}
      </span>
    </div>
  );
}
