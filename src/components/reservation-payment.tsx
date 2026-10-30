"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { PaymentOption } from "@/lib/payment-options";
import { PaymentButton, CheckPaymentButton } from "./payment-button";

export function ReservationPayment({
  reference,
  expiresAt,
  slug,
  providers,
}: {
  reference: string;
  expiresAt: string;
  slug: string;
  providers: PaymentOption[];
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  if (remaining === 0)
    return (
      <div className="reservation-expired">
        <strong>Your payment window has ended.</strong>
        <p>The car is no longer held. Check availability and reserve again.</p>
        <Link href={`/fleet/${slug}`} className="button small">
          Check availability
        </Link>
        <CheckPaymentButton
          reference={reference}
          enabled={providers.some((p) => p.enabled)}
        />
      </div>
    );
  return (
    <div className="reservation-payment">
      <p>
        Complete payment before{" "}
        <time dateTime={expiresAt}>
          {new Date(expiresAt).toLocaleTimeString("en-GB", {
            timeZone: "Africa/Accra",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          GMT
        </time>
      </p>
      <strong className="payment-countdown" aria-label="Time left to pay">
        {remaining === null
          ? "Payment window open"
          : `${Math.floor(remaining / 60)
              .toString()
              .padStart(
                2,
                "0",
              )}:${(remaining % 60).toString().padStart(2, "0")}`}
      </strong>
      <PaymentButton reference={reference} providers={providers} />
      <small>
        The hold expires automatically. Confirmation follows verified payment.
      </small>
    </div>
  );
}
