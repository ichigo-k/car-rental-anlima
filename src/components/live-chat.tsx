"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
// Tawk.to live chat with ANLIMA staff (free plan). Loads only when both IDs
// are set, and stays hidden on staff pages.
type TawkApi = {
  hideWidget?: () => void;
  showWidget?: () => void;
  onLoad?: () => void;
};
declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}
const hiddenOn = (path: string) =>
  path.startsWith("/admin") || path.startsWith("/staff-security");
export function LiveChat({
  propertyId,
  widgetId,
}: {
  propertyId?: string;
  widgetId?: string;
}) {
  const path = usePathname();
  const ready = !!propertyId && !!widgetId;
  useEffect(() => {
    if (!ready || hiddenOn(path)) return;
    if (document.getElementById("tawk-script")) return;
    window.Tawk_API = window.Tawk_API ?? {};
    window.Tawk_LoadStart = new Date();
    const script = document.createElement("script");
    script.id = "tawk-script";
    script.async = true;
    script.src = `https://embed.tawk.to/${encodeURIComponent(propertyId!)}/${encodeURIComponent(widgetId!)}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.body.appendChild(script);
  }, [ready, path, propertyId, widgetId]);
  // Moving between public and staff pages shows or hides the bubble.
  useEffect(() => {
    if (!ready) return;
    const api = window.Tawk_API;
    const apply = () =>
      hiddenOn(path) ? api?.hideWidget?.() : api?.showWidget?.();
    if (api?.hideWidget) apply();
    else if (api) api.onLoad = apply;
  }, [ready, path]);
  return null;
}
