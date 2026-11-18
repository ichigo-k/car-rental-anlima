CREATE TABLE "AssistantRequest" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssistantRequest_fingerprint_createdAt_idx" ON "AssistantRequest"("fingerprint", "createdAt");
CREATE INDEX "AssistantRequest_createdAt_idx" ON "AssistantRequest"("createdAt");
