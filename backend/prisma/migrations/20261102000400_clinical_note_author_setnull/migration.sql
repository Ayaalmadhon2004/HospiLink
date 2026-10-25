-- Found by the integration suite: "ClinicalNote.authorId ... ON DELETE SET NULL" is executed by PostgreSQL as an UPDATE
-- of the note, which the immutability trigger rejected, so a user who had written a note could not be deleted.
-- The trigger now lets exactly that change through (authorId: some value -> NULL, every other column untouched) and still
-- refuses every other UPDATE and every DELETE.
CREATE OR REPLACE FUNCTION prevent_clinical_note_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."authorId" IS NOT NULL AND NEW."authorId" IS NULL
     AND (to_jsonb(NEW) - 'authorId') = (to_jsonb(OLD) - 'authorId') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'ClinicalNote rows are immutable: add an amendment instead (id=%)', OLD."id"
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
