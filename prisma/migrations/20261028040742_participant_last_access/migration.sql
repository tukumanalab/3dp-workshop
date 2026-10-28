-- AlterTable
ALTER TABLE "Participant" ADD COLUMN "lastAccessAt" DATETIME;

-- 既存の参加者は、作品を最後に保存した日時を最終アクセスとみなす（作品が無ければ記録なし）
UPDATE "Participant" SET "lastAccessAt" = (SELECT MAX("updatedAt") FROM "Project" WHERE "participantId" = "Participant"."id");
