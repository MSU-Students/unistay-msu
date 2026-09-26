export type UserRole = 'student' | 'property_manager' | 'university_admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  isInstitutionalVerified?: boolean;
}

export type PropertyType = 'institutional_dorm' | 'private_boarding_house';

export interface Unit {
  id: string;
  roomNumber: string;
  capacity: number;
  occupiedCount: number;
  monthlyRent: number;
  isAvailable: boolean;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  description: string;
  address: string;
  proximityToCollege?: string;
  amenities?: string[];
  photos?: string[];
  minMonthlyRate: number;
  maxMonthlyRate: number;
  isAccredited: boolean;
  units?: Unit[];
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Application {
  id: string;
  property: Property;
  unit?: Unit;
  status: ApplicationStatus;
  remarks?: string;
  createdAt: string;
}

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
  paymentDate: string;
  offlineReferenceId?: string;
  receiptUrl?: string;
  isSynced: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenant: User;
  property: Property;
  rentAmount: number;
  electricityAmount: number;
  waterAmount: number;
  otherFees: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  utilitySplitNotes?: string;
  payments?: Payment[];
  createdAt: string;
}

export type TicketCategory = 'plumbing' | 'electrical' | 'sanitation' | 'carpentry' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  photoUrls?: string[];
  property: Property;
  unit?: Unit;
  reporter: User;
  resolutionNotes?: string;
  createdAt: string;
}

export interface OutageReport {
  id: string;
  utilityType: string;
  affectedArea: string;
  message: string;
  isActive: boolean;
  estimatedRestoration?: string;
  createdAt: string;
}

export type FacilityType = 'laundry' | 'parking' | 'study_hall' | 'recreation';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  slotCapacity: number;
  operationalHours: string;
  isActive: boolean;
}

export interface FacilityBooking {
  id: string;
  facility: Facility;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled' | 'completed';
}

export type GigStatus = 'open' | 'assigned' | 'completed' | 'cancelled';

export interface Gig {
  id: string;
  title: string;
  description: string;
  category: string;
  compensationAmount: number;
  locationNote?: string;
  status: GigStatus;
  postedBy: User;
  assignedTo?: User;
  createdAt: string;
}

export interface OfflineSyncItem {
  id?: number;
  clientMutationId: string;
  action: 'CREATE_PAYMENT' | 'CREATE_TICKET' | 'CREATE_BOOKING' | 'CREATE_GIG_APPLICATION';
  payload: Record<string, any>;
  queuedAt: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
}
