import "./styles.css";
import { CreateChallengeResponse, DevLoginResponse, PollAuthResponse, DEFAULT_LAMPORTS } from "@safu/auth-shared";

type Status = "idle" | "pending" | "authenticated" | "expired" | "error";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "";
const api = (path: string) => `${API_BASE}${path}`;
const SOL_DECIMALS = 1_000_000_000;

let challenge: CreateChallengeResponse | null = null;
let session: PollAuthResponse | null = null;
let devAuth: DevLoginResponse | null = null;
let status: Status = "idle";
let webhookUrl = "";
let pollHandle: number | null = null;

const els = {
  statusBadges: Array.from(document.querySelectorAll<HTMLElement>("[data-status-badge]")),
  livePill: document.getElementById("live-pill") as HTMLElement,
  challengeCard: document.getElementById("challenge-card") as HTMLElement,
  challengeEmpty: document.getElementById("challenge-empty") as HTMLElement,
  challengeAmount: document.getElementById("challenge-amount") as HTMLElement,
  challengeRecipient: document.getElementById("challenge-recipient") as HTMLElement,
  challengeId: document.getElementById("challenge-id") as HTMLElement,
  challengeExpiry: document.getElementById("challenge-expiry") as HTMLElement,
  sessionCard: document.getElementById("session-card") as HTMLElement,
  sessionUser: document.getElementById("session-user") as HTMLElement,
  sessionTx: document.getElementById("session-tx") as HTMLElement,
  sessionToken: document.getElementById("session-token") as HTMLElement,
  challengeError: document.getElementById("challenge-error") as HTMLElement,
  snippetApi: document.getElementById("snippet-api") as HTMLElement,
  snippetCurl: document.getElementById("snippet-curl") as HTMLElement,
  buttonCreate: document.getElementById("btn-create-challenge") as HTMLButtonElement,
  emailInput: document.getElementById("email-input") as HTMLInputElement,
  passwordInput: document.getElementById("password-input") as HTMLInputElement,
  buttonSignup: document.getElementById("btn-signup") as HTMLButtonElement,
  buttonLogin: document.getElementById("btn-login") as HTMLButtonElement,
  buttonRefresh: document.getElementById("btn-refresh") as HTMLButtonElement,
  buttonRotate: document.getElementById("btn-rotate") as HTMLButtonElement,
  authError: document.getElementById("auth-error") as HTMLElement,
  apiKeyCard: document.getElementById("apikey-card") as HTMLElement,
  apiKeyValue: document.getElementById("apikey-value") as HTMLElement,
  projectName: document.getElementById("project-name") as HTMLElement,
  webhookInput: document.getElementById("webhook-input") as HTMLInputElement,
};

function toggle(el: HTMLElement | null, visible: boolean) {
  if (!el) return;
  el.classList.toggle("hidden", !visible);
}

function statusLabel(next: Status) {
  return next === "idle" ? "pending" : next;
}

function statusColor(next: Status) {
  if (next === "authenticated") return "var(--accent)";
  if (next === "expired" || next === "error") return "#ff8ba7";
  return "var(--muted)";
}

function setStatus(next: Status) {
  status = next;
  const label = statusLabel(next).toUpperCase();
  const color = statusColor(next);
  els.statusBadges.forEach((badge) => {
    badge.textContent = `● ${label}`;
    badge.style.borderColor = color;
  });
}

function stopPolling() {
  if (pollHandle) {
    window.clearInterval(pollHandle);
    pollHandle = null;
  }
}

