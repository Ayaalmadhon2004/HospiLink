-- Credentials for device/gateway vitals ingestion (HL7 v2 / FHIR / JSON, MQTT via bridge).
CREATE TABLE "DeviceKey" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceKey_keyHash_key" ON "DeviceKey"("keyHash");
CREATE INDEX "DeviceKey_hospitalId_idx" ON "DeviceKey"("hospitalId");

ALTER TABLE "DeviceKey" ADD CONSTRAINT "DeviceKey_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
