import { readFileSync } from "node:fs";
// End-to-end tests create accounts and bookings, which queue real emails and
// texts. When live provider keys are configured, the dev server must send to a
// dead local address instead: `npm run dev:test` does that and leaves its
// process id in .next/dev-test.pid while it runs.
export const OFFLINE_PROVIDERS = {
  RESEND_BASE_URL: "http://127.0.0.1:9",
  SMSONLINEGH_BASE_URL: "http://127.0.0.1:9",
};
function offlineServerRunning() {
  try {
    process.kill(Number(readFileSync(".next/dev-test.pid", "utf8")), 0);
    return true;
  } catch {
    return false;
  }
}
export function requireOfflineProviders() {
  const live = process.env.RESEND_API_KEY || process.env.SMSONLINEGH_API_KEY;
  if (
    live &&
    !offlineServerRunning() &&
    process.env.ALLOW_REAL_MESSAGES !== "1"
  ) {
    console.error(
      "Real email/SMS keys are configured. Start the app with `npm run dev:test` (not `npm run dev`) so test messages go nowhere, then run this test again.",
    );
    process.exit(1);
  }
  Object.assign(process.env, OFFLINE_PROVIDERS);
}
