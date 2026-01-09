import { Connection } from "@solana/web3.js";
import { getChallengeByRecipient, markChallengeConsumed } from "./store";
import { AppConfig } from "./config";
import { issueSession } from "./session";
import { postWebhook } from "./webhook";

export function startListener(config: AppConfig) {
  const conn = new Connection(config.solanaRpc, config.commitment);
  conn.onLogs("all", async (log) => {
    try {
      const sig = log.signature;
      const parsed = await conn.getParsedTransaction(sig, {
        commitment: config.commitment,
        maxSupportedTransactionVersion: 0,
      });
      if (!parsed) return;
      const instructions = parsed.transaction.message.instructions;
      for (const inst of instructions) {
        const ix = "parsed" in inst ? inst.parsed : null;
        if (!ix || ix.type !== "transfer") continue;
        const info: any = ix.info;
        const destination = info.destination as string;
        const source = info.source as string;
        const lamports = Number(info.lamports);

        const challenge = getChallengeByRecipient(destination);
        if (!challenge) continue;
        if (challenge.status !== "pending") continue;
        if (Date.now() > challenge.expiresAt) continue;
        if (lamports < challenge.amountLamports) continue;

        markChallengeConsumed(challenge.id, {
          detectedFromPubkey: source,
          txSignature: sig,
          receivedLamports: lamports,
        });

        const session = await issueSession({
          challengeId: challenge.id,
          userPubkey: source,
          txSignature: sig,
        });

        await postWebhook({ ...challenge, detectedFromPubkey: source, txSignature: sig, receivedLamports: lamports }, session);
      }
    } catch (err) {
      console.error("listener error", err);
    }
  });
}
