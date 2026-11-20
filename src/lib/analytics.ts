// Pages analytics never counts: accounts, bookings, sign-in and staff pages.
const PRIVATE = [
  "/admin",
  "/account",
  "/bookings",
  "/favourites",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/staff-security",
  "/auth",
];
export const isPrivatePath = (path: string) =>
  PRIVATE.some((p) => path === p || path.startsWith(`${p}/`));
// Query strings and fragments can hold tokens or booking references.
export const withoutQuery = (url: unknown) =>
  String(url ?? "").split(/[?#]/)[0];
