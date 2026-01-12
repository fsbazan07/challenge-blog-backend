import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1768228098818 implements MigrationInterface {
    name = 'Init1768228098818'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "posts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "title" text NOT NULL,
                "excerpt" text,
                "content" text NOT NULL,
                "tags" text array NOT NULL DEFAULT '{}',
                "coverUrl" text,
                "status" text NOT NULL DEFAULT 'published',
                "authorId" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_2d82eb2bb2ddd7a6bfac8804d8" ON "posts" ("title")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a69d9e2ae78ef7d100f8317ae0" ON "posts" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_c5a322ad12a7bf95460c958e80" ON "posts" ("authorId")
        `);
        await queryRunner.query(`
            ALTER TABLE "posts"
            ADD CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "posts" DROP CONSTRAINT "FK_c5a322ad12a7bf95460c958e80e"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_c5a322ad12a7bf95460c958e80"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a69d9e2ae78ef7d100f8317ae0"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_2d82eb2bb2ddd7a6bfac8804d8"
        `);
        await queryRunner.query(`
            DROP TABLE "posts"
        `);
    }

}
