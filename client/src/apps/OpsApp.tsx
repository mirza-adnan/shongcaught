import { LoginForm } from "@/components/LoginForm";
import { AppHeader } from "@/components/AppHeader";
import { RoleMismatch } from "@/apps/RoleMismatch";
import { useAuthStore } from "@/store/useAuthStore";

export function OpsApp() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <LoginForm title="Operations sign in" />;
  }

  if (user.role !== "ops") {
    return <RoleMismatch expected="ops" />;
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <AppHeader title="Operations Dashboard" />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-muted-foreground">
          Signed in as {user.name}. The block's agents and alerts land here in the next pass.
        </p>
      </main>
    </div>
  );
}
