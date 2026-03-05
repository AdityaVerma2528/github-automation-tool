/*
  Warnings:

  - You are about to drop the column `actionBody` on the `Action` table. All the data in the column will be lost.
  - Added the required column `actionConfig` to the `Action` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventAction` to the `Trigger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventName` to the `Trigger` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `ZapRun` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Action" DROP COLUMN "actionBody",
ADD COLUMN     "actionConfig" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Trigger" ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "eventAction" TEXT NOT NULL,
ADD COLUMN     "eventName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ZapRun" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "status" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
