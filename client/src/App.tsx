import { Navbar } from "@/components/Navbar";
import { Home } from "@/pages/Home";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Navbar />
      <Home />
      <Toaster />
    </div>
  );
}

export default App;
