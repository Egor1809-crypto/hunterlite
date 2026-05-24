-- CreateTable
CREATE TABLE "telegram_phone_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_phone_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_phone_links_phone_key" ON "telegram_phone_links"("phone");

-- CreateIndex
CREATE INDEX "telegram_phone_links_chat_id_idx" ON "telegram_phone_links"("chat_id");
