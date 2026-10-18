require('ts-node/register');

const assert = require('node:assert/strict');
const { Client } = require('pg');
const { test } = require('node:test');
const { AuditSchemaService } = require('../src/modules/billing/audit-schema.service');

const connectionString = process.env.BILLING_TEST_DATABASE_URL;

test('PostgreSQL rejects audit updates, deletes, and truncation', {
  skip: !connectionString,
}, async () => {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE invoices (
        id uuid PRIMARY KEY,
        status character varying NOT NULL
      )
    `);
    await client.query(`
      CREATE TEMP TABLE invoice_items (
        id integer PRIMARY KEY,
        "invoiceId" uuid NOT NULL,
        amount numeric(10,2) NOT NULL
      )
    `);
    await client.query(`
      CREATE TEMP TABLE invoice_audit_logs (
        id integer PRIMARY KEY,
        snapshot jsonb NOT NULL
      )
    `);
    await new AuditSchemaService({ query: (sql) => client.query(sql) }).onApplicationBootstrap();

    const invoiceId = '11111111-1111-4111-8111-111111111111';
    await client.query('INSERT INTO invoices (id, status) VALUES ($1, $2)', [invoiceId, 'DRAFT']);
    await client.query(
      'INSERT INTO invoice_items (id, "invoiceId", amount) VALUES ($1, $2, $3)',
      [1, invoiceId, 100],
    );
    await client.query('UPDATE invoices SET status = $1 WHERE id = $2', ['ISSUED', invoiceId]);
    await assert.rejects(
      client.query('UPDATE invoice_items SET amount = $1 WHERE id = $2', [125, 1]),
      /financial items on issued or paid invoices are immutable/,
    );
    await assert.rejects(
      client.query('DELETE FROM invoice_items WHERE id = $1', [1]),
      /financial items on issued or paid invoices are immutable/,
    );

    await client.query(
      'INSERT INTO invoice_audit_logs (id, snapshot) VALUES ($1, $2)',
      [1, JSON.stringify({ status: 'ISSUED' })],
    );

    await assert.rejects(
      client.query(
        'UPDATE invoice_audit_logs SET snapshot = $1 WHERE id = $2',
        [JSON.stringify({ status: 'PAID' }), 1],
      ),
      /invoice_audit_logs is append-only/,
    );
    await assert.rejects(
      client.query('DELETE FROM invoice_audit_logs WHERE id = $1', [1]),
      /invoice_audit_logs is append-only/,
    );
    await assert.rejects(
      client.query('TRUNCATE invoice_audit_logs'),
      /invoice_audit_logs is append-only/,
    );
  } finally {
    await client.end();
  }
});
