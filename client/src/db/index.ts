import Dexie, { Table } from 'dexie';
import {
  Property,
  Invoice,
  MaintenanceTicket,
  FacilityBooking,
  Gig,
  OfflineSyncItem,
  User,
} from '../types';

export class UniStayDexieDb extends Dexie {
  properties!: Table<Property, string>;
  invoices!: Table<Invoice, string>;
  tickets!: Table<MaintenanceTicket, string>;
  bookings!: Table<FacilityBooking, string>;
  gigs!: Table<Gig, string>;
  syncQueue!: Table<OfflineSyncItem, number>;
  cachedProfile!: Table<{ key: string; user: User; token: string }, string>;

  constructor() {
    super('UniStayMSUDatabase');
    this.version(1).stores({
      properties: 'id, name, type, minMonthlyRate, isAccredited',
      invoices: 'id, invoiceNumber, status, dueDate',
      tickets: 'id, category, priority, status, createdAt',
      bookings: 'id, status, startTime',
      gigs: 'id, category, status, createdAt',
      syncQueue: '++id, clientMutationId, action, status, queuedAt',
      cachedProfile: 'key',
    });
  }
}

export const db = new UniStayDexieDb();
