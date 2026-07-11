import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { loginWithGoogle } from "@/lib/authApi";
import { useAuthStore } from "@/store/useAuthStore";

export function GoogleLoginButton({ onSuccess }: { onSuccess?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || !containerRef.current) {
      return;
    }

    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !containerRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const { user, token } = await loginWithGoogle(response.credential);
            setAuth(user, token);
            onSuccess?.();
          } catch {
            toast.error("Google sign-in failed");
          }
        },
      });

      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "filled_black",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google) {
      render();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          render();
        }
      }, 100);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [onSuccess, setAuth]);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return null;
  }

  return <div ref={containerRef} />;
}
