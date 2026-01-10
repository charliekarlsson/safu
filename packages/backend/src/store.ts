import { ApiKey, Challenge, ChallengeStatus, DevUser, ProjectConfig, SessionData } from "@safu/auth-shared";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const challenges = new Map<string, Challenge>();
const recipientIndex = new Map<string, string>();
const sessionsByChallenge = new Map<string, SessionData>();
const projects = new Map<string, ProjectConfig>();
const apiKeys = new Map<string, ApiKey>();
const users = new Map<string, DevUser>();
const projectByApiKey = new Map<string, string>();
const apiKeysByProject = new Map<string, ApiKey[]>();

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json");

function persist() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const payload = {
      challenges: Array.from(challenges.values()),
      sessions: Array.from(sessionsByChallenge.values()),
      projects: Array.from(projects.values()),
      apiKeys: Array.from(apiKeys.values()),
      users: Array.from(users.values()),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.error("store persist failed", err);
  }
}

function loadState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    if (!raw) return;
    const data = JSON.parse(raw) as any;

    (data.projects || []).forEach((p: ProjectConfig) => {
      projects.set(p.id, p);
    });

    (data.apiKeys || []).forEach((k: ApiKey) => {
      apiKeys.set(k.key, k);
      projectByApiKey.set(k.key, k.projectId);
      const existing = apiKeysByProject.get(k.projectId) || [];
      apiKeysByProject.set(k.projectId, [...existing, k]);
    });

    (data.challenges || []).forEach((c: Challenge) => {
      challenges.set(c.id, c);
      recipientIndex.set(c.recipient, c.id);
    });

    (data.sessions || []).forEach((s: SessionData) => {
      sessionsByChallenge.set(s.challengeId, s);
    });

    (data.users || []).forEach((u: DevUser) => {
      users.set(u.email, u);
    });
  } catch (err) {
    console.error("store load failed", err);
  }
}

loadState();

export function saveChallenge(challenge: Challenge) {
  challenges.set(challenge.id, challenge);
  recipientIndex.set(challenge.recipient, challenge.id);
  persist();
}

export function getChallenge(id: string): Challenge | undefined {
  return challenges.get(id);
}

export function getChallengeByRecipient(recipient: string): Challenge | undefined {
  const id = recipientIndex.get(recipient);
  if (!id) return undefined;
  return challenges.get(id);
}

export function updateChallengeStatus(id: string, status: ChallengeStatus) {
  const existing = challenges.get(id);
  if (!existing) return;
  challenges.set(id, { ...existing, status });
  persist();
}

export function markChallengeConsumed(
  id: string,
  fields: Pick<Challenge, "detectedFromPubkey" | "txSignature" | "receivedLamports">,
) {
  const existing = challenges.get(id);
  if (!existing) return;
  challenges.set(id, { ...existing, status: "consumed", ...fields });
  persist();
}

export function saveSession(challengeId: string, session: SessionData) {
  sessionsByChallenge.set(challengeId, session);
  persist();
}

export function getSessionByChallenge(challengeId: string): SessionData | undefined {
  return sessionsByChallenge.get(challengeId);
}

export function purgeExpired(now: number) {
  let mutated = false;
  for (const [id, ch] of challenges.entries()) {
    if (ch.status === "pending" && now > ch.expiresAt) {
      updateChallengeStatus(id, "expired");
      mutated = true;
    }
  }
  if (mutated) persist();
}

// Project + API key management (in-memory demo)
export function addProject(project: ProjectConfig): void {
  projects.set(project.id, project);
  persist();
}

export function getProject(id: string): ProjectConfig | undefined {
  return projects.get(id);
}

export function upsertProject(project: ProjectConfig): void {
  projects.set(project.id, project);
  persist();
}

export function createApiKey(projectId: string): ApiKey {
  const key = crypto.randomBytes(24).toString("hex");
  const apiKey: ApiKey = { key, projectId, createdAt: Date.now() };
  apiKeys.set(key, apiKey);
  projectByApiKey.set(key, projectId);
  const existing = apiKeysByProject.get(projectId) || [];
  apiKeysByProject.set(projectId, [...existing, apiKey]);
  persist();
  return apiKey;
}

export function getProjectByApiKey(key: string): ProjectConfig | undefined {
  const projectId = projectByApiKey.get(key);
  if (!projectId) return undefined;
  return projects.get(projectId);
}

export function getApiKey(key: string): ApiKey | undefined {
  return apiKeys.get(key);
}

export function listApiKeysForProject(projectId: string): ApiKey[] {
  return apiKeysByProject.get(projectId) || [];
}

// User management (demo-only, plaintext hash)
export function createUser(user: DevUser): void {
  users.set(user.email, user);
  persist();
}

export function getUser(email: string): DevUser | undefined {
  return users.get(email);
}
