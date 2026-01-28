-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "projectName" VARCHAR(100) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "client" VARCHAR(100) NOT NULL,
    "architects" VARCHAR(100) NOT NULL,
    "website" VARCHAR(100) NOT NULL,
    "facebookLink" VARCHAR(100),
    "instagramLink" VARCHAR(100),
    "linkedinLink" VARCHAR(100),
    "xLink" VARCHAR(100),
    "projectType" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) DEFAULT '',
    "material" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
