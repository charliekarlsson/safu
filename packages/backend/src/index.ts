import express from "express";
import cors from "cors";
import { loadConfig } from "./config";
import { createChallenge } from "./challenge";
import { getChallenge, getSessionByChallenge, purgeExpired, listApiKeysForProject, getProject } from "./store";
import { startListener } from "./listener";
import { ensureDefaultProject, login, signup, verifyApiKey, verifyDevToken, rotateApiKey } from "./devAuth";

const config = loadConfig();
const app = express();

app.use(cors());
app.use(express.json());

ensureDefaultProject(config);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/challenge", (req, res) => {
  const apiKey = (req.headers["x-api-key"] as string) || "";
  const project = verifyApiKey(apiKey);
  if (!project) return res.status(401).json({ error: "invalid_api_key" });
  const challenge = createChallenge({ config, project, webhookUrl: req.body?.webhookUrl });
  res.json(challenge);
});

app.get("/api/poll-auth", (req, res) => {
  const id = (req.query.id as string) || "";
  const challenge = getChallenge(id);
  if (!challenge) return res.json({ status: "not_found" });
  if (challenge.status === "consumed") {
    const session = getSessionByChallenge(id);
    if (!session) return res.json({ status: "pending" });
    return res.json({
      status: "authenticated",
      sessionToken: session.jwt,
      userPubkey: session.userPubkey,
      txSignature: session.txSignature,
    });
  }
  if (Date.now() > challenge.expiresAt) return res.json({ status: "expired" });
  return res.json({ status: "pending" });
});

// Developer auth (demo-grade)
app.post("/api/dev/signup", (req, res) => {
  const { email, password, project } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });
  try {
    const result = signup(email, password, project || {}, config);
    res.json(result);
  } catch (err: any) {
    if (err.message === "user_exists") return res.status(400).json({ error: "user_exists" });
    res.status(500).json({ error: "signup_failed" });
  }
});

app.post("/api/dev/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });
  try {
    const result = login(email, password, config.jwtSecret);
    res.json(result);
  } catch (err: any) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
});

app.get("/api/dev/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const decoded = verifyDevToken(token, config.jwtSecret);
  if (!decoded) return res.status(401).json({ error: "unauthorized" });
  const project = getProject(decoded.projectId);
  if (!project) return res.status(404).json({ error: "project_missing" });
  const keys = listApiKeysForProject(project.id);
  const latestKey = keys[keys.length - 1];
  res.json({ project, apiKey: latestKey });
});

app.post("/api/dev/rotate-key", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const decoded = verifyDevToken(token, config.jwtSecret);
  if (!decoded) return res.status(401).json({ error: "unauthorized" });
  const project = getProject(decoded.projectId);
  if (!project) return res.status(404).json({ error: "project_missing" });
  const newKey = rotateApiKey(project.id);
  res.json({ apiKey: newKey });
});

app.listen(config.port, () => {
  console.log(`auth backend listening on ${config.port}`);
  startListener(config);
});

setInterval(() => purgeExpired(Date.now()), 10_000);
