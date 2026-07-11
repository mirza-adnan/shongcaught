import { api } from "@/lib/axios";
import type { AuthUser } from "@/store/useAuthStore";

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function signup(email: string, password: string, name: string) {
  return api.post<AuthResponse>("/auth/signup", { email, password, name }).then((res) => res.data);
}

export function login(email: string, password: string) {
  return api.post<AuthResponse>("/auth/login", { email, password }).then((res) => res.data);
}

export function loginWithGoogle(idToken: string) {
  return api.post<AuthResponse>("/auth/google", { idToken }).then((res) => res.data);
}
