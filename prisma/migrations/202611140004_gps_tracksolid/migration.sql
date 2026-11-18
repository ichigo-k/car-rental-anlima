ALTER TABLE "Vehicle" ADD COLUMN "gpsImei" TEXT;
CREATE UNIQUE INDEX "Vehicle_gpsImei_key" ON "Vehicle"("gpsImei");

CREATE TABLE "IntegrationState" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationState_pkey" PRIMARY KEY ("key")
);
