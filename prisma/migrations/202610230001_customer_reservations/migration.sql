ALTER TABLE "Vehicle" ADD COLUMN "pickupPoints" TEXT[] NOT NULL DEFAULT ARRAY['Accra · Airport pickup', 'Accra · City pickup']::TEXT[];
ALTER TABLE "Booking" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "ghanaCardEncrypted" TEXT;
ALTER TABLE "Booking" ADD COLUMN "ghanaCardLast4" TEXT;

CREATE TABLE "Favourite" (
  "userId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favourite_pkey" PRIMARY KEY ("userId", "vehicleId"),
  CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Favourite_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Favourite_vehicleId_idx" ON "Favourite"("vehicleId");
