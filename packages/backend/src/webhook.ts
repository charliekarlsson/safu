import { Challenge } from "@safu/auth-shared";
import { SessionData } from "@safu/auth-shared";

export async function postWebhook(challenge: Challenge, session: SessionData) {
  if (!challenge.webhookUrl) return;
  try {
    await fetch(challenge.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        event: "challenge.consumed",
        challengeId: challenge.id,
        projectId: challenge.projectId,
        userPubkey: session.userPubkey,
        txSignature: session.txSignature,
        receivedLamports: challenge.receivedLamports,
        amountLamports: challenge.amountLamports,
        status: "authenticated",
      }),
    });
  } catch (err) {
    console.error("webhook failed", err);
  }
}
