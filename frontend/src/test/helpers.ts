import { api, setAccessToken } from "../lib/api";

/**
 * Test helpers. Logs in through the same code path the UI uses so the shared
 * access token in lib/api.ts is set for every render in the file.
 */
export async function login(email: string, password: string): Promise<void> {
  const data = await api.post<{ token: string }>("/auth/login", { email, password });
  setAccessToken(data.token);
}
