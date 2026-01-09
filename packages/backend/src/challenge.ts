import { Keypair } from "@solana/web3.js";
import { v4 as uuid } from "uuid";
import { Challenge, CreateChallengeResponse, ProjectConfig } from "@safu/auth-shared";
import { saveChallenge } from "./store";
import { AppConfig } from "./config";

interface ChallengeInput {
  config: AppConfig;
  project: ProjectConfig;
  webhookUrl?: string;
}

export function createChallenge(input: ChallengeInput): CreateChallengeResponse {
  const kp = Keypair.generate();
  const id = uuid();
  const challenge: Challenge = {
    id,
    recipient: kp.publicKey.toBase58(),
    recipientSecret: Buffer.from(kp.secretKey).toString("base64"),
    amountLamports: input.project.minLamports,
    expiresAt: Date.now() + input.project.challengeTtlMs,
    status: "pending",
    projectId: input.project.id,
    webhookUrl: input.webhookUrl || input.project.webhookUrl,
  };
  saveChallenge(challenge);
  return {
    id: challenge.id,
    recipient: challenge.recipient,
    amountLamports: challenge.amountLamports,
    expiresAt: challenge.expiresAt,
  };
}
