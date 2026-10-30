import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Audit() {
  const current = await requireStaff();
  if (!["ADMIN", "MANAGER"].includes(current.user.role))
    return <p>Audit access required.</p>;
  const events = await db.auditEvent.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <h1>Activity history</h1>
      <p className="muted">Latest 100 recorded operational events.</p>
      <section className="admin-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.createdAt.toLocaleString("en-GB", {
                    timeZone: "Africa/Accra",
                  })}
                </td>
                <td>{e.actorId}</td>
                <td>{e.action}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 350 }}>
                  {e.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
