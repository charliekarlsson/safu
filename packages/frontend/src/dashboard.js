const STORAGE_KEY = "safu-dev-auth";
const API_BASE = (window.__SAFU_API_BASE__ || "").replace(/\/$/, "");
const SOL_DECIMALS = 1_000_000_000;

function api(path) {
  return `${API_BASE}${path}`;
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(val) {
  if (!val) return localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
}

function shortLabel(val) {
  if (!val) return "";
  return val.length > 24 ? `${val.slice(0, 12)}...${val.slice(-6)}` : val;
}

function formatLamports(lamports) {
  const amt = (lamports ?? 10_000) / SOL_DECIMALS;
  return `${amt.toFixed(5)} SOL`;
}

function statusColor(next) {
  if (next === "authenticated") return "var(--accent)";
  if (next === "expired" || next === "error") return "#ff8ba7";
  return "var(--muted)";
}

function statusLabel(next) {
  return next === "idle" ? "pending" : next;
}

function setStatusBadges(status, badges) {
  const label = statusLabel(status).toUpperCase();
  const color = statusColor(status);
  badges.forEach((badge) => {
    badge.textContent = `● ${label}`;
    badge.style.borderColor = color;
  });
}

async function fetchMe(token) {
  const res = await fetch(api("/api/dev/me"), { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

async function rotateKey(token) {
  const res = await fetch(api("/api/dev/rotate-key"), { method: "POST", headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("rotate failed");
  return res.json();
}

async function requestChallenge(apiKey, webhookUrl) {
  const res = await fetch(api("/api/challenge"), {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ webhookUrl }),
  });
  if (!res.ok) throw new Error("challenge failed");
  return res.json();
}

async function pollAuth(id) {
  const res = await fetch(api(`/api/poll-auth?id=${id}`));
  return res.json();
}

const els = {
  badges: Array.from(document.querySelectorAll("[data-status-badge]")),
  challengeCard: document.getElementById("challenge-card"),
  challengeEmpty: document.getElementById("challenge-empty"),
  challengeAmount: document.getElementById("challenge-amount"),
  challengeRecipient: document.getElementById("challenge-recipient"),
  challengeId: document.getElementById("challenge-id"),
  challengeExpiry: document.getElementById("challenge-expiry"),
  challengeError: document.getElementById("challenge-error"),
  sessionCard: document.getElementById("session-card"),
  sessionUser: document.getElementById("session-user"),
  sessionTx: document.getElementById("session-tx"),
  sessionToken: document.getElementById("session-token"),
  snippetApi: document.getElementById("snippet-api"),
  snippetCurl: document.getElementById("snippet-curl"),
  webhookInput: document.getElementById("webhook-input"),
  buttonCreate: document.getElementById("btn-create-challenge"),
  buttonRefresh: document.getElementById("btn-refresh"),
  buttonRotate: document.getElementById("btn-rotate"),
  apiKeyCard: document.getElementById("apikey-card"),
  apiKeyValue: document.getElementById("apikey-value"),
  projectName: document.getElementById("project-name"),
  authError: document.getElementById("auth-error"),
  authForm: document.getElementById("auth-form"),
  authAuthed: document.getElementById("auth-authed"),
  authUser: document.getElementById("auth-user"),
  btnLogout: document.getElementById("btn-logout"),
};

let auth = loadAuth();
let pollHandle = null;
let webhookUrl = "";
let challengeId = null;
let status = "idle";

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function stopPolling() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
}

function setStatus(next) {
  status = next;
  setStatusBadges(next, els.badges);
}

function setChallengeError(message) {
  if (!els.challengeError) return;
  els.challengeError.textContent = message || "";
  setHidden(els.challengeError, !message);
}

function renderChallenge(data) {
  if (!data) {
    setHidden(els.challengeCard, true);
    setHidden(els.challengeEmpty, false);
    return;
  }
  els.challengeAmount.textContent = formatLamports(data.amountLamports);
  els.challengeRecipient.textContent = data.recipient;
  els.challengeId.textContent = data.id;
  els.challengeExpiry.textContent = new Date(data.expiresAt).toLocaleTimeString();
  setHidden(els.challengeCard, false);
  setHidden(els.challengeEmpty, true);
}

function renderSession(data) {
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
  const key = auth?.apiKey?.key || "<API_KEY>";
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
  if (loggedIn && els.authUser) els.authUser.textContent = shortLabel(auth?.project?.name || auth?.email || "dev");
  const hasKey = Boolean(auth?.apiKey?.key);
  setHidden(els.apiKeyCard, !hasKey);
  if (hasKey) {
    els.apiKeyValue.textContent = auth.apiKey.key;
    els.projectName.textContent = auth.project?.name || "Your project";
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
    pollHandle = setInterval(async () => {
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
  } catch (err) {
    console.error(err);
    setStatus("error");
    setChallengeError(err?.message || "challenge failed");
  }
}

async function refreshMe() {
  if (!requireAuth()) return;
  try {
    const me = await fetchMe(auth.token);
    auth = { ...auth, ...me };
    saveAuth(auth);
    renderAuth();
  } catch (err) {
    console.error(err);
    setHidden(els.authError, false);
    if (els.authError) els.authError.textContent = err?.message || "refresh failed";
  }
}

async function rotate() {
  if (!requireAuth()) return;
  try {
    const res = await rotateKey(auth.token);
    auth = { ...auth, apiKey: res.apiKey };
    saveAuth(auth);
    renderAuth();
  } catch (err) {
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
    webhookUrl = evt.target.value.trim();
    updateSnippets();
  });
  els.btnLogout?.addEventListener("click", () => {
    auth = null;
    saveAuth(null);
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
