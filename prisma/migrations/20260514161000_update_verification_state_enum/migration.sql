ALTER TYPE "VerificationState" RENAME TO "VerificationState_old";

CREATE TYPE "VerificationState" AS ENUM ('verified', 'pending', 'rejected', 'resubmit');

ALTER TABLE "User" ALTER COLUMN "verificationState" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "verificationState" TYPE "VerificationState"
  USING (
    CASE
      WHEN "verificationState"::text IN ('pending_otp', 'pending_documents') THEN 'pending'
      ELSE "verificationState"::text
    END
  )::"VerificationState";

ALTER TABLE "User" ALTER COLUMN "verificationState" SET DEFAULT 'pending';

DROP TYPE "VerificationState_old";