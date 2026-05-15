-- Rename appointment status values from CONFIRMED/DECLINED to ACCEPTED/REJECTED
-- and remove CANCELLED
-- using a safe enum recreation so existing rows are preserved.

CREATE TYPE "AppointmentStatus_tmp" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'DECLINED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED'
);

-- Drop default before altering type to avoid "cannot be cast automatically" error
ALTER TABLE "Appointment" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Appointment"
ALTER COLUMN "status" TYPE "AppointmentStatus_tmp"
USING "status"::text::"AppointmentStatus_tmp";

-- Set default back using the new type
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"AppointmentStatus_tmp";

UPDATE "Appointment"
SET "status" = 'ACCEPTED'
WHERE "status"::text = 'CONFIRMED';

UPDATE "Appointment"
SET "status" = 'REJECTED'
WHERE "status"::text = 'DECLINED' OR "status"::text = 'CANCELLED';

CREATE TYPE "AppointmentStatus_new" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED'
);

-- Drop default again for the second type change
ALTER TABLE "Appointment" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Appointment"
ALTER COLUMN "status" TYPE "AppointmentStatus_new"
USING "status"::text::"AppointmentStatus_new";

-- Set final default
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"AppointmentStatus_new";

DROP TYPE "AppointmentStatus_tmp";
DROP TYPE "AppointmentStatus";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
