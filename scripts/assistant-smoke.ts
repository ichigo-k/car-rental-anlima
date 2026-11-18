import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
// Runs the chat route against a local stand-in for the Anthropic Messages
// API: streaming, the tool loop over live fleet data, refusals, input
// validation and rate limits. No request reaches Anthropic.
const db = new PrismaClient();
const suffix = randomBytes(5).toString("hex");
type Req = { headers: IncomingMessage["headers"]; body: any };
const seen: Req[] = [];
const sse = (events: object[]) =>
  events
    .map(
      (e) =>
        `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`,
    )
    .join("");
const start = {
  type: "message_start",
  message: {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 0 },
  },
};
const text = (index: number, value: string) => [
  {
    type: "content_block_start",
    index,
    content_block: { type: "text", text: "" },
  },
  {
    type: "content_block_delta",
    index,
    delta: { type: "text_delta", text: value },
  },
  { type: "content_block_stop", index },
];
const end = (stop_reason: string) => [
  {
    type: "message_delta",
    delta: { stop_reason, stop_sequence: null },
    usage: { output_tokens: 5 },
  },
  { type: "message_stop" },
];
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    seen.push({ headers: req.headers, body });
    res.setHeader("Content-Type", "text/event-stream");
    const last = body.messages.at(-1);
    const question =
      typeof last.content === "string" ? last.content : "(tool results)";
    if (question.includes("REFUSE"))
      return res.end(sse([start, ...text(0, ""), ...end("refusal")]));
    if (
      Array.isArray(last.content) &&
      last.content[0]?.type === "tool_result"
    ) {
      const result = JSON.parse(last.content[0].content);
      const name = result.cars?.[0]?.name ?? "nothing";
      return res.end(
        sse([
          start,
          ...text(
            0,
            `We have the ${name} at /fleet/${result.cars?.[0]?.slug}.`,
          ),
          ...end("end_turn"),
        ]),
      );
    }
    return res.end(
      sse([
        start,
        ...text(0, "Let me check."),
        {
          type: "content_block_start",
          index: 1,
          content_block: {
            type: "tool_use",
            id: "toolu_1",
            name: "search_cars",
            input: {},
          },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: {
            type: "input_json_delta",
            partial_json: `{"category":"Assistant${suffix}"}`,
          },
        },
        { type: "content_block_stop", index: 1 },
        ...end("tool_use"),
      ]),
    );
  });
});
let vehicleId = "";
async function main() {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const car = await db.vehicle.create({
    data: {
      slug: `assistant-${suffix}`,
      name: `Assistant Test Car ${suffix}`,
      category: `Assistant${suffix}`,
      seats: 5,
      dailyRate: 85000,
      image: "/images/anlima-hero.png",
      description: "Temporary assistant fixture",
    },
  });
  vehicleId = car.id;
  const { POST } = await import("../src/app/api/assistant/route");
  const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
  const ask = (
    messages: object[],
    ip = `10.0.0.${Math.floor(Math.random() * 200)}`,
  ) =>
    POST(
      new Request(`${origin}/api/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "x-forwarded-for": ip,
          "user-agent": `assistant-smoke-${suffix}`,
        },
        body: JSON.stringify({ messages }),
      }),
    );
  const events = async (res: Response) =>
    (await res.text())
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { t: string; v?: string });

  const res = await ask([{ role: "user", content: "Which SUVs do you have?" }]);
  assert.equal(res.status, 200);
  const out = await events(res);
  const reply = out
    .filter((e) => e.t === "text")
    .map((e) => e.v)
    .join("");
  assert.match(reply, /Let me check\./);
  assert.match(
    reply,
    new RegExp(`Assistant Test Car ${suffix}`),
    "uses live fleet data",
  );
  assert.match(reply, new RegExp(`/fleet/assistant-${suffix}`));
  assert.equal(out.at(-1)?.t, "done");
  const first = seen[0];
  assert.equal(first.body.model, "claude-opus-5-5");
  assert.equal(first.body.output_config.effort, "low");
  assert.equal(first.body.fallbacks, "default");
  assert.match(
    String(first.headers["anthropic-beta"]),
    /server-side-fallback-2026-07-01/,
  );
  assert.deepEqual(first.body.system[0].cache_control, { type: "ephemeral" });
  assert.deepEqual(
    first.body.tools.map((t: { name: string }) => t.name),
    ["search_cars", "check_availability", "get_rental_terms"],
  );
  const second = seen[1];
  assert.equal(
    second.body.messages.length,
    3,
    "assistant turn and tool result appended",
  );
  assert.equal(second.body.messages[1].role, "assistant");
  assert.equal(second.body.messages[2].content[0].tool_use_id, "toolu_1");

  const refused = await events(
    await ask([{ role: "user", content: "REFUSE this please" }]),
  );
  assert.match(
    refused
      .filter((e) => e.t === "text")
      .map((e) => e.v)
      .join(""),
    /Contact page/,
    "refusals point to the Contact page",
  );

  assert.equal(
    (await ask([{ role: "assistant", content: "hi" }])).status,
    400,
    "conversations start with the visitor",
  );
  assert.equal(
    (await ask([{ role: "user", content: "x".repeat(1001) }])).status,
    400,
    "long messages are refused",
  );
  const before = seen.length;
  const ip = `10.9.${Math.floor(Math.random() * 200)}.1`;
  let limited = 0;
  for (let i = 0; i < 21; i++) {
    const r = await ask([{ role: "user", content: "REFUSE quick" }], ip);
    if (r.status === 429) limited += 1;
    await r.text();
  }
  assert.equal(limited, 1, "the 21st message in 10 minutes is refused");
  assert.equal(seen.length - before, 20, "refused messages never reach Claude");
  console.log(
    "PASS: streamed replies, tool loop over live fleet data, Opus 5.5 at low effort with refusal fallback, cached instructions, refusal handling, input validation and per-visitor rate limit. No request reached Anthropic.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (vehicleId) await db.vehicle.delete({ where: { id: vehicleId } });
    // Rate-limit rows hold only hashes, so this run's rows cannot be picked
    // out: remove the last hour's. Run only where there is no live chat.
    await db.assistantRequest.deleteMany({
      where: { createdAt: { gt: new Date(Date.now() - 3600000) } },
    });
    server.close();
    await db.$disconnect();
  });
