"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

// Guided demo of booking a car. It walks across the real pages (home → cars
// → a car), pointing at the actual buttons. Nothing is submitted.
type Page = "home" | "fleet" | "car";
type TourStep = {
  page: Page;
  element?: string;
  title: string;
  text: string;
  // On the last step of a page, where Next goes (read from the page).
  next?: () => string | null;
};
const STEPS: TourStep[] = [
  {
    page: "home",
    title: "Welcome to ANLIMA",
    text: "Booking a car takes about three minutes. We’ll point to each button you’ll use. Nothing is booked or paid during this tour.",
  },
  {
    page: "home",
    element: '[data-tour="search"]',
    title: "1. Tell us where and when",
    text: "Choose your pickup location, dates and the type of car, then press Search Cars to see what is free.",
  },
  {
    page: "home",
    element: '[data-tour="fleet"] .vehicle-card',
    title: "2. Or pick a car you like",
    text: "Each card shows the price per day, seats, gearbox and fuel. Tap a car to see its details.",
  },
  {
    page: "home",
    element: '[data-tour="view-all"]',
    title: "See every car",
    text: "View All Cars opens the full fleet. Let’s go there now.",
    next: () => "/fleet",
  },
  {
    page: "fleet",
    element: '[data-tour="filters"]',
    title: "3. Narrow it down",
    text: "Filter by car type, search by name, or sort by price to find the right car for your trip.",
  },
  {
    page: "fleet",
    element: '[data-tour="fleet"] .vehicle-card',
    title: "4. Open a car",
    text: "View Details shows photos, features and the booking panel. Let’s open this one.",
    next: () =>
      document
        .querySelector('[data-tour="fleet"] .vehicle-card-link')
        ?.getAttribute("href") ?? null,
  },
  {
    page: "car",
    element: '[data-tour="booking-dates"]',
    title: "5. Choose your dates",
    text: "Pick your pickup and return date and time. All times are Ghana time (GMT).",
  },
  {
    page: "car",
    element: '[data-tour="pickup-point"]',
    title: "6. Choose where to collect it",
    text: "Select the pickup point that suits you. Each car lists where it can be collected.",
  },
  {
    page: "car",
    // The price shows once dates are set; until then, point at Continue.
    element: '[data-tour="booking-price"], [data-tour="booking-continue"]',
    title: "7. See the full price",
    text: "Once your dates are set, you see the total: rental days plus the refundable deposit. No hidden charges.",
  },
  {
    page: "car",
    element: '[data-tour="booking-continue"]',
    title: "8. Continue",
    text: "Sign in or create an account. The first time, you confirm your email and mobile number with a quick code. You do this only once.",
  },
  {
    page: "car",
    title: "9. Add details, then pay",
    text: "Add your Ghana Card and driving licence, review the quote, and reserve. The car is held for 15 minutes while you pay securely by card or Mobile Money. Your confirmation arrives by email and text. That’s it!",
  },
];
const STORE = "anlima-tour-step";
const SEEN = "anlima-tour-seen";
const pageOf = (path: string): Page | null =>
  path === "/"
    ? "home"
    : path === "/fleet"
      ? "fleet"
      : path.startsWith("/fleet/")
        ? "car"
        : null;
