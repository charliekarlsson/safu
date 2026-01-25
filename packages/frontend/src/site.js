const STORAGE_KEY = "safu-dev-auth";
const API_BASE = (window.__SAFU_API_BASE__ || "").replace(/\/$/, "");

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

async function signup(email, password) {
  const res = await fetch(api("/api/dev/signup"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("signup failed");
  return res.json();
}

async function login(email, password) {
  const res = await fetch(api("/api/dev/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("login failed");
  return res.json();
}

async function fetchMe(token) {
  const res = await fetch(api("/api/dev/me"), { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("unauthorized");
  return res.json();
}

function shortLabel(val) {
  if (!val) return "";
  return val.length > 24 ? `${val.slice(0, 12)}...${val.slice(-6)}` : val;
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

function wireScrollLinks() {
  document.querySelectorAll("[data-scroll]").forEach((el) => {
    const target = el.getAttribute("data-scroll");
    if (!target) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

async function bootstrapAuth() {
  const authForm = document.getElementById("auth-form");
  const authAuthed = document.getElementById("auth-authed");
  const authUser = document.getElementById("auth-user");
  const emailInput = document.getElementById("email-input");
  const passwordInput = document.getElementById("password-input");
  const btnLogin = document.getElementById("btn-login");
  const btnSignup = document.getElementById("btn-signup");
  const btnLogout = document.getElementById("btn-logout");

  let auth = loadAuth();

  const render = () => {
    const loggedIn = Boolean(auth?.token);
    setHidden(authForm, loggedIn);
    setHidden(authAuthed, !loggedIn);
    if (loggedIn && authUser) authUser.textContent = shortLabel(auth?.project?.name || auth?.email || "dev");
  };

  const handleAuth = async (mode) => {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();
    if (!email || !password) return alert("Email and password required.");
    try {
      const res = mode === "login" ? await login(email, password) : await signup(email, password);
      auth = res;
      saveAuth(res);
      render();
    } catch (err) {
      console.error(err);
      alert(`${mode} failed`);
    }
  };

  btnLogin?.addEventListener("click", () => handleAuth("login"));
  btnSignup?.addEventListener("click", () => handleAuth("signup"));
  btnLogout?.addEventListener("click", () => {
    auth = null;
    saveAuth(null);
    render();
  });

  if (auth?.token) {
    try {
      const me = await fetchMe(auth.token);
      auth = { ...auth, ...me };
      saveAuth(auth);
    } catch (err) {
      console.warn("refresh me failed", err);
      auth = null;
      saveAuth(null);
    }
  }

  render();
}

wireScrollLinks();
bootstrapAuth();
