require('ts-node/register');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BadRequestException, ConflictException } = require('@nestjs/common');
const { Role } = require('../src/common/enums/role.enum');
const { User } = require('../src/modules/users/entities/user.entity');
const { Property, Unit } = require('../src/modules/housing/entities/property.entity');
const { Lease } = require('../src/modules/housing/entities/application.entity');
const { calculateInvoiceTotals } = require('../src/modules/billing/billing.calculation');
const { BillingService } = require('../src/modules/billing/billing.service');
const {
  Invoice,
  InvoiceAuditAction,
  InvoiceItem,
  InvoiceStatus,
} = require('../src/modules/billing/entities/invoice.entity');

test('invoice totals round to cents and validate all amounts', () => {
  assert.deepEqual(
    calculateInvoiceTotals(
      [{ amount: 1200 }, { amount: 25.5 }, { amount: 10.25 }],
      12.35,
    ),
    { subtotal: 1235.75, tax: 12.35, totalAmount: 1248.1 },
  );
  assert.throws(() => calculateInvoiceTotals([{ amount: -1 }], 0), BadRequestException);
  assert.throws(() => calculateInvoiceTotals([{ amount: 1 }], Number.NaN), BadRequestException);
});

function makeBillingService({
  duplicate = null,
  failAudit = false,
  existingInvoice = null,
  voidedInvoice = null,
} = {}) {
  const actor = { id: 'manager-id', role: Role.PROPERTY_MANAGER };
  const property = { id: 'property-id', manager: actor };
  const tenant = { id: 'tenant-id', role: Role.STUDENT, isActive: true };
  const propertyQuery = {
    where() { return this; },
    setLock() { return this; },
    async getOne() { return { id: property.id }; },
  };
  const propertyRepository = {
    createQueryBuilder() { return propertyQuery; },
    async findOne() { return property; },
  };
  const userRepository = { async findOne() { return tenant; } };
  const invoiceQuery = {
    where() { return this; },
    setLock() { return this; },
    async getOne() { return existingInvoice ? { id: existingInvoice.id } : null; },
  };
  let saveCount = 0;
  let auditCallCount = 0;
  let lastAuditAction;
  let lastAuditMetadata;
  const invoiceRepository = {
    createQueryBuilder() { return invoiceQuery; },
    async findOne(options) {
      if (options.where.status === InvoiceStatus.VOIDED) return voidedInvoice;
      return existingInvoice || duplicate;
    },
    async count() { return 0; },
    create(invoice) { return invoice; },
    async save(invoice) {
      saveCount += 1;
      invoice.id ||= 'generated-invoice-id';
      invoice.createdAt = new Date('2026-10-01T00:00:00Z');
      invoice.updatedAt = invoice.createdAt;
      return invoice;
    },
  };
  const itemRepository = { create(item) { return item; } };
  const repositories = new Map([
    [Property, propertyRepository],
    [Unit, {}],
    [User, userRepository],
    [Lease, {}],
    [Invoice, invoiceRepository],
    [InvoiceItem, itemRepository],
  ]);
  const manager = { getRepository(entity) { return repositories.get(entity); } };
  const runner = {
    manager,
    isTransactionActive: true,
    connected: false,
    committed: false,
    rolledBack: false,
    async connect() { this.connected = true; },
    async startTransaction() {},
    async commitTransaction() { this.committed = true; },
    async rollbackTransaction() { this.rolledBack = true; },
    async release() {},
  };
  const dataSource = { createQueryRunner() { return runner; } };
  const auditService = {
    async logAction(_manager, _invoice, action, _actor, metadata) {
      auditCallCount += 1;
      lastAuditAction = action;
      lastAuditMetadata = metadata;
      if (failAudit) throw new Error('audit storage unavailable');
    },
  };
  return {
    actor,
    property,
    runner,
    invoiceRepository,
    auditService,
    get saveCount() { return saveCount; },
    get auditCallCount() { return auditCallCount; },
    get lastAuditAction() { return lastAuditAction; },
    get lastAuditMetadata() { return lastAuditMetadata; },
    billingService: new BillingService(dataSource, auditService, {}, {}),
  };
}

