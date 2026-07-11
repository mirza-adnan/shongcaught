import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

export function RoleMismatch({ expected }: { expected: "agent" | "ops" }) {
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background text-center text-foreground">
      <p className="max-w-sm text-muted-foreground">
        This account isn't a {expected} account. Sign out and use the correct portal for your
        role.
      </p>
      <Button onClick={logout}>Sign out</Button>
    </div>
  );
}
