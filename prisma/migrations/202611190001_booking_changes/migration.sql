-- Staff changes to a booking's car or dates (Guide AC-05).
CREATE TABLE "BookingChange" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromVehicleId" TEXT NOT NULL,
    "toVehicleId" TEXT NOT NULL,
    "fromPickup" TIMESTAMP(3) NOT NULL,
    "toPickup" TIMESTAMP(3) NOT NULL,
    "fromReturn" TIMESTAMP(3) NOT NULL,
    "toReturn" TIMESTAMP(3) NOT NULL,
    "priceDifference" INTEGER NOT NULL,
    "chargeId" TEXT,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingChange_bookingId_idx" ON "BookingChange"("bookingId");

ALTER TABLE "BookingChange" ADD CONSTRAINT "BookingChange_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
