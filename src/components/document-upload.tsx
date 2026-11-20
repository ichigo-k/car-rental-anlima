"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/shrink-image";

const STATUS: Record<string, string> = {
  PENDING: "Uploaded · awaiting review",
  APPROVED: "Approved",
  REJECTED: "Not accepted",
};
// One document side for the customer: status, view, replace and delete.
export function DocumentUpload({
  kind,
  label,
  doc,
}: {
  kind: string;
  label: string;
  doc: { id: string; status: string; reason: string | null } | null;
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      // Higher limit than car photos so small print stays readable.
      body.append("file", await shrinkImage(file, 2000, 0.85), file.name);
      body.append("kind", kind);
      const r = await fetch("/api/account/documents", { method: "POST", body });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }
  async function remove() {
    if (!doc || !window.confirm(`Delete your ${label.toLowerCase()}?`)) return;
    setBusy(true);
    await fetch(`/api/account/documents/${doc.id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }
  return (
    <div
      className={`document-card document-${(doc?.status ?? "missing").toLowerCase()}`}
    >
      <div>
        <strong>{label}</strong>
        <span>{doc ? STATUS[doc.status] : "Not uploaded"}</span>
        {doc?.status === "REJECTED" && doc.reason && (
          <small>{doc.reason}</small>
        )}
      </div>
      <div className="document-actions">
        {doc && (
          <a
            href={`/api/account/documents/${doc.id}`}
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        )}
        <label className="button small secondary">
          {busy ? "Uploading…" : doc ? "Replace" : "Upload"}
          <input
            ref={picker}
            type="file"
            accept="image/*,application/pdf"
            hidden
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        {doc && (
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={remove}
          >
            Delete
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
