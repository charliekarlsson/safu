import { useEffect, useMemo, useState } from "react";
import {
  CreateChallengeResponse,
  PollAuthResponse,
  DEFAULT_LAMPORTS,
  DevLoginResponse,
} from "@safu/auth-shared";

type Status = "idle" | "pending" | "authenticated" | "expired" | "error";

async function requestChallenge(apiKey?: string): Promise<CreateChallengeResponse> {
  const res = await fetch("/api/challenge", { method: "POST", headers: { "x-api-key": apiKey || "" } });
  if (!res.ok) throw new Error("challenge failed");
  return res.json();
}

async function pollAuth(id: string): Promise<PollAuthResponse> {
  const res = await fetch(`/api/poll-auth?id=${id}`);
  return res.json();
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <pre className="code">{code}</pre>
    </div>
  );
}

function FlowStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="step">
      <div className="mono" style={{ color: "var(--magenta)", fontSize: 12 }}>
        {title}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 14 }}>{body}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const color = status === "authenticated" ? "var(--cyan)" : status === "expired" || status === "error" ? "#ff8ba7" : "var(--muted)";
  return (
    <span className="status" style={{ borderColor: color }}>
      ● {status.toUpperCase()}
    </span>
  );
}

export default function App() {
  const [challenge, setChallenge] = useState<CreateChallengeResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [session, setSession] = useState<PollAuthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devAuth, setDevAuth] = useState<DevLoginResponse | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!challenge) return;
    setStatus("pending");
    const interval = setInterval(async () => {
      try {
        const res = await pollAuth(challenge.id);
        if (res.status === "authenticated") {
          setStatus("authenticated");
          setSession(res);
          clearInterval(interval);
        } else if (res.status === "expired") {
          setStatus("expired");
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [challenge]);

  const amountSol = useMemo(() => {
    const lamports = challenge?.amountLamports ?? DEFAULT_LAMPORTS;
    return lamports / 1_000_000_000;
  }, [challenge]);

  const backendSnippet = `POST /api/challenge -> { id, recipient, amountLamports, expiresAt }
GET  /api/poll-auth?id=... -> { status, sessionToken?, userPubkey? }
Listener: on matching transfer => issue JWT bound to sender pubkey`;

  const listenerSnippet = `conn.onLogs('all', (log) => {
  const tx = getParsedTransaction(log.signature)
  for each transfer:
    if destination == ephemeral recipient
      verify amount & expiry
      mark challenge consumed
      issue session JWT
})`;

  const handleNewChallenge = async () => {
    setError(null);
    setSession(null);
    try {
      const next = await requestChallenge(devAuth?.apiKey?.key);
      setChallenge(next);
      setStatus("pending");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Failed to create challenge");
    }
  };

  return (
    <main className="main">
      <section className="hero">
        <span className="badge">SAFU AUTH · SOLANA</span>
        <h1>Micro-transaction login, no signatures.</h1>
        <p className="lead">
          Drop the risky message-sign popups. Authenticate by sending a tiny SOL transfer to a one-time recipient.
          Backend matches the tx and issues a session bound to the sender pubkey.
        </p>
        <div className="inline">
          <button className="button" onClick={handleNewChallenge}>Start demo challenge</button>
          <StatusBadge status={status === "idle" ? "pending" : status} />
          {session?.userPubkey && (
            <span className="mono" style={{ color: "var(--cyan)" }}>
              {session.userPubkey.slice(0, 6)}…{session.userPubkey.slice(-4)} authenticated
            </span>
          )}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Developer console</h2>
        <p className="mono" style={{ color: "var(--muted)", marginBottom: 10 }}>
          Sign up to get an API key. Use header x-api-key on /api/challenge.
        </p>
        <div className="inline" style={{ gap: 12, flexWrap: "wrap" }}>
          <input
            placeholder="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(233,236,241,0.1)", background: "rgba(233,236,241,0.04)", color: "var(--text)" }}
          />
          <input
            placeholder="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(233,236,241,0.1)", background: "rgba(233,236,241,0.04)", color: "var(--text)" }}
          />
          <button className="button" onClick={async () => {
            setAuthError(null);
            try {
              const res = await fetch("/api/dev/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.email, password: form.password }) });
              if (!res.ok) throw new Error("signup failed");
              const data = (await res.json()) as DevLoginResponse;
              setDevAuth(data);
            } catch (err: any) {
              setAuthError(err.message);
            }
          }}>Sign up</button>
          <button className="button" style={{ background: "rgba(63,210,199,0.15)", color: "var(--text)" }} onClick={async () => {
            setAuthError(null);
            try {
              const res = await fetch("/api/dev/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.email, password: form.password }) });
              if (!res.ok) throw new Error("login failed");
              const data = (await res.json()) as DevLoginResponse;
              setDevAuth(data);
            } catch (err: any) {
              setAuthError(err.message);
            }
          }}>Log in</button>
          {devAuth?.apiKey?.key && (
            <span className="mono" style={{ color: "var(--cyan)" }}>API KEY: {devAuth.apiKey.key}</span>
          )}
        </div>
        {authError && <p style={{ color: "#ff8ba7" }}>{authError}</p>}
      </section>

      <section className="grid">
        <div className="card">
          <h2>How it works</h2>
          <p>Backend mints a one-time recipient and required lamports. You send a micro-tx. Listener verifies and issues JWT.</p>
          <p className="mono">Min amount: {amountSol.toFixed(5)} SOL · TTL: 5m · Commitment: confirmed</p>
        </div>
        <div className="card">
          <h2>Login demo</h2>
          {challenge ? (
            <>
              <p>Send exactly {amountSol} SOL to the one-time address:</p>
              <div className="address">{challenge.recipient}</div>
              <p className="mono">Expires at: {new Date(challenge.expiresAt).toLocaleTimeString()}</p>
              <p className="mono">Challenge ID: {challenge.id}</p>
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>Click "Start demo challenge" to generate an ephemeral recipient.</p>
          )}
          {error && <p style={{ color: "#ff8ba7" }}>{error}</p>}
        </div>
      </section>

      <section className="grid">
        <CodeBlock title="API surface" code={backendSnippet} />
        <CodeBlock title="Listener sketch" code={listenerSnippet} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Flow</h2>
        <div className="flow">
          <FlowStep title="1. Issue challenge" body="Backend creates ephemeral recipient + min lamports + expiry." />
          <FlowStep title="2. User sends" body="Wallet sends micro SOL to displayed address. No signatures." />
          <FlowStep title="3. Listener verifies" body="Match recipient, amount, TTL; mark consumed; emit session." />
          <FlowStep title="4. Session issued" body="Client polls /api/poll-auth and receives JWT scoped to sender pubkey." />
        </div>
      </section>
    </main>
  );
}
