import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  DOCUMENT_KINDS,
  documentSummary,
  type DocumentKind,
} from "@/lib/documents";
import { DocumentReview } from "@/components/document-review";
export const dynamic = "force-dynamic";
const SUMMARY_LABEL = {
  APPROVED: "Approved",
  PENDING: "To review",
  REJECTED: "Not accepted",
  INCOMPLETE: "One side missing",
  MISSING: "Not uploaded",
};
const DOC_STATUS: Record<string, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Not accepted",
};
export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const current = await requireStaff();
  if (!can(current.user.role, "customer.read"))
    return <p>Customer access required.</p>;
  const q = await searchParams;
  const search = q.q?.trim().slice(0, 100);
  const toReview = q.docs === "pending";
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(toReview ? { documents: { some: { status: "PENDING" } } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search } },
          ],
        }
      : {}),
  };
  const [customers, pending] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
        documents: true,
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    db.customerDocument.count({ where: { status: "PENDING" } }),
  ]);
  const canReview = can(current.user.role, "booking.write");
  return (
    <>
      <div className="admin-top">
        <div>
          <h1>Customers</h1>
          <p>
            Customer accounts and their uploaded licence and Ghana Card. Opening
            a document is recorded in the activity history.
          </p>
        </div>
      </div>
      <form className="admin-panel report-filters" method="get">
        <label>
          Find a customer
          <input
            name="q"
            defaultValue={search ?? ""}
            placeholder="Name, email or phone"
          />
        </label>
        <label>
          Documents
          <select name="docs" defaultValue={toReview ? "pending" : ""}>
            <option value="">All customers</option>
            <option value="pending">Documents to review ({pending})</option>
          </select>
        </label>
        <div className="report-actions">
          <button className="button small">Search</button>
          <Link href="/admin/customers">Reset</Link>
        </div>
      </form>
      <section className="customer-list">
        {customers.map((c) => {
          const summary = documentSummary(c.documents);
          return (
            <details className="admin-panel customer-card" key={c.id}>
              <summary>
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.email}
                    {c.phoneNumber ? ` · ${c.phoneNumber}` : ""} ·{" "}
                    {c._count.bookings} reservation
                    {c._count.bookings === 1 ? "" : "s"} · joined{" "}
                    {c.createdAt.toLocaleDateString("en-GB", {
                      timeZone: "Africa/Accra",
                    })}
                  </small>
                </span>
                <span className="doc-badges">
                  <span
                    className={`doc-badge doc-${summary.licence.toLowerCase()}`}
                  >
                    Licence: {SUMMARY_LABEL[summary.licence]}
                  </span>
                  <span className={`doc-badge doc-${summary.id.toLowerCase()}`}>
                    Ghana Card: {SUMMARY_LABEL[summary.id]}
                  </span>
                </span>
              </summary>
              {c.documents.length ? (
                <ul className="customer-docs">
                  {(Object.keys(DOCUMENT_KINDS) as DocumentKind[]).map(
                    (kind) => {
                      const doc = c.documents.find((d) => d.kind === kind);
                      if (!doc) return null;
                      return (
                        <li key={doc.id}>
                          <span>
                            <strong>{DOCUMENT_KINDS[kind]}</strong> ·{" "}
                            {DOC_STATUS[doc.status]} · uploaded{" "}
                            {doc.createdAt.toLocaleDateString("en-GB", {
                              timeZone: "Africa/Accra",
                            })}
                            {doc.rejectionReason && ` · ${doc.rejectionReason}`}
                          </span>
                          <a
                            href={`/api/admin/documents/${doc.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                          {canReview && doc.status === "PENDING" && (
                            <DocumentReview id={doc.id} />
                          )}
                        </li>
                      );
                    },
                  )}
                </ul>
              ) : (
                <p className="muted">No documents uploaded.</p>
              )}
            </details>
          );
        })}
        {!customers.length && (
          <p className="admin-panel empty">No matching customers.</p>
        )}
      </section>
    </>
  );
}
