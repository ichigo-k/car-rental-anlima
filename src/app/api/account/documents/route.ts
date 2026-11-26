import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import { trustedOrigin } from "@/lib/request";
import { DocumentError, isDocumentKind, storeDocument } from "@/lib/documents";
// A customer uploads their licence or Ghana Card (multipart: file, kind).
// Uploading the same kind again replaces the previous file.
export async function POST(req: Request) {
  const current = await session();
  if (!current || isStaffRole(current.user.role))
    return NextResponse.json(
      { error: "Sign in to upload documents." },
      { status: 401 },
    );
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || !isDocumentKind(kind))
    return NextResponse.json(
      { error: "Choose a file to upload." },
      { status: 400 },
    );
  try {
    const doc = await storeDocument(
      db,
      current.user.id,
      kind,
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ id: doc.id, status: doc.status });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof DocumentError
            ? e.message
            : "The document could not be saved. Please try again.",
      },
      { status: 400 },
    );
  }
}
