ALTER TABLE "Booking" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "returnedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "depositApplied" INTEGER;

CREATE TABLE "BookingCharge" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "proposedBy" TEXT NOT NULL,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingCharge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingCharge_bookingId_idx" ON "BookingCharge"("bookingId");
ALTER TABLE "BookingCharge" ADD CONSTRAINT "BookingCharge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Statuses renamed to the Developer Guide lifecycle. Rentals completed before
-- this release were settled outside the system, so they close directly.
UPDATE "Booking" SET "status" = 'CHECKED_OUT' WHERE "status" = 'ACTIVE';
UPDATE "Booking" b SET "status" = 'CLOSED',
  "returnedAt" = (SELECT MAX(i."createdAt") FROM "Inspection" i WHERE i."bookingId" = b."id" AND i."kind" = 'RETURN'),
  "closedAt" = (SELECT MAX(i."createdAt") FROM "Inspection" i WHERE i."bookingId" = b."id" AND i."kind" = 'RETURN')
WHERE "status" = 'COMPLETED';
