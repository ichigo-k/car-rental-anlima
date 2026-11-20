import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeFilters,
  parseFilters,
  reportCsv,
  type Report,
} from "../src/lib/reports";
test("report dates are whole days in Ghana time and bad input is ignored", () => {
  const f = parseFilters({
    from: "2026-11-01",
    to: "2026-11-30",
    status: " CLOSED ",
  });
  assert.equal(f.from?.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(f.to?.toISOString(), "2026-11-30T23:59:59.999Z");
  assert.equal(f.status, "CLOSED");
  const bad = parseFilters({ from: "yesterday", to: "2026-13-99'; drop" });
  assert.equal(bad.from, undefined);
  assert.equal(bad.to, undefined);
  assert.equal(describeFilters({}), "none");
});
test("CSV exports say who exported what, in cedis, without formulas", () => {
  const report: Report = {
    type: "bookings",
    title: "Bookings",
    columns: [
      { key: "customer", label: "Customer", kind: "text" },
      { key: "total", label: "Total", kind: "money" },
      { key: "share", label: "Share", kind: "percent" },
    ],
    rows: [{ customer: '=HYPERLINK("x")', total: 123456, share: 41.26 }],
    summary: [],
    truncated: false,
  };
  const csv = reportCsv(
    report,
    parseFilters({ from: "2026-11-01", q: "Ama" }),
    "Finance Officer <finance@example.com>",
    new Date("2026-11-20T10:00:00Z"),
  ).split("\r\n");
  assert.equal(csv[0], '"ANLIMA Bookings report"');
  assert.match(csv[1], /Exported 2026-11-20T10:00:00.000Z by Finance Officer/);
  assert.match(csv[2], /Filters: from 2026-11-01, search 'Ama'/);
  assert.equal(csv.at(-1), `"'=HYPERLINK(""x"")",1234.56,41.3`);
});