function startPolling(id: string) {
  stopPolling();
  pollHandle = window.setInterval(async () => {
    try {
      const res = await pollAuth(id);
      if (res.status === "authenticated") {
        setStatus("authenticated");
        session = res;
        renderSession(res);
        stopPolling();
      } else if (res.status === "expired" || res.status === "not_found") {
        setStatus("expired");
        stopPolling();
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      stopPolling();
    }
  }, 2000);
}

function renderChallenge(data: CreateChallengeResponse | null) {
  if (!data) {
    toggle(els.challengeCard, false);
    toggle(els.challengeEmpty, true);
    return;
  }
  const amountSol = (data.amountLamports ?? DEFAULT_LAMPORTS) / SOL_DECIMALS;
  els.challengeAmount.textContent = `${amountSol.toFixed(5)} SOL`;
  els.challengeRecipient.textContent = data.recipient;
  els.challengeId.textContent = data.id;
  els.challengeExpiry.textContent = new Date(data.expiresAt).toLocaleTimeString();
  toggle(els.challengeEmpty, false);
  toggle(els.challengeCard, true);
}

function renderSession(data: PollAuthResponse | null) {
  if (!data?.sessionToken) {
    toggle(els.sessionCard, false);
    toggle(els.livePill, false);
    return;
  }
  els.sessionUser.textContent = data.userPubkey;
  els.sessionTx.textContent = data.txSignature;
  els.sessionToken.textContent = data.sessionToken;
  toggle(els.sessionCard, true);
  toggle(els.livePill, true);
  if (data.userPubkey) {
    const short = `${data.userPubkey.slice(0, 6)}...${data.userPubkey.slice(-4)}`;
    els.livePill.textContent = `${short} authenticated`;
  }
}

function setChallengeError(message?: string) {
  if (!els.challengeError) return;
  els.challengeError.textContent = message ?? "";
  toggle(els.challengeError, Boolean(message));
}

function setAuthError(message?: string) {
  if (!els.authError) return;
  els.authError.textContent = message ?? "";
  toggle(els.authError, Boolean(message));
}

function updateSnippets() {
  const key = devAuth?.apiKey?.key ?? "<API_KEY>";
  const hookLine = webhookUrl ? `  webhookUrl: "${webhookUrl}"` : "";
  els.snippetApi.textContent = `await fetch("${API_BASE}/api/challenge",\n  {\n    method: "POST",\n    headers: {\n      "x-api-key": "${key}",\n      "content-type": "application/json"\n    },\n    body: JSON.stringify({\n${hookLine}\n    })\n  }\n);`;
  const hookArg = webhookUrl ? `-d '{"webhookUrl":"${webhookUrl}"}' ` : "";
  els.snippetCurl.textContent = `curl -X POST "${API_BASE}/api/challenge" -H "x-api-key: ${key}" -H "content-type: application/json" ${hookArg}`;
}

function updateApiKeyCard() {
  const hasKey = Boolean(devAuth?.apiKey?.key);
  toggle(els.apiKeyCard, hasKey);
  if (!hasKey) return;
  els.apiKeyValue.textContent = devAuth?.apiKey?.key ?? "";
  els.projectName.textContent = devAuth?.project?.name || "Your project";
}

async function signup(email: string, password: string) {
  const res = await fetch(api("/api/dev/signup"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("signup failed");
  return (await res.json()) as DevLoginResponse;
}

async function login(email: string, password: string) {
  const res = await fetch(api("/api/dev/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
  return (await res.json()) as DevLoginResponse;
}

async function fetchMe(token: string) {
  const res = await fetch(api("/api/dev/me"), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

async function rotateKey(token: string) {
  const res = await fetch(api("/api/dev/rotate-key"), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("rotate failed");
  return res.json();
}

async function requestChallenge(apiKey: string, webhook?: string) {
  const res = await fetch(api("/api/challenge"), {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ webhookUrl: webhook }),
  });
  if (!res.ok) throw new Error("challenge failed");
  return (await res.json()) as CreateChallengeResponse;
}

async function pollAuth(id: string) {
  const res = await fetch(api(`/api/poll-auth?id=${id}`));
  return (await res.json()) as PollAuthResponse;
}

function wireNav() {
  document.querySelectorAll<HTMLElement>("[data-scroll]").forEach((el) => {
    const target = el.getAttribute("data-scroll");
    if (!target) return;
    el.addEventListener("click", (evt) => {
      evt.preventDefault();
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function wireActions() {
  els.buttonCreate?.addEventListener("click", async () => {
    if (!devAuth?.apiKey?.key) {
      setChallengeError("Sign up or log in to get an API key first.");
      return;
    }
    try {
      setChallengeError();
      session = null;
      renderSession(null);
      setStatus("pending");
      challenge = await requestChallenge(devAuth.apiKey.key, webhookUrl || undefined);
      renderChallenge(challenge);
      startPolling(challenge.id);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setChallengeError(err?.message || "challenge failed");
    }
  });

  els.buttonSignup?.addEventListener("click", async () => {
    const email = els.emailInput?.value.trim();
    const password = els.passwordInput?.value.trim();
    if (!email || !password) {
      setAuthError("Email and password required.");
      return;
    }
    try {
      setAuthError();
      devAuth = await signup(email, password);
      updateApiKeyCard();
      updateSnippets();
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || "signup failed");
    }
  });

  els.buttonLogin?.addEventListener("click", async () => {
    const email = els.emailInput?.value.trim();
    const password = els.passwordInput?.value.trim();
    if (!email || !password) {
      setAuthError("Email and password required.");
      return;
    }
    try {
      setAuthError();
      devAuth = await login(email, password);
      updateApiKeyCard();
      updateSnippets();
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || "login failed");
    }
  });

  els.buttonRefresh?.addEventListener("click", async () => {
    if (!devAuth?.token) {
      setAuthError("Log in first.");
      return;
    }
    try {
      setAuthError();
      const res = await fetchMe(devAuth.token);
      devAuth = devAuth ? { ...devAuth, ...res } : res;
      updateApiKeyCard();
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || "refresh failed");
    }
  });

  els.buttonRotate?.addEventListener("click", async () => {
    if (!devAuth?.token) {
      setAuthError("Log in first.");
      return;
    }
    try {
      setAuthError();
      const res = await rotateKey(devAuth.token);
      devAuth = devAuth ? { ...devAuth, apiKey: res.apiKey } : devAuth;
      updateApiKeyCard();
      updateSnippets();
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || "rotate failed");
    }
  });

  els.webhookInput?.addEventListener("input", (evt) => {
    const value = (evt.target as HTMLInputElement).value.trim();
    webhookUrl = value;
    updateSnippets();
  });
}

function init() {
  setStatus(status);
  renderChallenge(null);
  renderSession(null);
  setChallengeError();
  setAuthError();
  updateSnippets();
  updateApiKeyCard();
  wireNav();
  wireActions();
}

init();

window.addEventListener("beforeunload", stopPolling);
