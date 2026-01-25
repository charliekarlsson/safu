import "./styles.css";
import { login, signup, fetchMe, loadDevAuth, saveDevAuth } from "./auth";

function shortEmail(email?: string | null) {
  if (!email) return "";
  return email.length > 24 ? `${email.slice(0, 12)}...${email.slice(-6)}` : email;
}

function setHidden(el: HTMLElement | null, hidden: boolean) {
  if (!el) return;
  el.classList.toggle("hidden", hidden);
}

async function bootstrapAuth() {
  const authForm = document.getElementById("auth-form");
  const authAuthed = document.getElementById("auth-authed");
  const authUser = document.getElementById("auth-user");
  const emailInput = document.getElementById("email-input") as HTMLInputElement | null;
  const passwordInput = document.getElementById("password-input") as HTMLInputElement | null;
  const btnLogin = document.getElementById("btn-login");
  const btnSignup = document.getElementById("btn-signup");
  const btnLogout = document.getElementById("btn-logout");

  let auth = loadDevAuth();

  const render = () => {
    const loggedIn = Boolean(auth?.token);
    setHidden(authForm, loggedIn);
    setHidden(authAuthed, !loggedIn);
    if (loggedIn && authUser) authUser.textContent = shortEmail(auth?.project?.name || auth?.email || "dev");
  };

  const doLogin = async (mode: "login" | "signup") => {
    if (!emailInput || !passwordInput) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) return;
    try {
      const res = mode === "login" ? await login(email, password) : await signup(email, password);
      auth = res;
      saveDevAuth(res);
      render();
    } catch (err) {
      console.error(err);
      alert(`${mode} failed`);
    }
  };

  btnLogin?.addEventListener("click", () => doLogin("login"));
  btnSignup?.addEventListener("click", () => doLogin("signup"));
  btnLogout?.addEventListener("click", () => {
    auth = null;
    saveDevAuth(null);
    render();
  });

  if (auth?.token) {
    try {
      const me = await fetchMe(auth.token);
      auth = { ...auth, ...me } as any;
      saveDevAuth(auth);
    } catch (err) {
      console.warn("refresh me failed", err);
      auth = null;
      saveDevAuth(null);
    }
  }

  render();
}

function wireScrollLinks() {
  document.querySelectorAll<HTMLElement>("[data-scroll]").forEach((el) => {
    const target = el.getAttribute("data-scroll");
    if (!target) return;
    el.addEventListener("click", (evt) => {
      evt.preventDefault();
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

bootstrapAuth();
wireScrollLinks();
