import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1768365233395 implements MigrationInterface {
    name = 'Init1768365233395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD "refreshTokenHash" text
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD "refreshTokenExpiresAt" TIMESTAMP WITH TIME ZONE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "refreshTokenExpiresAt"
        `);
        await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "refreshTokenHash"
        `);
    }

}
