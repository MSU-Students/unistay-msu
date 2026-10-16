import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHousingApplicationMonitoring1760635200000 implements MigrationInterface {
  name = 'AddHousingApplicationMonitoring1760635200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "applications"
        ADD COLUMN IF NOT EXISTS "statusHistory" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "policyException" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "policyExceptionReason" text,
        ADD COLUMN IF NOT EXISTS "escalated" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "escalationReason" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "applications"
        DROP COLUMN IF EXISTS "escalationReason",
        DROP COLUMN IF EXISTS "escalated",
        DROP COLUMN IF EXISTS "policyExceptionReason",
        DROP COLUMN IF EXISTS "policyException",
        DROP COLUMN IF EXISTS "statusHistory"
    `);
  }
}
