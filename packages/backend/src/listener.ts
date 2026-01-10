import { Connection, PublicKey } from "@solana/web3.js";
// Listener subscribes per-recipient (and a fixed receiver) to avoid global log floods.
import { getChallengeByRecipient, markChallengeConsumed } from "./store";
import { AppConfig } from "./config";
import { issueSession } from "./session";
import { postWebhook } from "./webhook";

let conn: Connection | null = null;
const subscriptions = new Map<string, number>();

function ensureConn(config: AppConfig): Connection {
  if (!conn) {
    conn = new Connection(config.solanaRpc, config.commitment);
  }
  return conn;
}

async function handleLogs(sig: string, destination: string, config: AppConfig) {
  if (!conn) return;
  console.log("listener log event", { sig, destination });
  const parsed = await conn.getParsedTransaction(sig, {
    commitment: config.commitment,
    // Allow versioned transactions
    maxSupportedTransactionVersion: undefined,
  });
  if (!parsed) {
    console.log("listener parsed tx missing", { sig });
    return;
  }

  const instructions = parsed.transaction.message.instructions;
  const summary = instructions.map((inst) => {
    const ix = "parsed" in inst ? inst.parsed : null;
    const info: any = ix?.info || {};
    return {
      program: ix?.program,
      type: ix?.type,
      destination: info.destination,
      source: info.source,
      lamports: info.lamports,
    };
  });
  console.log("listener parsed summary", { sig, summary });

  let matched = false;
  for (const inst of instructions) {
    const ix = "parsed" in inst ? inst.parsed : null;
    if (!ix || ix.type !== "transfer") continue;
    const info: any = ix.info;
    const dest = info.destination as string;
    const source = info.source as string;
    const lamports = Number(info.lamports);

    if (dest !== destination) continue;

    const challenge = getChallengeByRecipient(dest);
    if (!challenge) {
      console.log("listener no challenge", { sig, dest, lamports });
      continue;
    }
    if (challenge.status !== "pending") {
      console.log("listener challenge not pending", { sig, dest, status: challenge.status, id: challenge.id });
      continue;
    }
    if (Date.now() > challenge.expiresAt) {
      console.log("listener challenge expired", { sig, dest, id: challenge.id, expiresAt: challenge.expiresAt });
      continue;
    }
    if (lamports < challenge.amountLamports) {
      console.log("listener amount too low", { sig, dest, lamports, required: challenge.amountLamports, id: challenge.id });
      continue;
    }

    console.log("listener match", { sig, dest, lamports, challengeId: challenge.id });
    matched = true;

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

  if (!matched) {
    console.log("listener no transfer match", { sig, destination });
  }
}

export function watchRecipient(recipient: string, config: AppConfig) {
  const connection = ensureConn(config);
  if (subscriptions.has(recipient)) return;

  const pubkey = new PublicKey(recipient);
  const subId = connection.onLogs(
    pubkey,
    async (log) => {
      try {
        console.log("listener received log", { signature: log.signature, err: log.err });
        await handleLogs(log.signature, recipient, config);
      } catch (err) {
        console.error("listener error", err);
      }
    },
    config.commitment,
  );
  subscriptions.set(recipient, subId);
  console.log("listener subscribed", { recipient, subId });
}

export function startListener(config: AppConfig) {
  // Initialize connection; recipients are subscribed as challenges are created.
  ensureConn(config);
  // Pre-subscribe the fixed receiver used by the frontend, so we don't miss sends before /api/micro-login is called.
  const FIXED_RECEIVER = "SAFUtzJsoJFtnKXLRZVYDgNosYfzXqkxhWwAtA9NPpB";
  watchRecipient(FIXED_RECEIVER, config);
}
