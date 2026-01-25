import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  solanaRpc: string;
  minLamports: number;
  challengeTtlMs: number;
  jwtSecret: string;
  commitment: "confirmed" | "finalized";
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT || 8787);
  const solanaRpc = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
  const minLamports = Number(process.env.MIN_LAMPORTS || 7_000);
  const challengeTtlMs = Number(process.env.CHALLENGE_TTL_MS || 5 * 60 * 1000);
  const jwtSecret = process.env.JWT_SECRET || "change-me";
  const commitment = (process.env.SOLANA_COMMITMENT || "confirmed") as "confirmed" | "finalized";

  return { port, solanaRpc, minLamports, challengeTtlMs, jwtSecret, commitment };
}
