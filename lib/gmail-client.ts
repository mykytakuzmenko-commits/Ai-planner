const KEY = "ai_planner_gmail";

export interface GmailAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  processedIds: string[]; // email IDs already turned into tasks
}

export function getGmailAuth(): GmailAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GmailAuth) : null;
  } catch {
    return null;
  }
}

export function saveGmailAuth(auth: GmailAuth): void {
  localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearGmailAuth(): void {
  localStorage.removeItem(KEY);
}

export function isTokenExpired(auth: GmailAuth): boolean {
  return Date.now() >= auth.expiresAt - 60_000; // 1 min buffer
}

export function markEmailsProcessed(ids: string[]): void {
  const auth = getGmailAuth();
  if (!auth) return;
  const next = Array.from(new Set([...auth.processedIds, ...ids])).slice(-500); // keep last 500
  saveGmailAuth({ ...auth, processedIds: next });
}