const billingPeriod = {
  tenantId: 'tenant-id',
  billingPeriodStart: '2026-10-01',
  billingPeriodEnd: '2026-10-31',
  dueDate: '2026-10-15',
  rentAmount: 1200,
};

test('duplicate generation rejects and rolls back without creating an audit record', async () => {
  const setup = makeBillingService({
    duplicate: { id: 'existing-invoice' },
  });
  await assert.rejects(
    setup.billingService.generateInvoice(setup.property.id, billingPeriod, setup.actor),
    ConflictException,
  );
  assert.equal(setup.runner.rolledBack, true);
  assert.equal(setup.runner.committed, false);
  assert.equal(setup.runner.connected, true);
  assert.equal(setup.auditCallCount, 0);
});

test('invoice generation commits with an issued invoice and generated audit event', async () => {
  const setup = makeBillingService();
  const invoice = await setup.billingService.generateInvoice(
    setup.property.id,
    billingPeriod,
    setup.actor,
  );
  assert.equal(setup.runner.committed, true);
  assert.equal(setup.runner.rolledBack, false);
  assert.equal(setup.auditCallCount, 1);
  assert.equal(setup.lastAuditAction, 'GENERATED');
  assert.equal(invoice.status, 'ISSUED');
  assert.equal(invoice.subtotal, 1200);
  assert.equal(invoice.totalAmount, 1200);
  assert.match(invoice.invoiceNumber, /^INV-202610-PROP.+-001$/);
});

test('re-issuing a voided billing period requires and audits a reason', async () => {
  const setup = makeBillingService({
    voidedInvoice: { id: 'voided-invoice' },
  });
  await assert.rejects(
    setup.billingService.generateInvoice(setup.property.id, billingPeriod, setup.actor),
    BadRequestException,
  );
  assert.equal(setup.runner.rolledBack, true);

  const reissue = makeBillingService({
    voidedInvoice: { id: 'voided-invoice' },
  });
  const invoice = await reissue.billingService.generateInvoice(
    reissue.property.id,
    { ...billingPeriod, notes: 'Corrected utility amount' },
    reissue.actor,
  );
  assert.equal(invoice.status, InvoiceStatus.ISSUED);
  assert.equal(reissue.lastAuditMetadata.notes, 'Corrected utility amount');
  assert.equal(reissue.runner.committed, true);
});

test('status changes and actor notes commit with an audit entry', async () => {
  const existingInvoice = {
    id: 'existing-invoice',
    invoiceNumber: 'INV-202610-PROP001-001',
    property: { id: 'property-id', manager: { id: 'manager-id' } },
    tenant: { id: 'tenant-id' },
    status: InvoiceStatus.ISSUED,
    items: [],
  };
  const setup = makeBillingService({ existingInvoice });
  const updated = await setup.billingService.updateStatus(
    existingInvoice.id,
    { status: InvoiceStatus.OVERDUE, notes: 'Payment not received by due date' },
    setup.actor,
    { ipAddress: '192.0.2.10', userAgent: 'billing-test' },
  );

  assert.equal(updated.status, InvoiceStatus.OVERDUE);
  assert.equal(setup.runner.committed, true);
  assert.equal(setup.auditCallCount, 1);
  assert.equal(setup.lastAuditAction, InvoiceAuditAction.STATUS_UPDATED);
  assert.equal(setup.lastAuditMetadata.notes, 'Payment not received by due date');
  assert.equal(setup.lastAuditMetadata.ipAddress, '192.0.2.10');
});

test('invoice creation rolls back when audit persistence fails', async () => {
  const setup = makeBillingService({
    failAudit: true,
  });
  await assert.rejects(
    setup.billingService.generateInvoice(setup.property.id, billingPeriod, setup.actor),
    /audit storage unavailable/,
  );
  assert.equal(setup.saveCount, 2);
  assert.equal(setup.runner.rolledBack, true);
  assert.equal(setup.runner.committed, false);
});
