import { CreateChallengeResponse, DevLoginResponse, PollAuthResponse, DEFAULT_LAMPORTS } from "@safu/auth-shared";

export type Status = "idle" | "pending" | "authenticated" | "expired" | "error";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";
const api = (path: string) => `${API_BASE}${path}`;
const STORAGE_KEY = "safu-dev-auth";
const SOL_DECIMALS = 1_000_000_000;

export function formatLamports(lamports?: number) {
  const amt = (lamports ?? DEFAULT_LAMPORTS) / SOL_DECIMALS;
  return `${amt.toFixed(5)} SOL`;
}

export function loadDevAuth(): DevLoginResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevLoginResponse) : null;
  } catch {
    return null;
  }
}

export function saveDevAuth(value: DevLoginResponse | null) {
  if (!value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export async function signup(email: string, password: string) {
  const res = await fetch(api("/api/dev/signup"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("signup failed");
  return (await res.json()) as DevLoginResponse;
}

export async function login(email: string, password: string) {
  const res = await fetch(api("/api/dev/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
  return (await res.json()) as DevLoginResponse;
}

export async function fetchMe(token: string) {
  const res = await fetch(api("/api/dev/me"), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

export async function rotateKey(token: string) {
  const res = await fetch(api("/api/dev/rotate-key"), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("rotate failed");
  return res.json();
}

export async function requestChallenge(apiKey: string, webhookUrl?: string): Promise<CreateChallengeResponse> {
  const res = await fetch(api("/api/challenge"), {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ webhookUrl }),
  });
  if (!res.ok) throw new Error("challenge failed");
  return res.json();
}

export async function pollAuth(id: string): Promise<PollAuthResponse> {
  const res = await fetch(api(`/api/poll-auth?id=${id}`));
  return res.json();
}

export function statusColor(next: Status) {
  if (next === "authenticated") return "var(--accent)";
  if (next === "expired" || next === "error") return "#ff8ba7";
  return "var(--muted)";
}

export function statusLabel(next: Status) {
  return next === "idle" ? "pending" : next;
}

export function setStatusBadges(status: Status, badges: HTMLElement[]) {
  const label = statusLabel(status).toUpperCase();
  const color = statusColor(status);
  badges.forEach((badge) => {
    badge.textContent = `● ${label}`;
    badge.style.borderColor = color;
  });
}
