ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";

CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending');

ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "status" TYPE "UserStatus"
  USING (
    CASE
      WHEN "status"::text = 'banned' THEN 'suspended'
      ELSE "status"::text
    END
  )::"UserStatus";

ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'active';

DROP TYPE "UserStatus_old";