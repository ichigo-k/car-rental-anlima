import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { emailConfigured, smsConfigured } from "@/lib/notify/providers";
import { ResendNotification } from "@/components/resend-notification";
export const dynamic = "force-dynamic";
const STATUSES = ["QUEUED", "SENT", "FAILED"];
const label = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  if (!can(current.user.role, "booking.read"))
    return <p>Booking access required.</p>;
  const q = await searchParams;
  const status = STATUSES.includes(q.status ?? "") ? q.status : undefined;
  const [messages, counts] = await Promise.all([
    db.notification.findMany({
      where: status ? { status } : {},
      include: { booking: { select: { reference: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.notification.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const canResend = can(current.user.role, "booking.write");
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">CUSTOMER MESSAGES</p>
          <h1>Notifications</h1>
          <p>
            Booking emails and text messages. A message that cannot be sent
            never affects the booking; resend it from here.
          </p>
        </div>
      </div>
      {(!emailConfigured() || !smsConfigured()) && (
        <p className="admin-callout">
          {!emailConfigured() && "Email (Resend) is not connected yet. "}
          {!smsConfigured() && "SMS (SMSOnlineGH) is not connected yet. "}
          Messages are kept in the queue and sent automatically once the keys
          are added.
        </p>
      )}
      <nav className="admin-filters" aria-label="Message status">
        <Link href="/admin/notifications">All</Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/notifications?status=${s}`}
            aria-current={status === s ? "page" : undefined}
          >
            {label(s)} ({count(s)})
          </Link>
        ))}
      </nav>
      <section className="admin-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Booking</th>
              <th>Message</th>
              <th>To</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {messages.map((n) => (
              <tr key={n.id}>
                <td>
                  {n.createdAt.toLocaleString("en-GB", {
                    timeZone: "Africa/Accra",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td>
                  {n.booking ? (
                    <Link href={`/admin/bookings?q=${n.booking.reference}`}>
                      {n.booking.reference}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {label(n.template)}
                  <br />
                  <small>
                    {n.channel === "SMS" ? "Text message" : "Email"}
                  </small>
                </td>
                <td>{n.recipient}</td>
                <td>
                  <span
                    className={`notify-status notify-status--${n.status.toLowerCase()}`}
                  >
                    {label(n.status)}
                  </span>
                  {n.lastError && (
                    <>
                      <br />
                      <small>{n.lastError}</small>
                    </>
                  )}
                </td>
                <td>
                  {canResend && n.status !== "QUEUED" && (
                    <ResendNotification id={n.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!messages.length && <p>No messages yet.</p>}
      </section>
    </>
  );
}
