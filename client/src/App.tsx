import { AgentApp } from "@/apps/AgentApp";
import { OpsApp } from "@/apps/OpsApp";
import { DevPicker } from "@/apps/DevPicker";
import { Toaster } from "@/components/ui/sonner";

function resolvePortal(hostname: string) {
  if (hostname.startsWith("agent.")) return "agent";
  if (hostname.startsWith("ops.")) return "ops";
  return null;
}

function App() {
  const portal = resolvePortal(window.location.hostname);

  return (
    <>
      {portal === "agent" && <AgentApp />}
      {portal === "ops" && <OpsApp />}
      {portal === null && <DevPicker />}
      <Toaster />
    </>
  );
}

export default App;
