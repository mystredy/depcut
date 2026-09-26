-- CreateTable
CREATE TABLE "BlogSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "theme" TEXT NOT NULL DEFAULT 'glass',

    CONSTRAINT "BlogSettings_pkey" PRIMARY KEY ("id")
);
