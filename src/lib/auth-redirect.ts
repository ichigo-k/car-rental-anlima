export function safeAuthRedirect(target: string | null | undefined) {
  if (
    !target ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(target)
  )
    return "/bookings";
  return target;
}
