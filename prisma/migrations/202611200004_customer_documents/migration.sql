-- Customer licence and Ghana Card scans, encrypted on disk (Guide §5).
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerDocument_storageKey_key" ON "CustomerDocument"("storageKey");
CREATE UNIQUE INDEX "CustomerDocument_userId_kind_key" ON "CustomerDocument"("userId", "kind");
CREATE INDEX "CustomerDocument_status_idx" ON "CustomerDocument"("status");

ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
