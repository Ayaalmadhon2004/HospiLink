-- DispatchUnit.location (JSON-ish text) -> lat/lng floats; DispatchUnit.crew (text[] of names) -> Staff.dispatchUnitId.

ALTER TABLE "DispatchUnit" ADD COLUMN "lat" DOUBLE PRECISION, ADD COLUMN "lng" DOUBLE PRECISION;
ALTER TABLE "Staff" ADD COLUMN "dispatchUnitId" TEXT;
CREATE INDEX "Staff_dispatchUnitId_idx" ON "Staff"("dispatchUnitId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_dispatchUnitId_fkey"
  FOREIGN KEY ("dispatchUnitId") REFERENCES "DispatchUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
  u RECORD;
  j jsonb;
  la double precision;
  ln double precision;
  crew_name text;
  matched integer;
  lost_crew integer := 0;
  lost_loc integer := 0;
BEGIN
  FOR u IN SELECT "id", "hospitalId", "location", "crew" FROM "DispatchUnit" LOOP
    -- Location: the app stored JSON.stringify({lat,lng}) or JSON.stringify("free text"). Only the first is coordinates.
    IF u."location" IS NOT NULL THEN
      BEGIN
        j := u."location"::jsonb;
        IF jsonb_typeof(j) = 'object' AND jsonb_typeof(j->'lat') = 'number' AND jsonb_typeof(j->'lng') = 'number' THEN
          la := (j->>'lat')::double precision;
          ln := (j->>'lng')::double precision;
          IF la BETWEEN -90 AND 90 AND ln BETWEEN -180 AND 180 THEN
            UPDATE "DispatchUnit" SET "lat" = la, "lng" = ln WHERE "id" = u."id";
          ELSE
            lost_loc := lost_loc + 1;
          END IF;
        ELSE
          lost_loc := lost_loc + 1;
        END IF;
      EXCEPTION WHEN others THEN
        lost_loc := lost_loc + 1; -- not JSON (free text): no coordinates to keep
      END;
    END IF;

    -- Crew: link names that match exactly one Staff of the same hospital (case-insensitive) and not yet crewing a unit.
    FOREACH crew_name IN ARRAY COALESCE(u."crew", ARRAY[]::text[]) LOOP
      UPDATE "Staff" s SET "dispatchUnitId" = u."id"
      WHERE s."hospitalId" = u."hospitalId" AND lower(btrim(s."name")) = lower(btrim(crew_name))
        AND s."dispatchUnitId" IS NULL
        AND (SELECT count(*) FROM "Staff" x WHERE x."hospitalId" = u."hospitalId" AND lower(btrim(x."name")) = lower(btrim(crew_name))) = 1;
      GET DIAGNOSTICS matched = ROW_COUNT;
      IF matched = 0 THEN lost_crew := lost_crew + 1; END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'dispatch migration: % location value(s) without coordinates and % crew name(s) without a unique Staff match were dropped', lost_loc, lost_crew;
END $$;

ALTER TABLE "DispatchUnit" DROP COLUMN "location", DROP COLUMN "crew";
