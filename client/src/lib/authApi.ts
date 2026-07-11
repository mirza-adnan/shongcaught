import { api } from "@/lib/axios";
import type { AuthUser } from "@/store/useAuthStore";

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function login(email: string, password: string) {
  return api.post<AuthResponse>("/auth/login", { email, password }).then((res) => res.data);
}
