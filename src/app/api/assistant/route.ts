import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_SYSTEM } from "@/lib/assistant/prompt";
import { ASSISTANT_TOOLS, runAssistantTool } from "@/lib/assistant/tools";
import {
  allowRequest,
  chatInput,
  visitorFingerprint,
} from "@/lib/assistant/limits";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 5;
const CONTACT =
  "I can’t answer that right now. Please use the Contact page (/contact) and the ANLIMA team will help.";

// Newline-delimited JSON events for the chat window.
type Event =
  { t: "text"; v: string } | { t: "error"; v: string } | { t: "done" };
const line = (e: Event) => `${JSON.stringify(e)}\n`;
const reply = (status: number, message: string) =>
  new Response(line({ t: "error", v: message }), {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });

export async function POST(req: Request) {
  if (
    req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return reply(403, "Invalid origin.");
  if (!process.env.ANTHROPIC_API_KEY)
    return reply(503, "The assistant is not available yet. " + CONTACT);
  const parsed = chatInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return reply(400, "Please keep messages short and try again.");
  const limited = await allowRequest(visitorFingerprint(req));
  if (limited) return reply(429, limited);

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = parsed.data.messages;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(line(e)));
      let wroteText = false;
      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = client.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 4000,
              // Chat is quick back-and-forth: low effort keeps replies fast
              // and inexpensive.
              output_config: { effort: "low" },
              // If Opus declines on safety grounds, Anthropic re-runs the
              // request on a suitable fallback model in the same call.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
              system: [
                {
                  type: "text",
                  text: ASSISTANT_SYSTEM,
                  cache_control: { type: "ephemeral" },
                },
              ],
              tools: ASSISTANT_TOOLS,
              messages,
            },
            { signal: req.signal },
          );
          let separated = !wroteText;
          stream.on("text", (delta) => {
            if (!separated) {
              send({ t: "text", v: "\n\n" });
              separated = true;
            }
            wroteText = true;
            send({ t: "text", v: delta });
          });
          const message = await stream.finalMessage();

          if (message.stop_reason === "refusal") {
            send({
              t: "text",
              v:
                (wroteText ? "\n\n" : "") +
                "I can’t help with that. " +
                CONTACT,
            });
            break;
          }
          const toolUses = message.content.filter(
            (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
          );
          if (message.stop_reason !== "tool_use" || !toolUses.length) {
            if (message.stop_reason === "max_tokens")
              send({ t: "text", v: "…" });
            break;
          }
          // Pass the full turn back unchanged (including thinking blocks).
          messages.push({ role: "assistant", content: message.content });
          const results = await Promise.all(
            toolUses.map(async (tool) => {
              const result = await runAssistantTool(tool.name, tool.input);
              return {
                type: "tool_result" as const,
                tool_use_id: tool.id,
                content: result.content,
                is_error: result.isError,
              };
            }),
          );
          messages.push({ role: "user", content: results });
          if (round === MAX_TOOL_ROUNDS - 1)
            send({
              t: "text",
              v: "\n\nI couldn’t finish checking that. Please try a simpler question.",
            });
        }
        send({ t: "done" });
      } catch (error) {
        if (req.signal.aborted) {
          // The visitor closed the chat; nothing to report.
        } else if (error instanceof Anthropic.RateLimitError) {
          send({
            t: "error",
            v: "The assistant is busy. Please try again shortly.",
          });
        } else {
          if (error instanceof Anthropic.AuthenticationError)
            console.error("Assistant: Anthropic API key was rejected.");
          else console.error("Assistant error", error);
          send({ t: "error", v: CONTACT });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
