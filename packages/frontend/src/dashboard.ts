import "./styles.css";
import {
  Status,
  login,
  signup,
  fetchMe,
  rotateKey,
  requestChallenge,
  pollAuth,
  loadDevAuth,
  saveDevAuth,
  setStatusBadges,
  formatLamports,
} from "./auth";

let auth = loadDevAuth();
let challengeId: string | null = null;
let pollHandle: number | null = null;
let webhookUrl = "";
let status: Status = "idle";

const els = {
  badges: Array.from(document.querySelectorAll<HTMLElement>("[data-status-badge]")),
  challengeCard: document.getElementById("challenge-card") as HTMLElement,
  challengeEmpty: document.getElementById("challenge-empty") as HTMLElement,
  challengeAmount: document.getElementById("challenge-amount") as HTMLElement,
  challengeRecipient: document.getElementById("challenge-recipient") as HTMLElement,
  challengeId: document.getElementById("challenge-id") as HTMLElement,
  challengeExpiry: document.getElementById("challenge-expiry") as HTMLElement,
  challengeError: document.getElementById("challenge-error") as HTMLElement,
  sessionCard: document.getElementById("session-card") as HTMLElement,
  sessionUser: document.getElementById("session-user") as HTMLElement,
  sessionTx: document.getElementById("session-tx") as HTMLElement,
  sessionToken: document.getElementById("session-token") as HTMLElement,
  snippetApi: document.getElementById("snippet-api") as HTMLElement,
  snippetCurl: document.getElementById("snippet-curl") as HTMLElement,
  webhookInput: document.getElementById("webhook-input") as HTMLInputElement,
  buttonCreate: document.getElementById("btn-create-challenge") as HTMLButtonElement,
  buttonRefresh: document.getElementById("btn-refresh") as HTMLButtonElement,
  buttonRotate: document.getElementById("btn-rotate") as HTMLButtonButton,
  apiKeyCard: document.getElementById("apikey-card") as HTMLElement,
  apiKeyValue: document.getElementById("apikey-value") as HTMLElement,
  projectName: document.getElementById("project-name") as HTMLElement,
  authError: document.getElementById("auth-error") as HTMLElement,
  authShell: document.getElementById("auth-shell") as HTMLElement,
  authForm: document.getElementById("auth-form") as HTMLElement,
  authAuthed: document.getElementById("auth-authed") as HTMLElement,
  authUser: document.getElementById("auth-user") as HTMLElement,
  btnLogout: document.getElementById("btn-logout") as HTMLElement,
};

function setHidden(el: HTMLElement | null, hidden: boolean) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function shortEmail(email?: string | null) {
  if (!email) return "";
  return email.length > 24 ? `${email.slice(0, 12)}...${email.slice(-6)}` : email;
}

function stopPolling() {
  if (pollHandle) window.clearInterval(pollHandle);
  pollHandle = null;
}

function setStatus(next: Status) {
  status = next;
  setStatusBadges(next, els.badges);
}

function setChallengeError(message?: string) {
  if (!els.challengeError) return;
  els.challengeError.textContent = message ?? "";
  setHidden(els.challengeError, !message);
}

function renderChallenge(data: any) {
  if (!data) {
    setHidden(els.challengeCard, true);
    setHidden(els.challengeEmpty, false);
    return;
  }
  els.challengeAmount.textContent = formatLamports(data.amountLamports);
  els.challengeRecipient.textContent = data.recipient;
  els.challengeId.textContent = data.id;
  els.challengeExpiry.textContent = new Date(data.expiresAt).toLocaleTimeString();
  setHidden(els.challengeEmpty, false);
  setHidden(els.challengeCard, false);
}

function renderSession(data: any) {
  if (!data?.sessionToken) {
    setHidden(els.sessionCard, true);
    return;
  }
  els.sessionUser.textContent = data.userPubkey || "";
  els.sessionTx.textContent = data.txSignature || "";
  els.sessionToken.textContent = data.sessionToken || "";
  setHidden(els.sessionCard, false);
}

