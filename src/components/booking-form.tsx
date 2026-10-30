"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Stepper, { Step } from "./stepper/Stepper";
import { money } from "@/lib/catalogue";
import { quote } from "@/lib/pricing";
import {
  ghanaCardInput,
  licenceValidThrough,
  reservationInput,
  RESERVATION_HOLD_MINUTES,
} from "@/lib/reservation";

type BookingCar = {
  id: string;
  slug: string;
  dailyRate: number;
  deposit: number;
  pickupPoints: string[];
  status: string;
};
type Customer = { name: string; email: string };
export function BookingForm({
  car,
  initial,
  user,
}: {
  car: BookingCar;
  initial: Record<string, string | undefined>;
  user: Customer | null;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [quoteRevision, setQuoteRevision] = useState(0);
  const [quoteError, setQuoteError] = useState("");
  const [offer, setOffer] = useState<
    | ({
        key: string;
        discountAmount: number;
        promotionName: string | null;
      } & ReturnType<typeof quote>)
    | null
  >(null);
  const [values, setValues] = useState({
    pickup: initial.pickup ?? "",
    returnAt: initial.returnAt ?? "",
    location: car.pickupPoints.includes(initial.location ?? "")
      ? initial.location!
      : (car.pickupPoints[0] ?? ""),
    customerName: user?.name ?? "",
    customerEmail: user?.email ?? "",
    phone: "",
    ghanaCardNumber: "",
    licenceNumber: "",
    licenceExpiry: "",
    terms: false,
  });
  function field(key: keyof typeof values, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
    setError("");
  }
  let pricing: ReturnType<typeof quote> | undefined;
  try {
    pricing = quote(
      new Date(values.pickup),
      new Date(values.returnAt),
      car.dailyRate,
      car.deposit,
    );
  } catch {}
  const quoteKey = `${car.id}|${values.pickup}|${values.returnAt}|${appliedCode}|${quoteRevision}`;
  const activeOffer = offer?.key === quoteKey ? offer : null;
  const livePricing = activeOffer ?? pricing;
  useEffect(() => {
    setOffer(null);
    setQuoteError("");
    if (!user || !values.pickup || !values.returnAt) return;
    let pickup: string, returnAt: string;
    try {
      quote(
        new Date(values.pickup),
        new Date(values.returnAt),
        car.dailyRate,
        car.deposit,
      );
      pickup = new Date(values.pickup).toISOString();
      returnAt = new Date(values.returnAt).toISOString();
    } catch {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: car.id,
          pickup,
          returnAt,
          couponCode: appliedCode,
        }),
        signal: controller.signal,
      })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Could not check offers.");
          if (!controller.signal.aborted) setOffer({ ...d, key: quoteKey });
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setQuoteError(e.message || "Could not check offers.");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [quoteKey, !!user, car.dailyRate, car.deposit]);
  function applyCoupon() {
    const code = couponDraft.trim().toUpperCase();
    if (code && !/^[A-Z0-9-]{3,40}$/.test(code)) {
      setQuoteError("Use a coupon code with 3–40 letters, numbers or hyphens.");
      return;
    }
    setAppliedCode(code);
    setQuoteRevision((n) => n + 1);
  }
  if (!user)
    return (
      <form
        className="booking-signin stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pricing || new Date(values.pickup) <= new Date()) {
            setError(
              "Choose a future pickup time and a later return, up to 90 days apart.",
            );
            return;
          }
          const target = `/fleet/${car.slug}?${new URLSearchParams({ pickup: values.pickup, returnAt: values.returnAt, location: values.location })}`;
          window.location.assign(`/sign-in?next=${encodeURIComponent(target)}`);
        }}
      >
        <div>
          <span className="booking-step-caption">
            LET’S START WITH YOUR TRIP
          </span>
          <h2>Make this drive yours.</h2>
          <p>Choose your dates first. Sign in next to save your reservation.</p>
        </div>
        <label>
          Start date & time
          <input
            type="datetime-local"
            value={values.pickup}
            onChange={(e) => field("pickup", e.target.value)}
            required
          />
        </label>
        <label>
          End date & time
          <input
            type="datetime-local"
            value={values.returnAt}
            onChange={(e) => field("returnAt", e.target.value)}
            required
          />
        </label>
        <label>
          Pick-up point
          <select
            value={values.location}
            onChange={(e) => field("location", e.target.value)}
            required
          >
            {!car.pickupPoints.length && (
              <option value="">No pickup points available</option>
            )}
            {car.pickupPoints.map((point) => (
              <option key={point}>{point}</option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          Ghana time (GMT). These pickup points are available for this car.
        </p>
        {pricing && (
          <div className="guest-price">
            <span>{pricing.days} days + refundable deposit</span>
            <strong>{money(pricing.total)}</strong>
          </div>
        )}
        <button
          className="button"
          disabled={car.status !== "AVAILABLE" || !car.pickupPoints.length}
        >
          Continue to sign in <span aria-hidden="true">→</span>
        </button>
        <p className="field-hint">
          Your dates will be saved for the next step. No payment yet.
        </p>
        {car.status !== "AVAILABLE" && (
          <p className="error">This car is not currently available.</p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  function validate() {
    setError("");
    const pane = form.current?.querySelector(
      ".stepper__pane:not(.stepper__pane--leaving)",
    );
    const inputs = pane?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select",
    );
    if (inputs)
      for (const input of inputs) if (!input.reportValidity()) return false;
    if (step === 1 && (!pricing || new Date(values.pickup) <= new Date())) {
      setError(
        "Choose a future pickup time and a later return, up to 90 days apart.",
      );
      return false;
    }
    if (
      step === 2 &&
      !ghanaCardInput.safeParse(values.ghanaCardNumber).success
    ) {
      setError("Enter your Ghana Card number as GHA-123456789-0.");
      return false;
    }
    if (
      step === 3 &&
      !licenceValidThrough(values.licenceExpiry, new Date(values.returnAt))
    ) {
      setError("Your licence must remain valid throughout the rental.");
      return false;
    }
    if (step === 4 && !values.terms) {
      setError("Please accept the rental terms and privacy notice.");
      return false;
    }
    if (step === 4 && !activeOffer) {
      setError("Check your quote and any coupon before reserving.");
      return false;
    }
    return true;
  }
  async function reserve() {
    if (busy || !validate()) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        ...values,
        couponCode: appliedCode,
        expectedTotal: activeOffer?.total,
        vehicleId: car.id,
        pickup: new Date(values.pickup).toISOString(),
        returnAt: new Date(values.returnAt).toISOString(),
      };
      const parsed = reservationInput.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await res.json();
      if (res.status === 401)
        throw new Error(
          "Your session expired. Sign in again before reserving. Your details have not been submitted.",
        );
      if (!res.ok)
        throw new Error(
          result.error || "Could not reserve this car. Please try again.",
        );
      router.push(
        `/bookings?reference=${encodeURIComponent(result.reference)}`,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setQuoteRevision((n) => n + 1);
    }
  }
  return (
    <form
      ref={form}
      className="reservation-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (validate()) {
          if (step < 4) setStep(step + 1);
          else void reserve();
        }
      }}
    >
      <div className="reservation-intro">
        <p className="booking-step-caption">
          STEP {step} OF 4 · YOUR RESERVATION
        </p>
        <h2>Reserve your car.</h2>
        <p>
          Choose your trip, add your details, then review. No payment is taken
          at this step.
        </p>
      </div>
      {pricing && (
        <div className="booking-cost-preview">
          <span>
            {pricing.days} rental day{pricing.days === 1 ? "" : "s"}
            <small>Includes {money(pricing.deposit)} refundable deposit</small>
          </span>
          <strong>
            {activeOffer ? money(activeOffer.total) : "Checking offers…"}
          </strong>
        </div>
      )}
      <Stepper
        step={step}
        onStepChange={(next) => {
          if (next < step || validate()) setStep(next);
        }}
        onFinalStepCompleted={() => void reserve()}
        linear
        disableStepIndicators={busy}
        theme="light"
        accentColor="#012d5a"
        width="100%"
        radius={20}
        transition="fade"
        className="reservation-stepper"
        completeButtonText={busy ? "Reserving…" : "Reserve this car"}
        nextButtonProps={{
          disabled:
            busy ||
            car.status !== "AVAILABLE" ||
            !car.pickupPoints.length ||
            (step === 4 && !activeOffer),
          onClick: (e) => {
            if (!validate()) e.preventDefault();
          },
        }}
        backButtonProps={{ disabled: busy }}
      >
        <Step title="Your trip">
          <div className="stack">
            <h3>Where are you headed?</h3>
            <p className="muted">Times are shown in Ghana time (GMT).</p>
            <label>
              Start date & time
              <input
                type="datetime-local"
                value={values.pickup}
                onChange={(e) => field("pickup", e.target.value)}
                required
              />
            </label>
            <label>
              End date & time
              <input
                type="datetime-local"
                value={values.returnAt}
                onChange={(e) => field("returnAt", e.target.value)}
                required
              />
            </label>
            <label>
              Pick-up point
              <select
                value={values.location}
                onChange={(e) => field("location", e.target.value)}
                required
              >
                {!car.pickupPoints.length && (
                  <option value="">No pickup points configured</option>
                )}
                {car.pickupPoints.map((point) => (
                  <option key={point}>{point}</option>
                ))}
              </select>
            </label>
            <p className="field-hint">
              These are the pickup points available for this specific car.
            </p>
          </div>
        </Step>
        <Step title="About you">
          <div className="stack">
            <h3>Who is travelling?</h3>
            <label>
              Full name
              <input
                autoComplete="name"
                value={values.customerName}
                onChange={(e) => field("customerName", e.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={values.customerEmail}
                readOnly
                required
              />
            </label>
            <p className="field-hint">
              This reservation will belong to your signed-in account.
            </p>
            <label>
              Phone number
              <input
                type="tel"
                autoComplete="tel"
                value={values.phone}
                onChange={(e) => field("phone", e.target.value)}
                required
                minLength={7}
                maxLength={25}
                placeholder="e.g. +233 24 000 0000"
              />
            </label>
            <label>
              Ghana Card number
              <input
                value={values.ghanaCardNumber}
                onChange={(e) =>
                  field("ghanaCardNumber", e.target.value.toUpperCase())
                }
                required
                pattern="GHA-[0-9]{9}-[0-9]"
                maxLength={15}
                placeholder="GHA-123456789-0"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="field-hint">
              Stored securely for identity checks. Bring the original card at
              pickup.
            </p>
          </div>
        </Step>
        <Step title="Driver">
          <div className="stack">
            <h3>A few details before you drive.</h3>
            <p className="muted">
              Your Ghana Card identifies you. A valid driving licence is also
              required to drive the vehicle.
            </p>
            <label>
              Driving licence number
              <input
                value={values.licenceNumber}
                onChange={(e) => field("licenceNumber", e.target.value)}
                required
                minLength={4}
                maxLength={80}
                autoComplete="off"
              />
            </label>
            <label>
              Licence expiry date
              <input
                type="date"
                value={values.licenceExpiry}
                onChange={(e) => field("licenceExpiry", e.target.value)}
                required
                min={values.returnAt.slice(0, 10)}
              />
            </label>
            <p className="field-hint">
              Your licence must be valid until the end of your rental. Staff
              check original documents at handover.
            </p>
          </div>
        </Step>
        <Step title="Review">
          <div className="stack">
            <h3>Everything look right?</h3>
            <div className="coupon-entry">
              <label>
                Coupon or voucher code
                <input
                  value={couponDraft}
                  onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCoupon();
                    }
                  }}
                  placeholder="Enter a code"
                  maxLength={40}
                  autoComplete="off"
                />
              </label>
              <div className="coupon-actions">
                <button
                  type="button"
                  className="button secondary small"
                  disabled={busy}
                  onClick={applyCoupon}
                >
                  Apply code
                </button>
                {appliedCode && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      setCouponDraft("");
                      setAppliedCode("");
                    }}
                  >
                    Remove code
                  </button>
                )}
              </div>
              <p className="field-hint">
                One offer per reservation. Eligible automatic discounts are
                checked for you.
              </p>
              {activeOffer && activeOffer.discountAmount > 0 && (
                <p className="coupon-success">
                  {activeOffer.promotionName} applied · Save{" "}
                  {money(activeOffer.discountAmount)}
                </p>
              )}
              {quoteError && (
                <p className="error" role="alert">
                  {quoteError}
                </p>
              )}
            </div>
            <dl className="reservation-review">
              <div>
                <dt>Travelling as</dt>
                <dd>{values.customerName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{values.customerEmail}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{values.phone}</dd>
              </div>
              <div>
                <dt>Ghana Card</dt>
                <dd>
                  GHA-••••••
                  {values.ghanaCardNumber.replaceAll("-", "").slice(-4)}
                </dd>
              </div>
              <div>
                <dt>Start</dt>
                <dd>{values.pickup.replace("T", " at ")}</dd>
              </div>
              <div>
                <dt>Return</dt>
                <dd>{values.returnAt.replace("T", " at ")}</dd>
              </div>
              <div>
                <dt>Pick-up point</dt>
                <dd>{values.location}</dd>
              </div>
            </dl>
            <label className="check">
              <input
                type="checkbox"
                checked={values.terms}
                onChange={(e) => field("terms", e.target.checked)}
              />
              <span>
                I accept the{" "}
                <Link href="/policies" target="_blank">
                  rental terms and privacy notice
                </Link>
                .
              </span>
            </label>
            <p className="reservation-hold-note">
              Reserve now, pay within {RESERVATION_HOLD_MINUTES} minutes. Your
              car is confirmed only after payment is verified. Unpaid holds
              expire automatically.
            </p>
          </div>
        </Step>
      </Stepper>
      {livePricing && (
        <div className="quote reservation-quote">
          <div>
            <span>
              {livePricing.days} day{livePricing.days === 1 ? "" : "s"} ×{" "}
              {money(livePricing.dailyRate)}
            </span>
            <strong>{money(livePricing.rentalAmount)}</strong>
          </div>
          {activeOffer && activeOffer.discountAmount > 0 && (
            <div className="coupon-success">
              <span>{activeOffer.promotionName}</span>
              <strong>−{money(activeOffer.discountAmount)}</strong>
            </div>
          )}
          <div>
            <span>Refundable deposit</span>
            <strong>{money(livePricing.deposit)}</strong>
          </div>
          <div className="quote-total">
            <span>Total to pay after reserving</span>
            <strong>
              {activeOffer ? money(activeOffer.total) : "Checking offers…"}
            </strong>
          </div>
        </div>
      )}
      {quoteError && step !== 4 && (
        <p className="error" role="alert">
          {quoteError}{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => setQuoteRevision((n) => n + 1)}
          >
            Retry quote
          </button>
        </p>
      )}
      {car.status !== "AVAILABLE" && (
        <p className="error">This car is not currently available to reserve.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
