import type { Instrumentation } from "next";

// Records server errors and emails the operations inbox (src/lib/monitoring.ts).
// The import sits inside the runtime check so the edge build leaves it out.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { reportServerError } = await import("./lib/report-error");
      await reportServerError(error, request, context);
    } catch {
      // Never let monitoring break a response.
    }
  }
};
