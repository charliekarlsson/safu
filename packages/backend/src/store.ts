import { ApiKey, Challenge, ChallengeStatus, DevUser, ProjectConfig, SessionData } from "@safu/auth-shared";
import crypto from "crypto";

const challenges = new Map<string, Challenge>();
const recipientIndex = new Map<string, string>();
const sessionsByChallenge = new Map<string, SessionData>();
const projects = new Map<string, ProjectConfig>();
const apiKeys = new Map<string, ApiKey>();
const users = new Map<string, DevUser>();
const projectByApiKey = new Map<string, string>();
const apiKeysByProject = new Map<string, ApiKey[]>();

export function saveChallenge(challenge: Challenge) {
  challenges.set(challenge.id, challenge);
  recipientIndex.set(challenge.recipient, challenge.id);
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
}

export function markChallengeConsumed(
  id: string,
  fields: Pick<Challenge, "detectedFromPubkey" | "txSignature" | "receivedLamports">,
) {
  const existing = challenges.get(id);
  if (!existing) return;
  challenges.set(id, { ...existing, status: "consumed", ...fields });
}

export function saveSession(challengeId: string, session: SessionData) {
  sessionsByChallenge.set(challengeId, session);
}

export function getSessionByChallenge(challengeId: string): SessionData | undefined {
  return sessionsByChallenge.get(challengeId);
}

export function purgeExpired(now: number) {
  for (const [id, ch] of challenges.entries()) {
    if (ch.status === "pending" && now > ch.expiresAt) {
      updateChallengeStatus(id, "expired");
    }
  }
}

// Project + API key management (in-memory demo)
export function addProject(project: ProjectConfig): void {
  projects.set(project.id, project);
}

export function getProject(id: string): ProjectConfig | undefined {
  return projects.get(id);
}

export function upsertProject(project: ProjectConfig): void {
  projects.set(project.id, project);
}

export function createApiKey(projectId: string): ApiKey {
  const key = crypto.randomBytes(24).toString("hex");
  const apiKey: ApiKey = { key, projectId, createdAt: Date.now() };
  apiKeys.set(key, apiKey);
  projectByApiKey.set(key, projectId);
  const existing = apiKeysByProject.get(projectId) || [];
  apiKeysByProject.set(projectId, [...existing, apiKey]);
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
}

export function getUser(email: string): DevUser | undefined {
  return users.get(email);
}
