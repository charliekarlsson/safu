export type ChallengeStatus = "pending" | "consumed" | "expired";

export interface Challenge {
  id: string;
  recipient: string;
  recipientSecret: string;
  amountLamports: number;
  expiresAt: number;
  status: ChallengeStatus;
  detectedFromPubkey?: string;
  txSignature?: string;
  receivedLamports?: number;
  projectId?: string;
  webhookUrl?: string;
}

export interface CreateChallengeResponse {
  id: string;
  recipient: string;
  amountLamports: number;
  expiresAt: number;
}

export interface PollAuthResponse {
  status: "pending" | "authenticated" | "expired" | "not_found";
  sessionToken?: string;
  userPubkey?: string;
  txSignature?: string;
}

export interface SessionData {
  userPubkey: string;
  challengeId: string;
  issuedAt: number;
  expiresAt: number;
  jwt: string;
  txSignature?: string;
}

export const DEFAULT_LAMPORTS = 7_000; // 0.000007 SOL

// Developer/tenant types
export interface ProjectConfig {
  id: string;
  name: string;
  minLamports: number;
  challengeTtlMs: number;
  commitment: "confirmed" | "finalized";
  webhookUrl?: string;
}

export interface ApiKey {
  key: string;
  projectId: string;
  createdAt: number;
}

export interface DevUser {
  id: string;
  email: string;
  passwordHash: string;
  projectId: string;
}

export interface DevLoginResponse {
  token: string;
  project: ProjectConfig;
  apiKey: ApiKey;
}
