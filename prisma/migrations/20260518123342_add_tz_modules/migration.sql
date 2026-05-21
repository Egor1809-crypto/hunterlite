-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single_choice', 'multiple_choice', 'true_false', 'matching', 'text_input', 'number_input');

-- CreateEnum
CREATE TYPE "AnswerFormat" AS ENUM ('choice', 'text_manual');

-- CreateEnum
CREATE TYPE "TargetRole" AS ENUM ('manager', 'lawyer', 'both');

-- CreateTable
CREATE TABLE "test_questions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "attachment_url" TEXT,
    "options" JSONB,
    "correct_answer" JSONB NOT NULL,
    "explanation" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "tags" TEXT[],
    "needs_update" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "intro_text" TEXT NOT NULL,
    "attachments" TEXT[],
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "tags" TEXT[],

    CONSTRAINT "case_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_steps" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer_format" "AnswerFormat" NOT NULL,
    "options" JSONB,
    "correct_option_id" TEXT,
    "keyword_rules" JSONB,
    "reference_answer" TEXT,
    "is_red_flag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "case_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objection_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "client_phrase" TEXT NOT NULL,
    "target_role" "TargetRole" NOT NULL,
    "answer_format" "AnswerFormat" NOT NULL,
    "options" JSONB,
    "correct_option_id" TEXT,
    "keyword_rules" JSONB,
    "reference_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',

    CONSTRAINT "objection_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_scripts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "client_profile" JSONB NOT NULL,
    "first_node_id" TEXT,

    CONSTRAINT "call_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_script_nodes" (
    "id" UUID NOT NULL,
    "script_id" UUID NOT NULL,
    "client_replica" TEXT NOT NULL,
    "answer_format" "AnswerFormat" NOT NULL,
    "options" JSONB,
    "keyword_rules" JSONB,
    "is_success_end" BOOLEAN NOT NULL DEFAULT false,
    "is_fail_end" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "call_script_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_programs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL,

    CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_questions_organization_id_idx" ON "test_questions"("organization_id");

-- CreateIndex
CREATE INDEX "case_templates_organization_id_idx" ON "case_templates"("organization_id");

-- CreateIndex
CREATE INDEX "case_steps_case_id_idx" ON "case_steps"("case_id");

-- CreateIndex
CREATE INDEX "objection_templates_organization_id_idx" ON "objection_templates"("organization_id");

-- CreateIndex
CREATE INDEX "call_scripts_organization_id_idx" ON "call_scripts"("organization_id");

-- CreateIndex
CREATE INDEX "call_script_nodes_script_id_idx" ON "call_script_nodes"("script_id");

-- CreateIndex
CREATE INDEX "training_programs_organization_id_idx" ON "training_programs"("organization_id");

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_templates" ADD CONSTRAINT "case_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_steps" ADD CONSTRAINT "case_steps_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "case_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objection_templates" ADD CONSTRAINT "objection_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_scripts" ADD CONSTRAINT "call_scripts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_script_nodes" ADD CONSTRAINT "call_script_nodes_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "call_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
