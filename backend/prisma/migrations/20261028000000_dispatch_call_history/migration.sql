-- DispatchCall.assignedUnitId was UNIQUE, so a unit could be assigned to only one call in its whole life
-- (the second assignment failed with a unique violation). It is now plain history; the live link stays
-- DispatchUnit.currentCallId (unique).
DROP INDEX "DispatchCall_assignedUnitId_key";
CREATE INDEX "DispatchCall_assignedUnitId_idx" ON "DispatchCall"("assignedUnitId");
