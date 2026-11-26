import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  can,
  ROLE_LABELS,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/permissions";
import { StaffGrant, StaffRowActions } from "@/components/staff-admin";
export const dynamic = "force-dynamic";
export default async function Staff() {
  const current = await requireStaff();
  if (!can(current.user.role, "user.manage"))
    return <p>Administrator access required.</p>;
  const staff = await db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    include: {
      sessions: {
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return (
    <>
      <div className="admin-top">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>Staff & access</h1>
          <p>
            Give staff the least access their work needs. Every change signs the
            person out and is recorded in the activity history.
          </p>
        </div>
      </div>
      <section className="admin-panel">
        <h2>Add a staff member</h2>
        <p className="muted">
          The person first creates an ANLIMA account with their email and a
          password. Then enter that email here. They must set up two-step
          sign-in the next time they sign in.
        </p>
        <StaffGrant />
      </section>
      <section className="admin-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Two-step sign-in</th>
              <th>Last active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  <br />
                  <small>{s.email}</small>
                </td>
                <td>{ROLE_LABELS[s.role as StaffRole]}</td>
                <td>{s.twoFactorEnabled ? "On" : "Not set up yet"}</td>
                <td>
                  {s.sessions[0]
                    ? s.sessions[0].updatedAt.toLocaleString("en-GB", {
                        timeZone: "Africa/Accra",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Signed out"}
                </td>
                <td>
                  {s.id === current.user.id ? (
                    <small>This is you</small>
                  ) : (
                    <StaffRowActions
                      userId={s.id}
                      role={s.role as StaffRole}
                      mfa={s.twoFactorEnabled}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="admin-panel">
        <h2>What each role can do</h2>
        <ul className="role-guide">
          <li>
            <strong>{ROLE_LABELS.ADMIN}</strong>: everything, including staff
            access and settings.
          </li>
          <li>
            <strong>{ROLE_LABELS.MANAGER}</strong>: bookings, charges, fleet,
            GPS, payments, promotions, reports and activity history.
          </li>
          <li>
            <strong>{ROLE_LABELS.AGENT}</strong>: bookings, handover and return,
            proposing charges, customers and enquiries.
          </li>
          <li>
            <strong>{ROLE_LABELS.FLEET}</strong>: cars, availability blocks and
            GPS tracking.
          </li>
          <li>
            <strong>{ROLE_LABELS.FINANCE}</strong>: payments, refunds, approving
            charges, closing rentals and reports.
          </li>
        </ul>
      </section>
    </>
  );
}
