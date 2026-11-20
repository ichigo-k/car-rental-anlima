import type { Prisma, PrismaClient } from "@prisma/client";
import { statusLabel } from "./booking-status";
import { settlement } from "./booking-lifecycle";
import { refundedTotals, VERIFIED_PAYMENT } from "./refunds";

// Operational reports (Guide §10). The screen and the CSV export call the same
// function with the same filters, so an export always matches what was shown.
export const REPORTS = {
  bookings: "Bookings",
  payments: "Payments",
  fleet: "Fleet utilisation",
  returns: "Returns and charges",
  customers: "Customers",
} as const;
export type ReportType = keyof typeof REPORTS;
export type Filters = {
  from?: Date;
  to?: Date;
  status?: string;
  category?: string;
  vehicleId?: string;
  provider?: string;
  q?: string;
};
type Kind = "text" | "money" | "number" | "date" | "percent";
export type Column = { key: string; label: string; kind: Kind };
export type Cell = string | number | Date | null;
export type Report = {
  type: ReportType;
  title: string;
  columns: Column[];
  rows: Record<string, Cell>[];
  summary: { label: string; value: Cell; kind: Kind }[];
  truncated: boolean;
};
const MAX_ROWS = 10000;
const DAY = 86400000;
// Rentals that went ahead or still hold the car.
const ACTIVE = ["CONFIRMED", "CHECKED_OUT", "RETURNED", "CLOSED", "NO_SHOW"];

