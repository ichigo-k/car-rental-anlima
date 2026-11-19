import { money } from "../catalogue";

export type BookingForMessage = {
  reference: string;
  customerName: string | null;
  pickup: Date;
  returnAt: Date;
  location: string;
  total: number;
  vehicle: { name: string };
};
export const TEMPLATES = [
  "BOOKING_CONFIRMED",
  "PAYMENT_REVIEW",
  "CANCELLATION_REQUESTED",
  "BOOKING_CANCELLED",
  "BOOKING_CHANGED",
  "PICKUP_REMINDER",
  "RETURN_REMINDER",
  "RETURN_OVERDUE",
  "REVIEW_REQUEST",
] as const;
export type Template = (typeof TEMPLATES)[number];
export type Audience = "customer" | "operations";
export type Message = { subject: string; text: string; sms: string };

const when = (date: Date) =>
  date.toLocaleString("en-GB", {
    timeZone: "Africa/Accra",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const site = () => process.env.BETTER_AUTH_URL ?? "";

// Plain text is the source of truth; the HTML email is built from it.
export function message(
  template: Template,
  audience: Audience,
  b: BookingForMessage,
): Message | null {
  const name = b.customerName?.split(" ")[0] || "there";
  const trip = `${b.vehicle.name}, ${when(b.pickup)} to ${when(b.returnAt)}, pickup at ${b.location}`;
  const manage = `Manage your booking: ${site()}/bookings`;
  if (audience === "operations") {
    const ops: Partial<Record<Template, [string, string]>> = {
      BOOKING_CONFIRMED: ["New confirmed booking", "Payment verified."],
      PAYMENT_REVIEW: [
        "Payment needs review",
        "A payment was verified but the booking could not be confirmed automatically. Resolve it before promising a pickup.",
      ],
      CANCELLATION_REQUESTED: [
        "Cancellation requested",
        "The customer asked to cancel this paid booking. Apply the cancellation policy, then cancel it.",
      ],
      BOOKING_CANCELLED: ["Booking cancelled", "This booking was cancelled."],
      BOOKING_CHANGED: [
        "Booking changed",
        "Staff changed this booking's car or dates. The new details are below.",
      ],
      RETURN_OVERDUE: [
        "Return overdue",
        "This car has not been returned and is past its return time.",
      ],
    };
    const entry = ops[template];
    if (!entry) return null;
    const text = `${entry[1]}\n\n${b.reference}: ${trip}.\nCustomer: ${b.customerName ?? "Unknown"}.\n\n${site()}/admin/bookings?q=${b.reference}`;
    return { subject: `${entry[0]} · ${b.reference}`, text, sms: text };
  }
  switch (template) {
    case "BOOKING_CONFIRMED":
      return {
        subject: `Your ANLIMA booking ${b.reference} is confirmed`,
        text: `Hello ${name},\n\nYour payment has been verified and your car is reserved.\n\n${trip}.\nTotal paid: ${money(b.total)}, including the refundable deposit.\n\nPlease bring your driving licence and Ghana Card to pickup.\n\n${manage}`,
        sms: `ANLIMA: Booking ${b.reference} confirmed. ${b.vehicle.name}, pickup ${when(b.pickup)} at ${b.location}. Bring your licence and Ghana Card.`,
      };
    case "PAYMENT_REVIEW":
      return {
        subject: `We received your payment for ${b.reference}`,
        text: `Hello ${name},\n\nWe received your payment for booking ${b.reference}. Our team needs to check one detail before confirming your car, and will contact you shortly. You do not need to pay again.\n\n${manage}`,
        sms: `ANLIMA: Payment received for ${b.reference}. Our team will confirm your car shortly. Do not pay again.`,
      };
    case "BOOKING_CANCELLED":
      return {
        subject: `Booking ${b.reference} has been cancelled`,
        text: `Hello ${name},\n\nYour booking ${b.reference} (${b.vehicle.name}) has been cancelled. If you paid, our team will contact you about any refund under ANLIMA's cancellation policy.\n\n${manage}`,
        sms: `ANLIMA: Booking ${b.reference} has been cancelled. If you paid, we will contact you about any refund.`,
      };
    case "BOOKING_CHANGED":
      return {
        subject: `Your ANLIMA booking ${b.reference} has been updated`,
        text: `Hello ${name},

Your booking ${b.reference} has been updated. The new details are:

${trip}.

If you did not ask for this change, please contact the ANLIMA team.

${manage}`,
        sms: `ANLIMA: Booking ${b.reference} updated. ${b.vehicle.name}, pickup ${when(b.pickup)}, return ${when(b.returnAt)}.`,
      };
    case "PICKUP_REMINDER":
      return {
        subject: `Your ANLIMA car is ready tomorrow · ${b.reference}`,
        text: `Hello ${name},\n\nA reminder of your upcoming pickup.\n\n${trip}.\n\nPlease bring your driving licence and Ghana Card.\n\n${manage}`,
        sms: `ANLIMA reminder: pickup of ${b.vehicle.name} on ${when(b.pickup)} at ${b.location}. Bring your licence and Ghana Card.`,
      };
    case "RETURN_REMINDER":
      return {
        subject: `Return reminder · ${b.reference}`,
        text: `Hello ${name},\n\nPlease return the ${b.vehicle.name} by ${when(b.returnAt)}. Late returns may be charged under the rental terms.\n\n${manage}`,
        sms: `ANLIMA reminder: please return the ${b.vehicle.name} by ${when(b.returnAt)}. Late returns may be charged.`,
      };
    case "RETURN_OVERDUE":
      return {
        subject: `Your rental is overdue · ${b.reference}`,
        text: `Hello ${name},\n\nThe ${b.vehicle.name} was due back on ${when(b.returnAt)}. Please return it as soon as possible or contact the ANLIMA team.\n\n${manage}`,
        sms: `ANLIMA: the ${b.vehicle.name} was due back ${when(b.returnAt)}. Please return it or contact us.`,
      };
    case "REVIEW_REQUEST":
      return {
        subject: `How was your ANLIMA rental? · ${b.reference}`,
        text: `Hello ${name},

Thank you for renting the ${b.vehicle.name} with ANLIMA. We would love to hear how it went. You can rate your rental from your bookings page:
${site()}/bookings

It takes less than a minute and helps other travellers choose with confidence.`,
        sms: `ANLIMA: thank you for renting with us. Rate your rental at ${site()}/bookings`,
      };
    default:
      return null;
  }
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function emailHtml(text: string) {
  const body = text
    .split("\n\n")
    .map((p) => `<p>${escape(p).replaceAll("\n", "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#012d5a;max-width:560px">${body}<p style="color:#647181;font-size:12px">ANLIMA Car Rental · Drive with Confidence</p></div>`;
}

export { smsNumber } from "../phone";
