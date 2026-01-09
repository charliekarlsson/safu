import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ApiKey, DevLoginResponse, DevUser, ProjectConfig } from "@safu/auth-shared";
import { createApiKey, createUser, getProject, getProjectByApiKey, getUser, addProject, listApiKeysForProject } from "./store";
import { AppConfig } from "./config";

function hashPassword(pw: string) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

export function ensureDefaultProject(config: AppConfig) {
  const existing = getProject("default");
  if (existing) return;
  const project: ProjectConfig = {
    id: "default",
    name: "Default Project",
    minLamports: config.minLamports,
    challengeTtlMs: config.challengeTtlMs,
    commitment: config.commitment,
  };
  addProject(project);
  createApiKey(project.id);
}

export function signup(email: string, password: string, cfg: Partial<ProjectConfig>, app: AppConfig): DevLoginResponse {
  if (getUser(email)) {
    throw new Error("user_exists");
  }
  const projectId = crypto.randomUUID();
  const project: ProjectConfig = {
    id: projectId,
    name: cfg.name || `${email}'s project`,
    minLamports: cfg.minLamports || app.minLamports,
    challengeTtlMs: cfg.challengeTtlMs || app.challengeTtlMs,
    commitment: cfg.commitment || app.commitment,
    webhookUrl: cfg.webhookUrl,
  };
  addProject(project);
  const apiKey = createApiKey(projectId);
  const user: DevUser = { id: crypto.randomUUID(), email, passwordHash: hashPassword(password), projectId };
  createUser(user);
  const token = issueDevJwt(user, app.jwtSecret);
  return { token, project, apiKey };
}

export function login(email: string, password: string, secret: string): DevLoginResponse {
  const user = getUser(email);
  if (!user) throw new Error("invalid_credentials");
  const pwHash = hashPassword(password);
  if (pwHash !== user.passwordHash) throw new Error("invalid_credentials");
  const project = getProject(user.projectId);
  if (!project) throw new Error("project_missing");
  const keys = listApiKeysForProject(project.id);
  const latestKey = keys[keys.length - 1] || createApiKey(project.id);
  const token = issueDevJwt(user, secret);
  return { token, project, apiKey: latestKey };
}

function issueDevJwt(user: DevUser, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24;
  return jwt.sign({ sub: user.id, email: user.email, projectId: user.projectId, iat: now, exp }, secret, {
    algorithm: "HS256",
  });
}

export function verifyApiKey(key?: string | null) {
  if (!key) return undefined;
  return getProjectByApiKey(key);
}

export function rotateApiKey(projectId: string): ApiKey {
  return createApiKey(projectId);
}

export function verifyDevToken(token: string, secret: string): { userId: string; projectId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, secret) as any;
    return { userId: decoded.sub, projectId: decoded.projectId, email: decoded.email };
  } catch (err) {
    return null;
  }
}
