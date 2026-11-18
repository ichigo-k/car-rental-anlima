// Role-based permissions (Developer Guide §3). Deny by default: a role has only
// the permissions listed here, and every server route checks them.
export const STAFF_ROLES = [
  "ADMIN",
  "MANAGER",
  "AGENT",
  "FLEET",
  "FINANCE",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const grants = {
  "booking.read": ["ADMIN", "MANAGER", "AGENT", "FINANCE"],
  "booking.write": ["ADMIN", "MANAGER", "AGENT"],
  "booking.close": ["ADMIN", "MANAGER", "FINANCE"],
  "charge.propose": ["ADMIN", "MANAGER", "AGENT"],
  "charge.decide": ["ADMIN", "MANAGER", "FINANCE"],
  "customer.read": ["ADMIN", "MANAGER", "AGENT"],
  "enquiry.read": ["ADMIN", "MANAGER", "AGENT"],
  "vehicle.write": ["ADMIN", "MANAGER", "FLEET"],
  "gps.view": ["ADMIN", "MANAGER", "FLEET"],
  "payment.review": ["ADMIN", "MANAGER", "FINANCE"],
  "payment.refund": ["ADMIN", "MANAGER", "FINANCE"],
  "promotion.read": ["ADMIN", "MANAGER", "FINANCE"],
  "promotion.manage": ["ADMIN", "MANAGER"],
  "report.export": ["ADMIN", "MANAGER", "FINANCE"],
  "audit.read": ["ADMIN", "MANAGER"],
  "review.manage": ["ADMIN", "MANAGER"],
  "user.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
} satisfies Record<string, StaffRole[]>;
export type Permission = keyof typeof grants;

export function isStaffRole(role: unknown): role is StaffRole {
  return (
    typeof role === "string" &&
    (STAFF_ROLES as readonly string[]).includes(role)
  );
}
export function can(role: unknown, permission: Permission) {
  return (
    isStaffRole(role) &&
    (grants[permission] as readonly string[]).includes(role)
  );
}
export const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "System administrator",
  MANAGER: "Manager",
  AGENT: "Rental agent",
  FLEET: "Fleet officer",
  FINANCE: "Finance officer",
};
