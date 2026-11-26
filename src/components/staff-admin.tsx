"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/permissions";
function useStaffAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not update staff access.");
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, send };
}
export function StaffGrant() {
  const { busy, error, send } = useStaffAction();
  return (
    <form
      className="admin-filters"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        if (
          await send({
            action: "GRANT",
            email: f.get("email"),
            role: f.get("role"),
          })
        )
          form.reset();
      }}
    >
      <label>
        Account email
        <input name="email" type="email" required />
      </label>
      <label>
        Role
        <select name="role" defaultValue="AGENT">
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <button className="button small" disabled={busy}>
        Give staff access
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export function StaffRowActions({
  userId,
  role,
  mfa,
}: {
  userId: string;
  role: StaffRole;
  mfa: boolean;
}) {
  const { busy, error, send } = useStaffAction();
  const confirmThen = (message: string, body: object) => {
    if (window.confirm(message)) void send(body);
  };
  return (
    <div className="staff-actions">
      <select
        aria-label="Change role"
        value={role}
        disabled={busy}
        onChange={(e) =>
          confirmThen(
            `Change this person's role to ${ROLE_LABELS[e.target.value as StaffRole]}? They will be signed out.`,
            { action: "SET_ROLE", userId, role: e.target.value },
          )
        }
      >
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="text-link"
        disabled={busy}
        onClick={() =>
          confirmThen("Sign this person out on every device?", {
            action: "SIGN_OUT",
            userId,
          })
        }
      >
        Sign out everywhere
      </button>
      {mfa && (
        <button
          type="button"
          className="text-link"
          disabled={busy}
          onClick={() =>
            confirmThen(
              "Reset two-step sign-in? Do this only after confirming the person's identity, for example when they lose their phone.",
              { action: "RESET_MFA", userId },
            )
          }
        >
          Reset two-step sign-in
        </button>
      )}
      <button
        type="button"
        className="text-link danger"
        disabled={busy}
        onClick={() =>
          confirmThen(
            "Remove staff access? The account becomes a customer account.",
            { action: "REVOKE", userId },
          )
        }
      >
        Remove access
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
