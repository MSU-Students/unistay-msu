import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditSchemaService implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_audit_log_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'invoice_audit_logs is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_invoice_audit_logs_immutable'
            AND tgrelid = '"invoice_audit_logs"'::regclass
        ) THEN
          CREATE TRIGGER "trg_invoice_audit_logs_immutable"
            BEFORE UPDATE OR DELETE ON "invoice_audit_logs"
            FOR EACH ROW EXECUTE FUNCTION prevent_invoice_audit_log_mutation();
        END IF;
      END $$;
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_invoice_audit_logs_no_truncate'
            AND tgrelid = '"invoice_audit_logs"'::regclass
        ) THEN
          CREATE TRIGGER "trg_invoice_audit_logs_no_truncate"
            BEFORE TRUNCATE ON "invoice_audit_logs"
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_invoice_audit_log_mutation();
        END IF;
      END $$;
    `);
    await this.dataSource.query(`
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
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_invoice_items_immutable'
            AND tgrelid = '"invoice_items"'::regclass
        ) THEN
          CREATE TRIGGER "trg_invoice_items_immutable"
            BEFORE INSERT OR UPDATE OR DELETE ON "invoice_items"
            FOR EACH ROW EXECUTE FUNCTION prevent_issued_invoice_item_mutation();
        END IF;
      END $$;
    `);
    await this.dataSource.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_item_truncate()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'invoice items cannot be truncated';
      END;
      $$ LANGUAGE plpgsql
    `);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger
          WHERE tgname = 'trg_invoice_items_no_truncate'
            AND tgrelid = '"invoice_items"'::regclass
        ) THEN
          CREATE TRIGGER "trg_invoice_items_no_truncate"
            BEFORE TRUNCATE ON "invoice_items"
            FOR EACH STATEMENT EXECUTE FUNCTION prevent_invoice_item_truncate();
        END IF;
      END $$;
    `);
  }
}
