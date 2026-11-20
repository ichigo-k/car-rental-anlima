import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { trustedOrigin } from "@/lib/request";
import { deliverSoon } from "@/lib/notify";
import { DOCUMENT_KINDS, readDocumentFile } from "@/lib/documents";
// Staff open a customer's document (every view is logged) or decide on it.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff("customer.read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const doc = await db.customerDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bytes = await readDocumentFile(doc.storageKey);
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "DOCUMENT_VIEWED",
      entityId: doc.userId,
      detail: `${doc.kind} ${doc.id}`,
    },
  });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
const decision = z.discriminatedUnion("status", [
  z.object({ status: z.literal("APPROVED") }),
  z.object({
    status: z.literal("REJECTED"),
    reason: z.string().trim().min(5).max(300),
  }),
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let current;
  try {
    current = await requireStaff("booking.write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = decision.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Give a reason of at least 5 characters when rejecting." },
      { status: 400 },
    );
  const { id } = await params;
  const doc = await db.customerDocument.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const reason = parsed.data.status === "REJECTED" ? parsed.data.reason : null;
  await db.customerDocument.update({
    where: { id },
    data: {
      status: parsed.data.status,
      rejectionReason: reason,
      reviewedBy: current.user.id,
      reviewedAt: new Date(),
    },
  });
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: `DOCUMENT_${parsed.data.status}`,
      entityId: doc.userId,
      detail: `${doc.kind}${reason ? `: ${reason}` : ""}`,
    },
  });
  if (reason) {
    await db.notification.create({
      data: {
        template: "DOCUMENT_REJECTED",
        channel: "EMAIL",
        recipient: doc.user.email,
        subject: "Please upload your document again",
        body: `Hello ${doc.user.name.split(" ")[0]},\n\nWe could not accept your ${DOCUMENT_KINDS[doc.kind as keyof typeof DOCUMENT_KINDS].toLowerCase()}: ${reason}\n\nPlease upload a new copy at ${process.env.BETTER_AUTH_URL ?? ""}/account/documents\n\nANLIMA Car Rental`,
        dedupeKey: `DOCUMENT_REJECTED:${doc.id}:${Date.now()}`,
      },
    });
    deliverSoon();
  }
  return NextResponse.json({ ok: true });
}
