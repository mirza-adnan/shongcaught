import { useAuthStore } from "@/store/useAuthStore";
import { LoginPage } from "@/components/LoginPage";
import { AgentDashboard } from "@/apps/AgentApp";
import { OpsDashboard } from "@/apps/OpsApp";
import { SimulatorPage } from "@/pages/SimulatorPage";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const isSimulatorRoute = window.location.pathname.startsWith("/simulator");
  const user = useAuthStore((state) => state.user);

  return (
    <>
      {isSimulatorRoute ? (
        <SimulatorPage />
      ) : !user ? (
        <LoginPage />
      ) : user.role === "agent" ? (
        <AgentDashboard />
      ) : (
        <OpsDashboard />
      )}
      <Toaster />
    </>
  );
}

export default App;
