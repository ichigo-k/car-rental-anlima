import Image from "next/image";
import Link from "next/link";
import { Header } from "./header";

const assets = "/images/figma/";
export function MarketingHero({ page }: { page: "about" | "contact" | "how" }) {
  const how = page === "how";
  return (
    <section className={`anlima-page-hero ${page}-page-hero`}>
      <Image
        src={`${assets}${page}-EnhanceThisImage2K20261006134800Photoroom1.png`}
        alt={
          how
            ? "ANLIMA rental adviser helping a customer with a booking"
            : "ANLIMA representative beside a rental car"
        }
        fill
        preload
        sizes="110vw"
      />
      <Header
        overlay
        active={
          page === "about"
            ? "About Us"
            : page === "contact"
              ? "Contact"
              : "How It Works"
        }
      />
      <div className="anlima-hero-copy">
        <h1>
          {how ? (
            <>
              Your Journey Starts with{" "}
              <br />a Simple Booking
            </>
          ) : (
            <>
              Making Every
              <br />
              Journey Easier.
            </>
          )}
        </h1>
        <p>
          {how
            ? "From finding the right vehicle to confirming your reservation, discover how to book your rental car with ANLIMA in a few simple steps."
            : "At ANLIMA, we make it easier to find a vehicle that fits your journey. From everyday travel to special occasions, our car rental platform helps you explore available vehicles and arrange your booking with confidence."}
        </p>
        {!how && (
          <Link className="button" href="/fleet">
            Explore Our Cars
          </Link>
        )}
      </div>
    </section>
  );
}

export function MarketingCta({
  variant = "about",
}: {
  variant?: "about" | "contact" | "how";
}) {
  return (
    <section className={`anlima-marketing-cta ${variant}-cta`}>
      {variant !== "about" && (
        <Image
          src={`${assets}${variant === "contact" ? "contact-RedSedanAgainstAGoldenSkyline1.png" : "how-cta-background.png"}`}
          alt=""
          fill
          sizes="100vw"
        />
      )}
      <div className="anlima-cta-inner">
        <div>
          <p className="eyebrow">
            {variant === "contact"
              ? "WE’RE HERE TO HELP"
              : "YOUR NEXT JOURNEY STARTS HERE"}
          </p>
          <h2>
            {variant === "contact"
              ? "Let’s Get You on the Road"
              : "Ready to Find Your Perfect Ride?"}
          </h2>
          <p>
            {variant === "contact"
              ? "Have a question about your booking or need help choosing the right car? Our team is ready to assist you and make your car rental experience smooth and stress-free."
              : "Explore our available vehicles and choose the right car for your next trip. With a straightforward booking process, getting started is just a few steps away."}
          </p>
          <Link className="button" href="/fleet">
            Explore Cars
          </Link>
        </div>
        {variant === "about" && (
          <img
            src={`${assets}about-journey-illustration.svg`}
            width="663"
            height="398"
            alt="Traveller beside a car with a city and route in the background"
          />
        )}
      </div>
    </section>
  );
}
