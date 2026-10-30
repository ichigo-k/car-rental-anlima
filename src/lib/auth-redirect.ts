export function safeAuthRedirect(target: string | null | undefined) {
  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(target)
  )
    return "/bookings";
  const path = target.split(/[?#]/)[0].replace(/\/+$/, "");
  if (
    ["/sign-in", "/auth/continue"].includes(path) ||
    path.startsWith("/api/auth/")
  )
    return "/bookings";
  return target;
}

export function isStaffRole(role: unknown) {
  return (
    typeof role === "string" &&
    ["ADMIN", "MANAGER", "AGENT", "FLEET", "FINANCE"].includes(role)
  );
}

export function accountDestination(role: unknown, requested?: string | null) {
  const target = safeAuthRedirect(requested);
  if (!isStaffRole(role)) return target;
  return target === "/admin" ||
    target.startsWith("/admin/") ||
    target.startsWith("/admin?")
    ? target
    : "/admin";
}

export function authContinuation(requested?: string | null) {
  return `/auth/continue?next=${encodeURIComponent(safeAuthRedirect(requested))}`;
}
