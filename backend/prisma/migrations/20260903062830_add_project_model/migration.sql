/*
  Warnings:

  - You are about to drop the column `blocks` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `jsonConfig` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `template` on the `Project` table. All the data in the column will be lost.
  - Made the column `prompt` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "blocks",
DROP COLUMN "jsonConfig",
DROP COLUMN "template",
ADD COLUMN     "files" JSONB,
ADD COLUMN     "framework" TEXT NOT NULL DEFAULT 'nextjs',
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "zipUrl" TEXT,
ALTER COLUMN "prompt" SET NOT NULL;