function updateSnippets() {
  const key = auth?.apiKey?.key ?? "<API_KEY>";
  const hookLine = webhookUrl ? `  webhookUrl: "${webhookUrl}"` : "";
  if (els.snippetApi)
    els.snippetApi.textContent = `await fetch("/api/challenge",\n  {\n    method: "POST",\n    headers: {\n      "x-api-key": "${key}",\n      "content-type": "application/json"\n    },\n    body: JSON.stringify({\n${hookLine}\n    })\n  }\n);`;
  if (els.snippetCurl)
    els.snippetCurl.textContent = `curl -X POST "/api/challenge" -H "x-api-key: ${key}" -H "content-type: application/json" ${webhookUrl ? `-d '{"webhookUrl":"${webhookUrl}"}'` : ""}`;
}

function renderAuth() {
  const loggedIn = Boolean(auth?.token);
  setHidden(els.authForm, true);
  setHidden(els.authAuthed, !loggedIn);
  if (loggedIn && els.authUser) {
    els.authUser.textContent = shortEmail(auth?.project?.name || auth?.email || "dev");
  }
  const hasKey = Boolean(auth?.apiKey?.key);
  setHidden(els.apiKeyCard, !hasKey);
  if (hasKey) {
    els.apiKeyValue.textContent = auth?.apiKey?.key ?? "";
    els.projectName.textContent = auth?.project?.name || "Your project";
  }
  updateSnippets();
}

function requireAuth() {
  if (auth?.token) return true;
  alert("Please log in on the home page to access the dashboard.");
  window.location.href = "/";
  return false;
}

async function startChallenge() {
  if (!requireAuth()) return;
  if (!auth?.apiKey?.key) {
    setChallengeError("No API key. Refresh or rotate after logging in.");
    return;
  }
  try {
    setStatus("pending");
    setChallengeError();
    renderSession(null);
    const data = await requestChallenge(auth.apiKey.key, webhookUrl || undefined);
    challengeId = data.id;
    renderChallenge(data);
    stopPolling();
    pollHandle = window.setInterval(async () => {
      if (!challengeId) return;
      try {
        const res = await pollAuth(challengeId);
        if (res.status === "authenticated") {
          setStatus("authenticated");
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
  } catch (err: any) {
    console.error(err);
    setStatus("error");
    setChallengeError(err?.message || "challenge failed");
  }
}

async function refreshMe() {
  if (!requireAuth()) return;
  try {
    const me = await fetchMe(auth!.token!);
    auth = auth ? { ...auth, ...me } : me;
    saveDevAuth(auth!);
    renderAuth();
  } catch (err: any) {
    console.error(err);
    setHidden(els.authError, false);
    if (els.authError) els.authError.textContent = err?.message || "refresh failed";
  }
}

async function rotate() {
  if (!requireAuth()) return;
  try {
    const res = await rotateKey(auth!.token!);
    auth = auth ? { ...auth, apiKey: res.apiKey } : auth;
    saveDevAuth(auth!);
    renderAuth();
  } catch (err: any) {
    console.error(err);
    setHidden(els.authError, false);
    if (els.authError) els.authError.textContent = err?.message || "rotate failed";
  }
}

function wireEvents() {
  els.buttonCreate?.addEventListener("click", startChallenge);
  els.buttonRefresh?.addEventListener("click", refreshMe);
  els.buttonRotate?.addEventListener("click", rotate);
  els.webhookInput?.addEventListener("input", (evt) => {
    webhookUrl = (evt.target as HTMLInputElement).value.trim();
    updateSnippets();
  });
  els.btnLogout?.addEventListener("click", () => {
    auth = null;
    saveDevAuth(null);
    renderAuth();
    window.location.href = "/";
  });
}

function init() {
  renderAuth();
  updateSnippets();
  wireEvents();
  if (!auth?.token) {
    setHidden(els.authForm, false);
    setHidden(els.authAuthed, true);
  }
}

init();
window.addEventListener("beforeunload", stopPolling);
