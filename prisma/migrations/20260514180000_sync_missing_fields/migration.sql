-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN "preferredCurrency" TEXT DEFAULT 'ETB';
ALTER TABLE "UserPreference" ADD COLUMN "furnishStatus" TEXT;

-- Drop and recreate preferredLocations to change type from TEXT[] to JSONB
ALTER TABLE "UserPreference" DROP COLUMN "preferredLocations";
ALTER TABLE "UserPreference" ADD COLUMN "preferredLocations" JSONB;
