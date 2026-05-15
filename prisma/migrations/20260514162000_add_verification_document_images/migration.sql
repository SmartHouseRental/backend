ALTER TABLE "VerificationDocument" ADD COLUMN IF NOT EXISTS "frontUrl" TEXT;
ALTER TABLE "VerificationDocument" ADD COLUMN IF NOT EXISTS "backUrl" TEXT;
ALTER TABLE "VerificationDocument" ADD COLUMN IF NOT EXISTS "livePhotoUrl" TEXT;
