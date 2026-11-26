-- First-party website analytics without personal data (Guide §10).
CREATE TABLE "SiteEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrerHost" TEXT,
    "device" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteEvent_at_idx" ON "SiteEvent"("at");
CREATE INDEX "SiteEvent_type_at_idx" ON "SiteEvent"("type", "at");
