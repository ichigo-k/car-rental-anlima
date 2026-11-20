import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { DocumentUpload } from "@/components/document-upload";
import { session } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStaffRole } from "@/lib/auth-redirect";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/documents";
import { privatePage } from "@/lib/seo";
export const metadata: Metadata = privatePage("My documents");
export const dynamic = "force-dynamic";
export default async function Documents() {
  const current = await session();
  if (!current) redirect("/sign-in?next=/account/documents");
  if (isStaffRole(current.user.role)) redirect("/admin");
  const docs = await db.customerDocument.findMany({
    where: { userId: current.user.id },
  });
  return (
    <CustomerShell
      name={current.user.name}
      email={current.user.email}
      active="documents"
    >
      <div className="customer-page">
        <div className="page-heading">
          <p className="account-breadcrumb">Account / My documents</p>
          <h1>Your documents.</h1>
          <p>
            Upload clear photos or PDFs of both sides of your driving licence
            and Ghana Card. Our team checks them before pickup, which makes
            handover quicker. You still need to bring the originals.
          </p>
        </div>
        <div className="document-grid">
          {(Object.keys(DOCUMENT_KINDS) as DocumentKind[]).map((kind) => {
            const doc = docs.find((d) => d.kind === kind);
            return (
              <DocumentUpload
                key={kind}
                kind={kind}
                label={DOCUMENT_KINDS[kind]}
                doc={
                  doc
                    ? {
                        id: doc.id,
                        status: doc.status,
                        reason: doc.rejectionReason,
                      }
                    : null
                }
              />
            );
          })}
        </div>
        <p className="muted document-privacy">
          Your documents are encrypted and only you and authorised ANLIMA staff
          can open them; every staff view is recorded. You can delete them at
          any time. Documents we cannot accept are deleted after 30 days.
        </p>
      </div>
    </CustomerShell>
  );
}
