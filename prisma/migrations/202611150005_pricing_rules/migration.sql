ALTER TABLE "Vehicle" ADD COLUMN "driverOption" TEXT NOT NULL DEFAULT 'SELF_DRIVE';
ALTER TABLE "Vehicle" ADD COLUMN "withDriverRate" INTEGER;
ALTER TABLE "Vehicle" ADD COLUMN "dailyKmAllowance" INTEGER;
ALTER TABLE "Vehicle" ADD COLUMN "excessKmFee" INTEGER;

-- Bookings with an ANLIMA driver do not need the customer's licence.
ALTER TABLE "Booking" ALTER COLUMN "licenceNumber" DROP NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "licenceExpiry" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "withDriver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "durationDiscount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "extrasAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "Booking" ADD COLUMN "extraDriverName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "extraDriverLicence" TEXT;

CREATE TABLE "BookingItem" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Late returns are now charged per hour (capped at a day) instead of per day.
ALTER TABLE "FeeSettings" DROP COLUMN "lateDayPercent";
ALTER TABLE "FeeSettings" ADD COLUMN "lateHourPercent" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "FeeSettings" ADD COLUMN "discount3Days" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "FeeSettings" ADD COLUMN "discount7Days" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "FeeSettings" ADD COLUMN "discount14Days" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "FeeSettings" ADD COLUMN "discount30Days" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "FeeSettings" ADD COLUMN "deliveryFee" INTEGER NOT NULL DEFAULT 15000;
ALTER TABLE "FeeSettings" ADD COLUMN "extraDriverFee" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "FeeSettings" ADD COLUMN "driverOvertimeHourly" INTEGER NOT NULL DEFAULT 5000;
