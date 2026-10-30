CREATE TABLE "ContactEnquiry" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactEnquiry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactEnquiry_reference_key" ON "ContactEnquiry"("reference");
CREATE INDEX "ContactEnquiry_createdAt_idx" ON "ContactEnquiry"("createdAt");
CREATE INDEX "ContactEnquiry_fingerprint_createdAt_idx" ON "ContactEnquiry"("fingerprint", "createdAt");
