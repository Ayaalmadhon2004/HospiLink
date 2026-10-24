-- VitalThresholds had no hospital: one global table shared by every hospital. Now per hospital.
-- Existing rows are copied to EVERY hospital (so nobody loses the thresholds they had), then the global rows are removed.
ALTER TABLE "VitalThresholds" ADD COLUMN "hospitalId" TEXT;

-- Must go before the copy below: the old (department, vitalType) unique key would reject the per-hospital copies.
DROP INDEX "VitalThresholds_department_vitalType_key";

INSERT INTO "VitalThresholds" ("id", "hospitalId", "department", "vitalType", "minNormal", "maxNormal", "minCritical", "maxCritical", "alertEnabled", "autoNotify")
SELECT gen_random_uuid()::text, h."id", t."department", t."vitalType", t."minNormal", t."maxNormal", t."minCritical", t."maxCritical", t."alertEnabled", t."autoNotify"
FROM "VitalThresholds" t CROSS JOIN "Hospital" h
WHERE t."hospitalId" IS NULL;

DELETE FROM "VitalThresholds" WHERE "hospitalId" IS NULL;

ALTER TABLE "VitalThresholds" ALTER COLUMN "hospitalId" SET NOT NULL;

CREATE UNIQUE INDEX "VitalThresholds_hospitalId_department_vitalType_key" ON "VitalThresholds"("hospitalId", "department", "vitalType");
CREATE INDEX "VitalThresholds_hospitalId_idx" ON "VitalThresholds"("hospitalId");

ALTER TABLE "VitalThresholds" ADD CONSTRAINT "VitalThresholds_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
