CREATE TABLE "Promotion" (
 "id" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT,
 "discountType" TEXT NOT NULL, "value" INTEGER NOT NULL,
 "vehicleIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "minimumRental" INTEGER NOT NULL DEFAULT 0,
 "maxUses" INTEGER, "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Promotion_discount_check" CHECK (("discountType" = 'PERCENT' AND "value" BETWEEN 1 AND 90) OR ("discountType" = 'FIXED' AND "value" > 0)),
 CONSTRAINT "Promotion_dates_check" CHECK ("endsAt" > "startsAt"),
 CONSTRAINT "Promotion_limits_check" CHECK ("minimumRental" >= 0 AND ("maxUses" IS NULL OR "maxUses" > 0))
);
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
ALTER TABLE "Booking" ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "promotionId" TEXT, ADD COLUMN "promotionName" TEXT, ADD COLUMN "couponCode" TEXT;
CREATE INDEX "Booking_promotionId_idx" ON "Booking"("promotionId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
