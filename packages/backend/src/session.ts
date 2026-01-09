import jwt from "jsonwebtoken";
import { SessionData } from "@safu/auth-shared";
import { saveSession } from "./store";
import { loadConfig } from "./config";

interface IssueSessionInput {
  challengeId: string;
  userPubkey: string;
  txSignature: string;
}

const config = loadConfig();

export async function issueSession(input: IssueSessionInput): Promise<SessionData> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1h expiry
  const payload = {
    sub: input.userPubkey,
    challengeId: input.challengeId,
    tx: input.txSignature,
    iat: now,
    exp,
  };
  const token = jwt.sign(payload, config.jwtSecret, { algorithm: "HS256" });
  const session: SessionData = {
    userPubkey: input.userPubkey,
    challengeId: input.challengeId,
    issuedAt: now * 1000,
    expiresAt: exp * 1000,
    jwt: token,
    txSignature: input.txSignature,
  };
  saveSession(input.challengeId, session);
  return session;
}
