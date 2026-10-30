"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  providerName,
  type PaymentOption,
  type PaymentProvider,
} from "@/lib/payment-options";
export function CheckPaymentButton({
  reference,
  enabled,
}: {
  reference: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="payment-status-check">
      <button
        type="button"
        className="payment-check-link"
        disabled={busy || !enabled}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference }),
            });
            const result = await response.json();
            if (!response.ok)
              throw new Error(
                result.error || "Payment status could not be checked.",
              );
            if (result.status === "PENDING_PAYMENT")
              setMessage(
                "Payment is not verified yet. If you have paid, wait a moment and check again.",
              );
            else if (
              ["CONFIRMED", "ACTIVE", "COMPLETED", "PAYMENT_REVIEW"].includes(
                result.status,
              )
            )
              router.replace(
                `/bookings?payment=${result.status === "PAYMENT_REVIEW" ? "review" : "verified"}&reference=${encodeURIComponent(reference)}`,
              );
            else router.refresh();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Payment status could not be checked.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking payment..." : "Already paid? Check payment status"}
      </button>
      {message && (
        <p role="status" className="payment-help">
          {message}
        </p>
      )}
    </div>
  );
}
export function PaymentButton({
  reference,
  providers,
}: {
  reference: string;
  providers: PaymentOption[];
}) {
  const [provider, setProvider] = useState<PaymentProvider>(
    providers.find((p) => p.enabled)?.id ?? "PAYSTACK",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enabled = providers.some((p) => p.id === provider && p.enabled);
  return (
    <div className="payment-choice">
      <fieldset disabled={busy} className="payment-providers">
        <legend>Choose how to pay</legend>
        {providers.map((p) => (
          <label
            key={p.id}
            className={`${provider === p.id ? "selected" : ""} ${!p.enabled ? "unavailable" : ""}`}
          >
            <input
              type="radio"
              name={`payment-provider-${reference}`}
              value={p.id}
              checked={provider === p.id}
              disabled={!p.enabled}
              onChange={() => {
                setProvider(p.id);
                setError("");
              }}
            />
            <span>
              <strong>{p.name}</strong>
              <span>
                {p.enabled ? "Card or Mobile Money" : "Not available yet"}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {!providers.some((p) => p.enabled) && (
        <p className="payment-help">
          Online payments are being set up. Your reservation is confirmed only
          after payment is verified.
        </p>
      )}
      <button
        type="button"
        className="button"
        disabled={busy || !enabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/payments/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference, provider }),
            });
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Checkout is unavailable.");
            window.location.assign(data.url);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Checkout is unavailable.",
            );
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Opening secure checkout..."
          : `Pay with ${providerName(provider)}`}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <CheckPaymentButton
        reference={reference}
        enabled={providers.some((p) => p.enabled) && !busy}
      />
    </div>
  );
}
