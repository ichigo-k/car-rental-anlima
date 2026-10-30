import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";
import { VehicleCard } from "@/components/vehicle-card";
import { session } from "@/lib/auth";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Favourites() {
  const current = await session();
  if (!current) redirect("/sign-in?next=/favourites");
  const favourites = await db.favourite.findMany({
    where: { userId: current.user.id },
    include: { vehicle: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <CustomerShell
      name={current.user.name}
      email={current.user.email}
      active="favourites"
    >
      <div className="customer-page">
        <div className="page-heading">
          <p className="account-breadcrumb">Account / Favourite cars</p>
          <h1>Your favourite cars.</h1>
          <p>A shortlist for your next journey.</p>
          <Link className="text-link" href="/bookings">
            View my reservations
          </Link>
        </div>
        {favourites.length ? (
          <div className="fleet-grid">
            {favourites.map((f) => (
              <VehicleCard key={f.vehicleId} car={f.vehicle} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>A little inspiration for the road.</h2>
            <p>Tap the heart on a car to save it here.</p>
            <Link className="button" href="/fleet">
              Explore cars
            </Link>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
