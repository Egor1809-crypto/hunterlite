ALTER TABLE "training_sessions"
ADD COLUMN "format" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN "character" TEXT NOT NULL DEFAULT 'anxious',
ADD COLUMN "question_count" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "evaluation_criteria" JSONB,
ADD COLUMN "mistakes" JSONB,
ADD COLUMN "recommendations" JSONB;
