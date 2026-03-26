-- CreateTable
CREATE TABLE "TallyToken" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Sync Token',
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TallyToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TallyToken_tokenHash_key" ON "TallyToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TallyToken_teamId_idx" ON "TallyToken"("teamId");
