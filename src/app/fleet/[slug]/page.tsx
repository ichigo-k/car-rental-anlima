import { notFound } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "@/components/header";
import { BookingForm } from "@/components/booking-form";
import { db } from "@/lib/db";
import { session } from "@/lib/auth";
import { FavouriteButton } from "@/components/favourites";
import { VehicleImage } from "@/components/vehicle-image";
import { money } from "@/lib/catalogue";
import { Users, SteeringWheel, GasPump, ArrowLeft } from "@/components/icons";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const car = await db.vehicle.findUnique({ where: { slug } });
  if (!car) notFound();
  const current = await session();
  return (
    <>
      <Header active="Cars" />
      <main className="section reservation-page">
        <Link href="/fleet" className="text-link">
          <ArrowLeft /> Back to the fleet
        </Link>
        <div className="reservation-flow">
          <span className="completed">01 Choose a car</span>
          <span aria-hidden="true">→</span>
          <strong>02 Your reservation</strong>
          <span aria-hidden="true">→</span>
          <span>03 Confirm & pay</span>
        </div>
        <div className="detail-grid">
          <div className="reservation-car-summary">
            <div className="reservation-car-photo">
              <VehicleImage slug={car.slug} image={car.image} name={car.name} />
              <FavouriteButton vehicleId={car.id} name={car.name} />
            </div>
            <p className="eyebrow">{car.category}</p>
            <h1>{car.name}</h1>
            <div className="car-summary-rate">
              <strong>{money(car.dailyRate)}</strong>
              <span> / day</span>
            </div>
            <p className="lead">{car.description}</p>
            <div className="specs">
              <span>
                <Users />
                {car.seats} seats
              </span>
              <span>
                <SteeringWheel />
                {car.transmission}
              </span>
              <span>
                <GasPump />
                {car.fuel}
              </span>
            </div>
            <h3>Good to know before you go</h3>
            <p>
              Bring a valid driving licence and identification at pickup. Return
              with the same fuel level. No smoking; authorised drivers only.
            </p>
            <Link href="/policies" className="text-link">
              Read the full rental guide
            </Link>
          </div>
          <aside className="booking-panel">
            <BookingForm
              car={{
                id: car.id,
                slug: car.slug,
                dailyRate: car.dailyRate,
                deposit: car.deposit,
                pickupPoints: car.pickupPoints,
                status: car.status,
              }}
              initial={q}
              user={
                current
                  ? { name: current.user.name, email: current.user.email }
                  : null
              }
            />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
