import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditableBilling1760720000000 implements MigrationInterface {
  name = 'AddAuditableBilling1760720000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "leaseId" uuid,
        ADD COLUMN IF NOT EXISTS "billingPeriodStart" date,
        ADD COLUMN IF NOT EXISTS "billingPeriodEnd" date,
        ADD COLUMN IF NOT EXISTS "subtotal" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tax" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "createdById" uuid
    `);
    await queryRunner.query(`
      UPDATE "invoices"
      SET "billingPeriodStart" = date_trunc('month', "createdAt")::date,
          "billingPeriodEnd" = (date_trunc('month', "createdAt") + interval '1 month - 1 day')::date,
          "subtotal" = COALESCE("rentAmount", 0) + COALESCE("electricityAmount", 0)
            + COALESCE("waterAmount", 0) + COALESCE("otherFees", 0)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoices_status_enum')
          AND EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'invoices_status_enum' AND e.enumlabel = 'unpaid'
          ) THEN
            ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;
            ALTER TYPE "invoices_status_enum" RENAME TO "invoices_status_enum_legacy";
            CREATE TYPE "invoices_status_enum" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOIDED');
            ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "invoices_status_enum"
              USING (CASE "status"::text
                WHEN 'paid' THEN 'PAID'
                WHEN 'overdue' THEN 'OVERDUE'
                WHEN 'unpaid' THEN 'ISSUED'
                WHEN 'partially_paid' THEN 'ISSUED'
                ELSE 'ISSUED'
              END)::"invoices_status_enum";
            DROP TYPE "invoices_status_enum_legacy";
            ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      UPDATE "invoices" SET "totalAmount" = "subtotal" + "tax"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_lease') THEN
          ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_lease"
            FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_created_by') THEN
          ALTER TABLE "invoices" ADD CONSTRAINT "fk_invoices_created_by"
            FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoice_property_tenant_period"
        ON "invoices" ("propertyId", "tenantId", "billingPeriodStart", "billingPeriodEnd")
        WHERE "createdById" IS NOT NULL AND "status" <> 'VOIDED'
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_items_category_enum') THEN
          CREATE TYPE "invoice_items_category_enum" AS ENUM ('RENT', 'UTILITY', 'PARKING', 'LATE_FEE');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_audit_logs_action_enum') THEN
          CREATE TYPE "invoice_audit_logs_action_enum"
            AS ENUM ('GENERATED', 'ISSUED', 'STATUS_UPDATED', 'ITEM_ADDED', 'VOIDED');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_audit_logs_actortype_enum') THEN
          CREATE TYPE "invoice_audit_logs_actortype_enum"
            AS ENUM ('PROPERTY_MANAGER', 'UNIVERSITY_ADMIN', 'TENANT', 'SYSTEM_CRON');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_property_id" ON "invoices" ("propertyId");
      CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_id" ON "invoices" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_invoices_created_at" ON "invoices" ("createdAt")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "description" character varying NOT NULL,
        "category" "invoice_items_category_enum" NOT NULL,
        "amount" numeric(10,2) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE RESTRICT,
        "action" "invoice_audit_logs_action_enum" NOT NULL,
        "actor_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "actorType" "invoice_audit_logs_actortype_enum" NOT NULL,
        "snapshot" jsonb NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      INSERT INTO "invoice_items" ("invoiceId", "description", "category", "amount")
      SELECT invoice."id", charge.description, charge.category, charge.amount
      FROM "invoices" invoice
      CROSS JOIN LATERAL (VALUES
        ('Rent', 'RENT', COALESCE(invoice."rentAmount", 0)),
        ('Electricity', 'UTILITY', COALESCE(invoice."electricityAmount", 0)),
        ('Water', 'UTILITY', COALESCE(invoice."waterAmount", 0)),
        ('Other fees', 'PARKING', COALESCE(invoice."otherFees", 0))
      ) AS charge(description, category, amount)
      WHERE charge.amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM "invoice_items" existing WHERE existing."invoiceId" = invoice."id"
        )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoice_items_invoice_id" ON "invoice_items" ("invoiceId");
      CREATE INDEX IF NOT EXISTS "idx_invoice_audit_logs_invoice_created"
        ON "invoice_audit_logs" ("invoiceId", "createdAt");
      CREATE INDEX IF NOT EXISTS "idx_invoice_audit_logs_created_at"
        ON "invoice_audit_logs" ("createdAt")
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_audit_log_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'invoice_audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query('DROP TRIGGER IF EXISTS "trg_invoice_audit_logs_immutable" ON "invoice_audit_logs"');
    await queryRunner.query(`
      CREATE TRIGGER "trg_invoice_audit_logs_immutable"
        BEFORE UPDATE OR DELETE ON "invoice_audit_logs"
        FOR EACH ROW EXECUTE FUNCTION prevent_invoice_audit_log_mutation()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_invoice_audit_logs_no_truncate"
        BEFORE TRUNCATE ON "invoice_audit_logs"
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_invoice_audit_log_mutation()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_issued_invoice_item_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF EXISTS (
            SELECT 1 FROM "invoices"
            WHERE "id" = NEW."invoiceId" AND "status"::text IN ('ISSUED', 'PAID')
          ) THEN
            RAISE EXCEPTION 'financial items on issued or paid invoices are immutable';
          END IF;
        ELSIF TG_OP = 'UPDATE' THEN
          IF EXISTS (
            SELECT 1 FROM "invoices"
            WHERE "id" IN (OLD."invoiceId", NEW."invoiceId")
              AND "status"::text IN ('ISSUED', 'PAID')
          ) THEN
            RAISE EXCEPTION 'financial items on issued or paid invoices are immutable';
          END IF;
        ELSIF EXISTS (
          SELECT 1 FROM "invoices"
          WHERE "id" = OLD."invoiceId" AND "status"::text IN ('ISSUED', 'PAID')
        ) THEN
          RAISE EXCEPTION 'financial items on issued or paid invoices are immutable';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query('DROP TRIGGER IF EXISTS "trg_invoice_items_immutable" ON "invoice_items"');
    await queryRunner.query(`
      CREATE TRIGGER "trg_invoice_items_immutable"
        BEFORE INSERT OR UPDATE OR DELETE ON "invoice_items"
        FOR EACH ROW EXECUTE FUNCTION prevent_issued_invoice_item_mutation()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_item_truncate()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'invoice items cannot be truncated';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_invoice_items_no_truncate"
        BEFORE TRUNCATE ON "invoice_items"
        FOR EACH STATEMENT EXECUTE FUNCTION prevent_invoice_item_truncate()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS "trg_invoice_audit_logs_immutable" ON "invoice_audit_logs"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "trg_invoice_audit_logs_no_truncate" ON "invoice_audit_logs"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "trg_invoice_items_immutable" ON "invoice_items"');
    await queryRunner.query('DROP TRIGGER IF EXISTS "trg_invoice_items_no_truncate" ON "invoice_items"');
    await queryRunner.query('DROP FUNCTION IF EXISTS prevent_invoice_audit_log_mutation()');
    await queryRunner.query('DROP FUNCTION IF EXISTS prevent_issued_invoice_item_mutation()');
    await queryRunner.query('DROP FUNCTION IF EXISTS prevent_invoice_item_truncate()');
    await queryRunner.query('DROP TABLE IF EXISTS "invoice_audit_logs"');
    await queryRunner.query('DROP TABLE IF EXISTS "invoice_items"');
    await queryRunner.query('DROP TYPE IF EXISTS "invoice_audit_logs_actortype_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "invoice_audit_logs_action_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "invoice_items_category_enum"');
    await queryRunner.query('DROP INDEX IF EXISTS "uq_invoice_property_tenant_period"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_invoices_property_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_invoices_tenant_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_invoices_created_at"');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoices_status_enum')
          AND NOT EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'invoices_status_enum' AND e.enumlabel = 'unpaid'
          ) THEN
            ALTER TABLE "invoices" ALTER COLUMN "status" DROP DEFAULT;
            ALTER TYPE "invoices_status_enum" RENAME TO "invoices_status_enum_auditable";
            CREATE TYPE "invoices_status_enum" AS ENUM ('unpaid', 'partially_paid', 'paid', 'overdue');
            ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "invoices_status_enum"
              USING (CASE "status"::text
                WHEN 'PAID' THEN 'paid'
                WHEN 'OVERDUE' THEN 'overdue'
                ELSE 'unpaid'
              END)::"invoices_status_enum";
            DROP TYPE "invoices_status_enum_auditable";
            ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'unpaid';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP CONSTRAINT IF EXISTS "fk_invoices_lease",
        DROP CONSTRAINT IF EXISTS "fk_invoices_created_by",
        DROP COLUMN IF EXISTS "leaseId",
        DROP COLUMN IF EXISTS "billingPeriodStart",
        DROP COLUMN IF EXISTS "billingPeriodEnd",
        DROP COLUMN IF EXISTS "subtotal",
        DROP COLUMN IF EXISTS "tax",
        DROP COLUMN IF EXISTS "createdById"
    `);
  }
}