// Dates are calendar days in Ghana time (GMT): `to` includes the whole day.
export function parseFilters(q: Record<string, string | undefined>): Filters {
  const day = (v?: string, end = false) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z`)
      : undefined;
  const text = (v?: string) => v?.trim().slice(0, 100) || undefined;
  return {
    from: day(q.from),
    to: day(q.to, true),
    status: text(q.status),
    category: text(q.category),
    vehicleId: text(q.vehicleId),
    provider: text(q.provider),
    q: text(q.q),
  };
}
export const isReportType = (t: unknown): t is ReportType =>
  typeof t === "string" && t in REPORTS;
export function describeFilters(f: Filters) {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return (
    [
      f.from && `from ${day(f.from)}`,
      f.to && `to ${day(f.to)}`,
      f.status && `status ${f.status}`,
      f.category && `category ${f.category}`,
      f.vehicleId && `car ${f.vehicleId}`,
      f.provider && `provider ${f.provider}`,
      f.q && `search "${f.q}"`,
    ]
      .filter(Boolean)
      .join(", ") || "none"
  );
}
const range = (f: Filters) =>
  f.from || f.to
    ? { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) }
    : undefined;
const overlapDays = (a: Date, b: Date, from: Date, to: Date) =>
  Math.max(
    0,
    Math.min(b.getTime(), to.getTime()) - Math.max(a.getTime(), from.getTime()),
  ) / DAY;
const round1 = (n: number) => Math.round(n * 10) / 10;

async function bookings(db: PrismaClient, f: Filters): Promise<Report> {
  const where: Prisma.BookingWhereInput = {
    ...(range(f) ? { pickup: range(f) } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
    ...(f.category ? { vehicle: { category: f.category } } : {}),
    ...(f.q
      ? {
          OR: [
            { reference: { contains: f.q, mode: "insensitive" } },
            { customerName: { contains: f.q, mode: "insensitive" } },
            { customerEmail: { contains: f.q, mode: "insensitive" } },
            { phone: { contains: f.q } },
          ],
        }
      : {}),
  };
  const list = await db.booking.findMany({
    where,
    include: { vehicle: { select: { name: true, category: true } } },
    orderBy: { pickup: "asc" },
    take: MAX_ROWS + 1,
  });
  const rows = list.slice(0, MAX_ROWS).map((b) => ({
    reference: b.reference,
    created: b.createdAt,
    customer: b.customerName ?? b.customerEmail ?? "",
    car: b.vehicle.name,
    category: b.vehicle.category,
    pickup: b.pickup,
    returnAt: b.returnAt,
    days: b.days,
    status: statusLabel(b.status),
    rental: b.total - b.deposit,
    deposit: b.deposit,
    total: b.total,
  }));
  const active = list
    .slice(0, MAX_ROWS)
    .filter((b) => ACTIVE.includes(b.status));
  return {
    type: "bookings",
    title: REPORTS.bookings,
    columns: [
      { key: "reference", label: "Reference", kind: "text" },
      { key: "created", label: "Booked", kind: "date" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "car", label: "Car", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "pickup", label: "Pickup", kind: "date" },
      { key: "returnAt", label: "Return", kind: "date" },
      { key: "days", label: "Days", kind: "number" },
      { key: "status", label: "Status", kind: "text" },
      { key: "rental", label: "Rental value", kind: "money" },
      { key: "deposit", label: "Deposit", kind: "money" },
      { key: "total", label: "Total", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Bookings", value: rows.length, kind: "number" },
      { label: "Confirmed or completed", value: active.length, kind: "number" },
      {
        label: "Rental value (confirmed or completed)",
        value: active.reduce((s, b) => s + b.total - b.deposit, 0),
        kind: "money",
      },
      {
        label: "Rental days (confirmed or completed)",
        value: active.reduce((s, b) => s + b.days, 0),
        kind: "number",
      },
    ],
    truncated: list.length > MAX_ROWS,
  };
}

async function payments(db: PrismaClient, f: Filters): Promise<Report> {
  const statusWhere =
    f.status === "verified"
      ? { status: { in: VERIFIED_PAYMENT } }
      : f.status === "review"
        ? { status: "SUCCESS_REVIEW" }
        : f.status === "unverified"
          ? { status: { notIn: VERIFIED_PAYMENT } }
          : {};
  const list = await db.payment.findMany({
    where: {
      ...(range(f) ? { createdAt: range(f) } : {}),
      ...(f.provider ? { provider: f.provider } : {}),
      ...statusWhere,
    },
    include: { booking: { select: { reference: true } }, refunds: true },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS + 1,
  });
  const rows = list.slice(0, MAX_ROWS).map((p) => {
    const verified = VERIFIED_PAYMENT.includes(p.status);
    const r = refundedTotals(p.refunds);
    return {
      reference: p.reference,
      created: p.createdAt,
      verifiedAt: p.verifiedAt,
      provider: p.provider === "FLUTTERWAVE" ? "Flutterwave" : "Paystack",
      booking: p.booking.reference,
      status: verified
        ? p.status === "SUCCESS"
          ? "Verified"
          : "Verified, needs review"
        : statusLabel(p.status),
      amount: p.amount,
      refunded: r.processed,
      inProgress: r.committed - r.processed,
      net: verified ? p.amount - r.processed : 0,
    };
  });
  const verified = rows.filter((r) => r.status.startsWith("Verified"));
  const sum = (key: "amount" | "refunded" | "inProgress" | "net") =>
    verified.reduce((s, r) => s + r[key], 0);
  return {
    type: "payments",
    title: REPORTS.payments,
    columns: [
      { key: "reference", label: "Payment reference", kind: "text" },
      { key: "created", label: "Started", kind: "date" },
      { key: "verifiedAt", label: "Verified", kind: "date" },
      { key: "provider", label: "Provider", kind: "text" },
      { key: "booking", label: "Booking", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "refunded", label: "Refunded", kind: "money" },
      { key: "inProgress", label: "Refund in progress", kind: "money" },
      { key: "net", label: "Net received", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Verified payments", value: verified.length, kind: "number" },
      { label: "Gross received", value: sum("amount"), kind: "money" },
      { label: "Refunded", value: sum("refunded"), kind: "money" },
      { label: "Refunds in progress", value: sum("inProgress"), kind: "money" },
      { label: "Net received", value: sum("net"), kind: "money" },
    ],
    truncated: list.length > MAX_ROWS,
  };
}

async function fleet(db: PrismaClient, f: Filters, now: Date): Promise<Report> {
  const to = f.to ?? now;
  const from = f.from ?? new Date(to.getTime() - 30 * DAY);
  const period = Math.max(0, (to.getTime() - from.getTime()) / DAY);
  const cars = await db.vehicle.findMany({
    where: {
      ...(f.vehicleId ? { id: f.vehicleId } : {}),
      ...(f.category ? { category: f.category } : {}),
    },
    include: {
      blocks: { where: { start: { lt: to }, end: { gt: from } } },
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_OUT", "RETURNED", "CLOSED"] },
          pickup: { lt: to },
          returnAt: { gt: from },
        },
        select: {
          status: true,
          pickup: true,
          returnAt: true,
          returnedAt: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const rows = cars.map((car) => {
    const blocked = Math.min(
      period,
      car.blocks.reduce((s, b) => s + overlapDays(b.start, b.end, from, to), 0),
    );
    let rented = 0;
    let reserved = 0;
    for (const b of car.bookings) {
      // A returned car stops counting when it came back.
      const end = b.returnedAt ?? b.returnAt;
      const days = overlapDays(b.pickup, end, from, to);
      if (b.status === "CONFIRMED") reserved += days;
      else rented += days;
    }
    const available = Math.max(0, period - blocked);
    return {
      car: car.name,
      category: car.category,
      status: statusLabel(car.status),
      period: round1(period),
      blocked: round1(blocked),
      available: round1(available),
      reserved: round1(reserved),
      rented: round1(rented),
      utilisation: available
        ? Math.min(100, ((rented + reserved) / available) * 100)
        : 0,
    };
  });
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0);
  const totalUsed = rows.reduce((s, r) => s + r.rented + r.reserved, 0);
  return {
    type: "fleet",
    title: REPORTS.fleet,
    columns: [
      { key: "car", label: "Car", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "status", label: "Status now", kind: "text" },
      { key: "period", label: "Days in period", kind: "number" },
      { key: "blocked", label: "Blocked", kind: "number" },
      { key: "available", label: "Available", kind: "number" },
      { key: "reserved", label: "Reserved", kind: "number" },
      { key: "rented", label: "Rented", kind: "number" },
      { key: "utilisation", label: "Utilisation", kind: "percent" },
    ],
    rows,
    summary: [
      { label: "Period start", value: from, kind: "date" },
      { label: "Period end", value: to, kind: "date" },
      {
        label: "Days rented or reserved",
        value: round1(totalUsed),
        kind: "number",
      },
      {
        label: "Fleet utilisation",
        value: totalAvailable ? (totalUsed / totalAvailable) * 100 : 0,
        kind: "percent",
      },
    ],
    truncated: false,
  };
}

async function returns(db: PrismaClient, f: Filters): Promise<Report> {
  const list = await db.booking.findMany({
    where: {
      status: { in: ["RETURNED", "CLOSED"] },
      ...(range(f) ? { returnedAt: range(f) } : {}),
      ...(f.vehicleId ? { vehicleId: f.vehicleId } : {}),
      ...(f.category ? { vehicle: { category: f.category } } : {}),
    },
    include: { vehicle: { select: { name: true } }, charges: true },
    orderBy: { returnedAt: "asc" },
    take: MAX_ROWS + 1,
  });
  const byKind = new Map<string, number>();
  const rows = list.slice(0, MAX_ROWS).map((b) => {
    const s = settlement(b.deposit, b.charges);
    for (const c of b.charges.filter((c) => c.status === "APPROVED"))
      byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + c.amount);
    const late = b.returnedAt
      ? Math.max(0, (b.returnedAt.getTime() - b.returnAt.getTime()) / 3600000)
      : 0;
    const sumOf = (status: string) =>
      b.charges
        .filter((c) => c.status === status)
        .reduce((t, c) => t + c.amount, 0);
    return {
      reference: b.reference,
      car: b.vehicle.name,
      due: b.returnAt,
      returned: b.returnedAt,
      lateHours: round1(late),
      approved: s.approved,
      waived: sumOf("WAIVED"),
      awaiting: sumOf("PROPOSED"),
      deposit: b.deposit,
      depositApplied: s.applied,
      depositReturned: s.refund,
      owed: s.owed,
      status: statusLabel(b.status),
    };
  });
  return {
    type: "returns",
    title: REPORTS.returns,
    columns: [
      { key: "reference", label: "Booking", kind: "text" },
      { key: "car", label: "Car", kind: "text" },
      { key: "due", label: "Due back", kind: "date" },
      { key: "returned", label: "Returned", kind: "date" },
      { key: "lateHours", label: "Hours late", kind: "number" },
      { key: "approved", label: "Charges approved", kind: "money" },
      { key: "waived", label: "Waived", kind: "money" },
      { key: "awaiting", label: "Awaiting decision", kind: "money" },
      { key: "deposit", label: "Deposit", kind: "money" },
      { key: "depositApplied", label: "Deposit used", kind: "money" },
      { key: "depositReturned", label: "Deposit to return", kind: "money" },
      { key: "owed", label: "Customer owes", kind: "money" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows,
    summary: [
      { label: "Returns", value: rows.length, kind: "number" },
      {
        label: "Returned late (over 1 hour)",
        value: rows.filter((r) => r.lateHours > 1).length,
        kind: "number",
      },
      ...[...byKind.entries()].map(([kind, value]) => ({
        label: `${kind.charAt(0)}${kind.slice(1).toLowerCase().replaceAll("_", " ")} charges`,
        value,
        kind: "money" as const,
      })),
      {
        label: "Deposits to return",
        value: rows.reduce((s, r) => s + r.depositReturned, 0),
        kind: "money",
      },
      {
        label: "Owed by customers",
        value: rows.reduce((s, r) => s + r.owed, 0),
        kind: "money",
      },
    ],
    truncated: list.length > MAX_ROWS,
  };
}

async function customers(db: PrismaClient, f: Filters): Promise<Report> {
  const list = await db.user.findMany({
    where: {
      role: "CUSTOMER",
      bookings: { some: range(f) ? { createdAt: range(f) } : {} },
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: "insensitive" } },
              { email: { contains: f.q, mode: "insensitive" } },
              { phoneNumber: { contains: f.q } },
            ],
          }
        : {}),
    },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      bookings: {
        select: {
          status: true,
          createdAt: true,
          payments: { select: { status: true, amount: true, refunds: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_ROWS + 1,
  });
  const rows = list.slice(0, MAX_ROWS).map((u) => {
    const paid = u.bookings
      .flatMap((b) => b.payments)
      .filter((p) => VERIFIED_PAYMENT.includes(p.status))
      .reduce((s, p) => s + p.amount - refundedTotals(p.refunds).processed, 0);
    const latest = u.bookings.reduce<Date | null>(
      (d, b) => (!d || b.createdAt > d ? b.createdAt : d),
      null,
    );
    return {
      name: u.name,
      email: u.email,
      phone: u.phoneNumber ?? "",
      since: u.createdAt,
      bookings: u.bookings.length,
      rentals: u.bookings.filter((b) =>
        ["RETURNED", "CLOSED"].includes(b.status),
      ).length,
      latest,
      paid,
    };
  });
  return {
    type: "customers",
    title: REPORTS.customers,
    columns: [
      { key: "name", label: "Name", kind: "text" },
      { key: "email", label: "Email", kind: "text" },
      { key: "phone", label: "Phone", kind: "text" },
      { key: "since", label: "Customer since", kind: "date" },
      { key: "bookings", label: "Bookings", kind: "number" },
      { key: "rentals", label: "Completed rentals", kind: "number" },
      { key: "latest", label: "Latest booking", kind: "date" },
      { key: "paid", label: "Paid, less refunds", kind: "money" },
    ],
    rows,
    summary: [
      { label: "Customers", value: rows.length, kind: "number" },
      {
        label: "With a completed rental",
        value: rows.filter((r) => r.rentals > 0).length,
        kind: "number",
      },
      {
        label: "Paid, less refunds",
        value: rows.reduce((s, r) => s + r.paid, 0),
        kind: "money",
      },
    ],
    truncated: list.length > MAX_ROWS,
  };
}

export function runReport(
  db: PrismaClient,
  type: ReportType,
  filters: Filters,
  now = new Date(),
): Promise<Report> {
  switch (type) {
    case "bookings":
      return bookings(db, filters);
    case "payments":
      return payments(db, filters);
    case "fleet":
      return fleet(db, filters, now);
    case "returns":
      return returns(db, filters);
    case "customers":
      return customers(db, filters);
  }
}

// Spreadsheet-friendly CSV: a short header saying what the file is, who
// exported it and with which filters, then the rows. Amounts are in cedis.
export function reportCsv(
  report: Report,
  filters: Filters,
  exportedBy: string,
  at = new Date(),
) {
  const cell = (v: Cell, kind: Kind) => {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "number")
      return kind === "money"
        ? (v / 100).toFixed(2)
        : String(kind === "percent" ? round1(v) : v);
    // Text that a spreadsheet could run as a formula is prefixed.
    return `"${String(v)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  };
  const head = [
    `"ANLIMA ${report.title} report"`,
    `"Exported ${at.toISOString()} by ${exportedBy.replaceAll('"', "'")}"`,
    `"Filters: ${describeFilters(filters).replaceAll('"', "'")}"`,
    `"Amounts in GHS; times in UTC (Ghana time)"`,
    "",
  ];
  return [
    ...head,
    report.columns.map((c) => cell(c.label, "text")).join(","),
    ...report.rows.map((r) =>
      report.columns.map((c) => cell(r[c.key], c.kind)).join(","),
    ),
  ].join("\r\n");
}