const storage = {
  get(key: string, session = true) {
    try {
      return (session ? sessionStorage : localStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null, session = true) {
    try {
      const s = session ? sessionStorage : localStorage;
      if (value === null) s.removeItem(key);
      else s.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode); the tour still runs.
    }
  },
};
export function startBookingTour() {
  storage.set(STORE, "0");
  storage.set(SEEN, "1", false);
  window.dispatchEvent(new Event("anlima-tour"));
}

// Mounted once in the root layout.
export function BookingTour() {
  const path = usePathname();
  const router = useRouter();
  const [prompt, setPrompt] = useState(false);
  const run = useCallback(() => {
    const at = Number(storage.get(STORE));
    const page = pageOf(path);
    if (!Number.isInteger(at) || storage.get(STORE) === null || !page) return;
    if (STEPS[at]?.page !== page) {
      // Started elsewhere: go to the page where the tour continues.
      if (at === 0 && page !== "home") router.push("/");
      return;
    }
    const start = at;
    const pageSteps = STEPS.map((s, i) => ({ ...s, index: i })).filter(
      (s) => s.page === page && s.index >= start,
    );
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tour = driver({
      animate: !reduced,
      smoothScroll: !reduced,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "anlima-tour",
      showProgress: true,
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start booking",
      disableActiveInteraction: true,
      steps: pageSteps.map((s): DriveStep => ({
        element: s.element,
        skipMissingElement: true,
        waitForElement: 1500,
        popover: {
          title: s.title,
          description: s.text,
          side: "bottom",
          align: "center",
          progressText: `Step ${s.index + 1} of ${STEPS.length}`,
          onNextClick: (_el, _step, { driver: d }) => {
            const href = s.next?.();
            if (href) {
              storage.set(STORE, String(s.index + 1));
              d.destroy();
              router.push(href);
              return;
            }
            if (d.isLastStep()) {
              storage.set(STORE, null);
              d.destroy();
              return;
            }
            storage.set(STORE, String(s.index + 1));
            d.moveNext();
          },
          onPrevClick: (_el, _step, { driver: d }) => {
            if (d.isFirstStep()) {
              const previous = STEPS[s.index - 1];
              if (!previous) return;
              storage.set(STORE, String(s.index - 1));
              d.destroy();
              router.back();
              return;
            }
            storage.set(STORE, String(s.index - 1));
            d.movePrevious();
          },
        },
      })),
      onCloseClick: (_el, _step, { driver: d }) => {
        storage.set(STORE, null);
        d.destroy();
      },
      onDestroyStarted: (_el, _step, { driver: d, reason }) => {
        if (reason === "escape" || reason === "overlay")
          storage.set(STORE, null);
        d.destroy();
      },
    });
    // Let the page settle (images, layout) before measuring elements.
    const timer = window.setTimeout(() => tour.drive(), 400);
    return () => {
      window.clearTimeout(timer);
      if (tour.isActive()) tour.destroy();
    };
  }, [path, router]);
  useEffect(() => {
    // ?tour=start begins the tour (for links); ?tour=<step> opens a step.
    const requested = new URLSearchParams(window.location.search).get("tour");
    if (requested !== null) {
      const step = requested === "start" ? 0 : Number(requested);
      if (Number.isInteger(step) && step >= 0 && step < STEPS.length) {
        storage.set(STORE, String(step));
        storage.set(SEEN, "1", false);
      }
    }
    let cleanup = run();
    const restart = () => {
      cleanup?.();
      setPrompt(false);
      if (pageOf(path) !== "home") router.push("/");
      else cleanup = run();
    };
    window.addEventListener("anlima-tour", restart);
    // First visit to the home page: offer the tour once.
    if (
      path === "/" &&
      storage.get(STORE) === null &&
      !storage.get(SEEN, false) &&
      !new URLSearchParams(window.location.search).has("notour")
    )
      setPrompt(true);
    return () => {
      cleanup?.();
      window.removeEventListener("anlima-tour", restart);
    };
  }, [path, router, run]);
  if (!prompt) return null;
  return (
    <aside className="tour-prompt" aria-label="Booking guide">
      <span className="tour-prompt-icon" aria-hidden="true">
        ➜
      </span>
      <div>
        <strong>New to ANLIMA?</strong>
        <p>See how to book a car in a quick guided tour.</p>
      </div>
      <div className="tour-prompt-actions">
        <button
          type="button"
          className="button small"
          onClick={() => {
            setPrompt(false);
            startBookingTour();
          }}
        >
          Show me
        </button>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            storage.set(SEEN, "1", false);
            setPrompt(false);
          }}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
export function StartTourButton({
  className = "button secondary",
  children = "How to book: take the tour",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={startBookingTour}>
      {children}
    </button>
  );
}
