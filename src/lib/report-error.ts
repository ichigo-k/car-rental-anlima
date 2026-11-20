import { db } from "./db";
import { recordError } from "./monitoring";

// Node.js-only entry for src/instrumentation.ts.
export function reportServerError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  return recordError(db, error, request, context);
}
