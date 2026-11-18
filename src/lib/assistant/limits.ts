import { createHmac } from "node:crypto";
import { z } from "zod";
import { db } from "../db";

// Cost and abuse limits for the public chatbot.
export const PER_VISITOR_PER_10_MIN = 20;
export const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT ?? 500);
export const MAX_TURNS = 20;
export const MAX_MESSAGE_CHARS = 1000;

// The browser keeps the conversation; only plain text turns are accepted.
export const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(MAX_TURNS)
    .refine(
      (m) =>
        m[0].role === "user" &&
        m.at(-1)!.role === "user" &&
        m.at(-1)!.content.length <= MAX_MESSAGE_CHARS &&
        m.every((turn, i) => i === 0 || turn.role !== m[i - 1].role),
      "Messages must alternate, start and end with the visitor.",
    ),
});

// A keyed hash of the visitor's address and browser: enough to tell visitors
// apart for limits, without storing who they are.
export function visitorFingerprint(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "anlima")
    .update(`${ip}|${req.headers.get("user-agent") ?? ""}`)
    .digest("hex");
}

// Records the request and says whether it is within the limits. The daily
// ceiling caps spend even if fingerprints are spoofed.
export async function allowRequest(fingerprint: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint}))`;
    const [recent, today] = await Promise.all([
      tx.assistantRequest.count({
        where: {
          fingerprint,
          createdAt: { gt: new Date(now.getTime() - 10 * 60000) },
        },
      }),
      tx.assistantRequest.count({
        where: { createdAt: { gt: new Date(now.getTime() - 86400000) } },
      }),
    ]);
    if (recent >= PER_VISITOR_PER_10_MIN)
      return "You have sent a lot of messages. Please wait a few minutes and try again.";
    if (today >= DAILY_LIMIT)
      return "The assistant is very busy today. Please use the Contact page and our team will help.";
    await tx.assistantRequest.create({ data: { fingerprint } });
    // Keep the table small: rows older than a day are no longer needed.
    if (Math.random() < 0.02)
      await tx.assistantRequest.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - 2 * 86400000) } },
      });
    return null;
  });
}
