export function bookingStatus(
  status: string,
  expiresAt: Date,
  now = new Date(),
) {
  return status === "PENDING_PAYMENT" && expiresAt <= now ? "EXPIRED" : status;
}
export function statusLabel(status: string) {
  return (
    (
      {
        PENDING_PAYMENT: "Awaiting payment",
        CONFIRMED: "Confirmed",
        CHECKED_OUT: "On the road",
        RETURNED: "Returned",
        CLOSED: "Closed",
        NO_SHOW: "No-show",
        CANCELLED: "Cancelled",
        EXPIRED: "Hold expired",
        PAYMENT_REVIEW: "Payment review",
        AVAILABLE: "Available",
        MAINTENANCE: "Maintenance",
        INACTIVE: "Inactive",
      } as Record<string, string>
    )[status] ?? status.replaceAll("_", " ")
  );
}
