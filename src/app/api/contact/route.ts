import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "node:crypto";
import { trustedOrigin } from "@/lib/request";
import { contactInput } from "@/lib/contact-input";
import { db } from "@/lib/db";
export async function POST(req: Request) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const text = await req.text();
    if (Buffer.byteLength(text) > 16000)
      return NextResponse.json(
        { error: "Your message is too long." },
        { status: 413 },
      );
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    }
    const parsed = contactInput.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const { website, ...input } = parsed.data;
    if (website)
      return NextResponse.json(
        { error: "Could not submit this enquiry." },
        { status: 400 },
      );
    // Limit by email rather than trusting a client-controlled forwarding header.
    const fingerprint = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
      .update(input.email.toLowerCase())
      .digest("hex");
    const reference = `ANL-${randomUUID().slice(0, 8).toUpperCase()}`;
    const saved = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${fingerprint}))`;
      const count = await tx.contactEnquiry.count({
        where: {
          fingerprint,
          createdAt: { gte: new Date(Date.now() - 3600000) },
        },
      });
      if (count >= 5) return false;
      await tx.contactEnquiry.create({
        data: {
          ...input,
          email: input.email.toLowerCase(),
          fingerprint,
          reference,
        },
      });
      return true;
    });
    if (!saved)
      return NextResponse.json(
        {
          error:
            "You’ve sent several messages recently. Please try again in an hour.",
        },
        { status: 429 },
      );
    return NextResponse.json(
      { reference },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "We couldn’t save your message. Please try again shortly." },
      { status: 503 },
    );
  }
}
