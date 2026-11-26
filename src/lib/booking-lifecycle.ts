import { z } from "zod";
import { can, type Permission } from "./permissions";

// Booking statuses follow the Developer Guide §5. PAYMENT_REVIEW is ANLIMA's
// holding state for a verified charge that staff must resolve.
export const OPERATIONAL_STATUSES = [
  "CONFIRMED",
  "CHECKED_OUT",
  "RETURNED",
  "CLOSED",
] as const;
// Statuses that hold the vehicle for the booked interval.
export const RESERVING_STATUSES = ["CONFIRMED", "CHECKED_OUT"];

const transitions: Record<string, string[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "PAYMENT_REVIEW", "CANCELLED"],
  PAYMENT_REVIEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_OUT", "CANCELLED", "NO_SHOW"],
  CHECKED_OUT: ["RETURNED"],
  RETURNED: ["CLOSED"],
  NO_SHOW: ["CLOSED"],
};
export function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}

// Permission required for each lifecycle action.
const LIFECYCLE_PERMISSIONS = {
  handover: "booking.write",
  cancel: "booking.write",
  change: "booking.write",
  noShow: "booking.write",
  proposeCharge: "charge.propose",
  decideCharge: "charge.decide",
  close: "booking.close",
} as const satisfies Record<string, Permission>;
export function allowed(
  action: keyof typeof LIFECYCLE_PERMISSIONS,
  role: string,
) {
  return can(role, LIFECYCLE_PERMISSIONS[action]);
}

export const CHARGE_KINDS = [
  "LATE",
  "FUEL",
  "CLEANING",
  "SMOKING",
  "DAMAGE",
  "MILEAGE",
  "OTHER",
] as const;
export const chargeInput = z.object({
  kind: z.enum(CHARGE_KINDS),
  amount: z.number().int().positive().max(100000000),
  reason: z.string().trim().min(5).max(1000),
  evidence: z.string().trim().max(500).optional(),
});
export const reasonInput = z.string().trim().min(5).max(500);

// Deposit settlement at closure: approved charges are taken from the deposit
// first; anything above it is owed by the customer.
export function settlement(
  deposit: number,
  charges: { amount: number; status: string }[],
) {
  const approved = charges
    .filter((c) => c.status === "APPROVED")
    .reduce((sum, c) => sum + c.amount, 0);
  const applied = Math.min(deposit, approved);
  return {
    approved,
    applied,
    refund: deposit - applied,
    owed: approved - applied,
    undecided: charges.some((c) => c.status === "PROPOSED"),
  };
}
