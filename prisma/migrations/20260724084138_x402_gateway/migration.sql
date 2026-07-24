-- CreateTable
CREATE TABLE "NonceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nonce" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "amountUsdc" TEXT NOT NULL,
    "payTo" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedByTx" TEXT,
    "ipAddress" TEXT
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nonce" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "payerAddress" TEXT NOT NULL,
    "payTo" TEXT NOT NULL,
    "amountUsdc" TEXT NOT NULL,
    "amountAtomicUnits" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "txHash" TEXT,
    "settlementMode" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,
    "runId" TEXT
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nonce" TEXT NOT NULL,
    "correlationId" TEXT,
    "idempotencyKey" TEXT,
    "resource" TEXT NOT NULL,
    "amountUsdc" TEXT NOT NULL,
    "payTo" TEXT NOT NULL,
    "payerAddress" TEXT,
    "chainId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "paymentRecordId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifyingAt" DATETIME,
    "settledAt" DATETIME,
    "failedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EndpointConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resource" TEXT NOT NULL,
    "amountUsdc" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payTo" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "nonceTtlSeconds" INTEGER NOT NULL DEFAULT 300,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "correlationId" TEXT,
    "responseStatus" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PolicyConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "maxSinglePaymentUsdc" REAL NOT NULL DEFAULT 50000,
    "dailyBudgetUsd" REAL NOT NULL DEFAULT 500000,
    "hitlThresholdUsdc" REAL NOT NULL DEFAULT 0,
    "requireProofForAll" BOOLEAN NOT NULL DEFAULT true,
    "allowMockPayments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "allowX402Gateway" BOOLEAN NOT NULL DEFAULT true,
    "x402SettlementMode" TEXT NOT NULL DEFAULT 'pre-signed',
    "x402MaxAmountUsdc" TEXT NOT NULL DEFAULT '100.00',
    CONSTRAINT "PolicyConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PolicyConfig" ("allowMockPayments", "createdAt", "dailyBudgetUsd", "hitlThresholdUsdc", "id", "maxSinglePaymentUsdc", "requireProofForAll", "tenantId", "updatedAt") SELECT "allowMockPayments", "createdAt", "dailyBudgetUsd", "hitlThresholdUsdc", "id", "maxSinglePaymentUsdc", "requireProofForAll", "tenantId", "updatedAt" FROM "PolicyConfig";
DROP TABLE "PolicyConfig";
ALTER TABLE "new_PolicyConfig" RENAME TO "PolicyConfig";
CREATE UNIQUE INDEX "PolicyConfig_tenantId_key" ON "PolicyConfig"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "NonceRecord_nonce_key" ON "NonceRecord"("nonce");

-- CreateIndex
CREATE INDEX "NonceRecord_nonce_idx" ON "NonceRecord"("nonce");

-- CreateIndex
CREATE INDEX "NonceRecord_status_idx" ON "NonceRecord"("status");

-- CreateIndex
CREATE INDEX "NonceRecord_expiresAt_idx" ON "NonceRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_nonce_key" ON "PaymentRecord"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_paymentIntentId_key" ON "PaymentRecord"("paymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentRecord_resource_idx" ON "PaymentRecord"("resource");

-- CreateIndex
CREATE INDEX "PaymentRecord_payerAddress_idx" ON "PaymentRecord"("payerAddress");

-- CreateIndex
CREATE INDEX "PaymentRecord_verifiedAt_idx" ON "PaymentRecord"("verifiedAt");

-- CreateIndex
CREATE INDEX "PaymentRecord_tenantId_idx" ON "PaymentRecord"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_nonce_key" ON "PaymentIntent"("nonce");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentIntent_nonce_idx" ON "PaymentIntent"("nonce");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_resource_idx" ON "PaymentIntent"("resource");

-- CreateIndex
CREATE INDEX "PaymentIntent_createdAt_idx" ON "PaymentIntent"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentIntent_correlationId_idx" ON "PaymentIntent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "EndpointConfig_resource_key" ON "EndpointConfig"("resource");

-- CreateIndex
CREATE INDEX "EndpointConfig_resource_idx" ON "EndpointConfig"("resource");

-- CreateIndex
CREATE INDEX "EndpointConfig_tenantId_idx" ON "EndpointConfig"("tenantId");
