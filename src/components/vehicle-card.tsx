import Link from "next/link";
import { Users, GearSix, GasPump, ArrowUpRight } from "./icons";
import { VehicleImage } from "./vehicle-image";
import { money } from "@/lib/catalogue";
import { FavouriteButton } from "./favourites";
export type PublicVehicle = {
  id: string;
  slug: string;
  name: string;
  category: string;
  seats: number;
  dailyRate: number;
  deposit?: number;
  image: string;
  description?: string;
  transmission?: string;
  fuel?: string;
  driverOption?: string;
  withDriverRate?: number | null;
};
export function VehicleCard({
  car,
  query = "",
  detailed = false,
}: {
  car: PublicVehicle;
  query?: string;
  detailed?: boolean;
}) {
  // Chauffeur-only cars are priced with their driver.
  const rate =
    car.driverOption === "CHAUFFEUR_ONLY" && car.withDriverRate
      ? car.withDriverRate
      : car.dailyRate;
  return (
    <article
      className={`vehicle-card design-vehicle ${detailed ? "detailed-vehicle" : ""}`}
    >
      <FavouriteButton vehicleId={car.id} name={car.name} />
      <Link href={`/fleet/${car.slug}${query}`} className="vehicle-card-link">
        <div className="design-vehicle-photo">
          <VehicleImage slug={car.slug} image={car.image} name={car.name} />
          <span className="vehicle-category">
            {detailed ? `${money(rate)} / day` : car.category}
          </span>
        </div>
        <div className="vehicle-info">
          {detailed ? (
            <div className="vehicle-title-row">
              <h3>{car.name}</h3>
              <span className="vehicle-pill">{car.category}</span>
            </div>
          ) : (
            <h3>{car.name}</h3>
          )}
          <p className="vehicle-type">
            {car.category}
            {car.driverOption === "BOTH" && " · driver available"}
            {car.driverOption === "CHAUFFEUR_ONLY" && " · with driver"}
          </p>
          {detailed && (
            <p className="vehicle-description">
              {car.description ||
                `A comfortable ${car.seats}-seat vehicle for your next journey.`}
            </p>
          )}
          {detailed && car.deposit !== undefined && (
            <p className="vehicle-deposit">
              Down Payment: {money(car.deposit)}
            </p>
          )}
          <div className="vehicle-specs">
            <span>
              <Users size={16} />
              {car.seats} Seats
            </span>
            <span>
              <GearSix size={16} />
              {car.transmission ?? "Automatic"}
            </span>
            <span>
              <GasPump size={16} />
              {car.fuel ?? "Petrol"}
            </span>
          </div>
          <div className="vehicle-bottom">
            {!detailed && (
              <span>
                <strong>{money(rate)}</strong>
                <small> / day</small>
              </span>
            )}
            <span className="card-book">
              {detailed ? "View Details" : "Book Now"}
              <ArrowUpRight size={15} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
