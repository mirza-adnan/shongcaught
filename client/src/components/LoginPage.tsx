import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/authApi";
import { useAuthStore } from "@/store/useAuthStore";

type LoginRole = "agent" | "ops";

const ROLE_COPY: Record<LoginRole, { label: string; hint: string }> = {
  agent: {
    label: "Agent",
    hint: "Track your own cash and provider balances, and see alerts on your account.",
  },
  ops: {
    label: "Operations",
    hint: "Monitor every agent in your block, coordinate cases, and manage alerts.",
  },
};

export function LoginPage() {
  const [role, setRole] = useState<LoginRole>("agent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { user, token } = await login(email, password);
      setAuth(user, token);
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
            SC
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">ShongCaught</h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Multi-provider mobile-money liquidity &amp; anomaly decision support
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card/40 p-8"
        >
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(ROLE_COPY) as LoginRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  role === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ROLE_COPY[r].label}
              </button>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{ROLE_COPY[role].hint}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={loading} className="mt-1 px-5">
            {loading ? "Signing in..." : `Sign in as ${ROLE_COPY[role].label}`}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Accounts are provisioned internally. Contact your coordinator if you need access.
          </p>
        </form>

        <a href="/simulator" className="text-center text-xs text-muted-foreground underline">
          Simulation control (public demo tool)
        </a>
      </div>
    </div>
  );
}
