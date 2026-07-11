import { LoginForm } from "@/components/LoginForm";
import { AppHeader } from "@/components/AppHeader";
import { RoleMismatch } from "@/apps/RoleMismatch";
import { useAuthStore } from "@/store/useAuthStore";

export function AgentApp() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <LoginForm title="Agent sign in" />;
  }

  if (user.role !== "agent") {
    return <RoleMismatch expected="agent" />;
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader title="Agent Dashboard" />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-muted-foreground">
          Signed in as {user.name}. Balances and alerts land here in the next pass.
        </p>
      </main>
    </div>
  );
}
