import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  REPORTS,
  describeFilters,
  isReportType,
  parseFilters,
  reportCsv,
  runReport,
} from "@/lib/reports";
// CSV export of a report with the same filters as the screen (Guide AC-09).
// ?type=bookings|payments|fleet|returns|customers plus the report's filters.
// Every export is recorded with its filters in the activity history.
export async function GET(req: Request) {
  let current;
  try {
    current = await requireStaff("report.export");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const type = isReportType(params.type) ? params.type : "bookings";
  const filters = parseFilters(params);
  const now = new Date();
  const report = await runReport(db, type, filters, now);
  await db.auditEvent.create({
    data: {
      actorId: current.user.id,
      action: "REPORT_EXPORTED",
      entityId: type,
      detail: `${REPORTS[type]}: ${report.rows.length} rows${report.truncated ? " (first 10000)" : ""}; filters ${describeFilters(filters)}`,
    },
  });
  const csv = reportCsv(
    report,
    filters,
    `${current.user.name} <${current.user.email}>`,
    now,
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=anlima-${type}-${now.toISOString().slice(0, 10)}.csv`,
      "Cache-Control": "no-store",
    },
  });
}
