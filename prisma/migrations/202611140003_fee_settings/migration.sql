CREATE TABLE "FeeSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "lateGraceMinutes" INTEGER NOT NULL DEFAULT 60,
  "lateDayPercent" INTEGER NOT NULL DEFAULT 100,
  "fuelPerQuarter" INTEGER NOT NULL DEFAULT 0,
  "cleaningFee" INTEGER NOT NULL DEFAULT 0,
  "smokingFee" INTEGER NOT NULL DEFAULT 0,
  "dailyKmAllowance" INTEGER,
  "excessKmFee" INTEGER NOT NULL DEFAULT 0,
  "freeCancellationHours" INTEGER NOT NULL DEFAULT 48,
  "lateCancellationPercent" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "FeeSettings_pkey" PRIMARY KEY ("id")
);
