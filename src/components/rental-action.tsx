"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkImage } from "@/lib/shrink-image";

type Photo = {
  key: string;
  preview: string;
  id?: string;
  status: "uploading" | "done" | "failed";
  error?: string;
};
export function RentalAction({ id, kind }: { id: string; kind: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const patch = (key: string, change: Partial<Photo>) =>
    setPhotos((list) =>
      list.map((p) => (p.key === key ? { ...p, ...change } : p)),
    );
  async function add(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const key = `${Date.now()}-${Math.random()}`;
      setPhotos((list) => [
        ...list,
        { key, preview: URL.createObjectURL(file), status: "uploading" },
      ]);
      const body = new FormData();
      body.append("file", await shrinkImage(file), "photo.jpg");
      body.append("kind", kind);
      body.append("takenAt", new Date(file.lastModified).toISOString());
      try {
        const r = await fetch(`/api/admin/rentals/${id}/photos`, {
          method: "POST",
          body,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Upload failed.");
        patch(key, { id: d.id, status: "done" });
      } catch (e) {
        patch(key, { status: "failed", error: (e as Error).message });
      }
    }
    if (picker.current) picker.current.value = "";
  }
  async function remove(photo: Photo) {
    setPhotos((list) => list.filter((p) => p.key !== photo.key));
    URL.revokeObjectURL(photo.preview);
    if (photo.id)
      await fetch(`/api/admin/photos/${photo.id}`, { method: "DELETE" }).catch(
        () => {},
      );
  }
  const uploaded = photos.filter((p) => p.status === "done");
  const uploading = photos.some((p) => p.status === "uploading");
  return (
    <div style={{ minWidth: 200, whiteSpace: "normal", marginTop: 10 }}>
      {!open ? (
        <button className="button small" onClick={() => setOpen(true)}>
          {kind === "CHECKOUT" ? "Record handover" : "Record return"}
        </button>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!uploaded.length) {
              setError("Add at least one photo of the car.");
              return;
            }
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch(`/api/admin/rentals/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kind,
                  mileage: Number(f.get("mileage")),
                  fuel: f.get("fuel"),
                  condition: f.get("condition"),
                  acknowledgement: f.get("acknowledgement"),
                  photoIds: uploaded.map((p) => p.id),
                }),
              });
              const d = await r.json();
              if (!r.ok) {
                throw new Error(d.error || "Could not save the inspection.");
              }
              setOpen(false);
              setPhotos([]);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Mileage (km)
            <input name="mileage" type="number" min="0" required />
          </label>
          <label>
            Fuel level
            <select name="fuel">
              <option>Full</option>
              <option>Three quarters</option>
              <option>Half</option>
              <option>Quarter</option>
              <option>Empty</option>
            </select>
          </label>
          <label>
            Condition notes
            <textarea name="condition" required minLength={5} />
          </label>
          <fieldset className="inspection-photos">
            <legend>Photos</legend>
            <p className="muted">
              Photograph the front, back, both sides, the dashboard (mileage and
              fuel) and any existing damage.
            </p>
            {photos.length > 0 && (
              <ul>
                {photos.map((p) => (
                  <li key={p.key} className={`photo-${p.status}`}>
                    <img src={p.preview} alt="" />
                    <span>
                      {p.status === "uploading"
                        ? "Uploading…"
                        : p.status === "failed"
                          ? p.error
                          : "Saved"}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => remove(p)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={picker}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => add(e.target.files)}
            />
          </fieldset>
          <label>
            Customer acknowledgement
            <input
              name="acknowledgement"
              placeholder="Acknowledgement reference / signed name"
              required
              minLength={3}
            />
          </label>
          <button className="button small" disabled={busy || uploading}>
            {uploading ? "Waiting for photos…" : "Save inspection"}
          </button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>
            Close
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}
