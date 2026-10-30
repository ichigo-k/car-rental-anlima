"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "@phosphor-icons/react";
import { isStaffRole } from "@/lib/auth-redirect";

type SavedState = {
  authenticated: boolean;
  vehicleIds: string[];
  role?: string | null;
};
const Context = createContext<{
  state: SavedState | null;
  change: (id: string, saved: boolean) => void;
}>({ state: null, change: () => {} });
export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SavedState | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/favourites", { cache: "no-store", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setState)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function change(id: string, saved: boolean) {
    setState((s) => ({
      authenticated: true,
      role: s?.role,
      vehicleIds: saved
        ? [...new Set([...(s?.vehicleIds ?? []), id])]
        : (s?.vehicleIds ?? []).filter((v) => v !== id),
    }));
  }
  return (
    <Context.Provider value={{ state, change }}>{children}</Context.Provider>
  );
}
export function AccountLinks() {
  const { state } = useContext(Context);
  if (isStaffRole(state?.role))
    return (
      <div className="customer-links">
        <Link href="/admin">Dashboard</Link>
      </div>
    );
  return (
    <div className="customer-links">
      <Link href="/favourites" aria-label="Favourite cars">
        <Heart size={20} />
        <span>Saved</span>
      </Link>
      <Link href={state?.authenticated ? "/bookings" : "/sign-in"}>
        {state?.authenticated ? "My account" : "Sign in"}
      </Link>
    </div>
  );
}
export function FavouriteButton({
  vehicleId,
  name,
}: {
  vehicleId: string;
  name: string;
}) {
  const router = useRouter();
  const { state, change } = useContext(Context);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saved = state?.vehicleIds.includes(vehicleId) ?? false;
  if (isStaffRole(state?.role)) return null;
  return (
    <div className="favourite-control">
      <button
        className={`favourite-button ${saved ? "is-saved" : ""}`}
        type="button"
        aria-label={`${saved ? "Remove" : "Save"} ${name} ${saved ? "from" : "to"} favourites`}
        aria-pressed={saved}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/favourites", {
              method: saved ? "DELETE" : "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicleId }),
            });
            if (response.status === 401) {
              window.location.assign(
                `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
              );
              return;
            }
            const result = await response.json();
            if (!response.ok)
              throw new Error(result.error || "Could not save this car.");
            change(vehicleId, result.saved);
            if (window.location.pathname === "/favourites") router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Heart size={20} weight={saved ? "fill" : "regular"} />
      </button>
      {error && (
        <span role="alert" className="favourite-error">
          {error}
        </span>
      )}
    </div>
  );
}
