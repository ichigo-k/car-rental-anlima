import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Customers() {
  const current = await requireStaff();
  if (!["ADMIN", "MANAGER", "AGENT"].includes(current.user.role))
    return <p>Customer access required.</p>;
  const customers = await db.user.findMany({
    where: { role: "CUSTOMER" },
    include: { _count: { select: { bookings: true } } },
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <h1>Customers</h1>
      <p className="muted">
        Latest 100 customer accounts. Driver records are held with their
        reservations.
      </p>
      <section className="admin-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Reservations</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>{c._count.bookings}</td>
                <td>
                  {c.createdAt.toLocaleDateString("en-GB", {
                    timeZone: "Africa/Accra",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers.length && <p>No customer accounts yet.</p>}
      </section>
    </>
  );
}
