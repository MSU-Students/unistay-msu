import type { ApplicationStatus, ManagerApplication } from '../types';

function createProperty(id: string, name: string, address: string): ManagerApplication['property'] {
  return {
    id,
    name,
    type: 'institutional_dorm',
    description: `Student accommodation at ${name}.`,
    address,
    minMonthlyRate: 4500,
    maxMonthlyRate: 6500,
    isAccredited: true,
  };
}

const applications: ManagerApplication[] = [
  {
    id: 'demo-app-1001',
    applicant: {
      id: 'demo-student-1',
      fullName: 'Amina Macarambon',
      email: 'amina.macarambon@example.edu',
      role: 'student',
      isInstitutionalVerified: true,
    },
    property: createProperty('demo-property-1', 'Marawi Student Residence', 'MSU Main Campus, Marawi City'),
    status: 'pending',
    remarks: 'I am looking for accommodation near the College of Science and Mathematics.',
    createdAt: '2026-10-14T09:30:00.000Z',
    supportingDocuments: [
      {
        id: 'demo-doc-1',
        name: 'Student ID',
        description: 'MSU student identification (sample preview)',
        mockContent: 'DEMO DOCUMENT\nStudent ID\nName: Amina Macarambon\nThis is sample review data, not an official document.',
      },
      {
        id: 'demo-doc-2',
        name: 'Proof of enrollment',
        description: 'Current semester enrollment (sample preview)',
        mockContent: 'DEMO DOCUMENT\nProof of Enrollment\nName: Amina Macarambon\nThis is sample review data, not an official document.',
      },
    ],
  },
  {
    id: 'demo-app-1002',
    applicant: {
      id: 'demo-student-2',
      fullName: 'Farhan Usman',
      email: 'farhan.usman@example.edu',
      role: 'student',
      isInstitutionalVerified: true,
    },
    property: createProperty('demo-property-2', 'Lakeview Dormitory', 'Basak, Marawi City'),
    status: 'pending',
    remarks: 'Please consider my application for a shared room.',
    createdAt: '2026-10-12T14:15:00.000Z',
    supportingDocuments: [
      {
        id: 'demo-doc-3',
        name: 'Student ID',
        description: 'MSU student identification (sample preview)',
        mockContent: 'DEMO DOCUMENT\nStudent ID\nName: Farhan Usman\nThis is sample review data, not an official document.',
      },
    ],
  },
  {
    id: 'demo-app-1003',
    applicant: {
      id: 'demo-student-3',
      fullName: 'Nuraina Maruhom',
      email: 'nuraina.maruhom@example.edu',
      role: 'student',
      isInstitutionalVerified: true,
    },
    property: createProperty('demo-property-1', 'Marawi Student Residence', 'MSU Main Campus, Marawi City'),
    status: 'approved',
    remarks: 'I would prefer a room close to campus facilities.',
    createdAt: '2026-10-09T08:00:00.000Z',
    supportingDocuments: [],
  },
  {
    id: 'demo-app-1004',
    applicant: {
      id: 'demo-student-4',
      fullName: 'Ismail Amai',
      email: 'ismail.amai@example.edu',
      role: 'student',
      isInstitutionalVerified: true,
    },
    property: createProperty('demo-property-2', 'Lakeview Dormitory', 'Basak, Marawi City'),
    status: 'rejected',
    remarks: 'I am applying for the upcoming semester.',
    createdAt: '2026-10-06T11:45:00.000Z',
    supportingDocuments: [],
  },
];

function findApplication(id: string): ManagerApplication {
  const application = applications.find((item) => item.id === id);
  if (!application) {
    throw new Error('Application not found in the demo review data.');
  }
  return application;
}

function copyApplication(application: ManagerApplication): ManagerApplication {
  return {
    ...application,
    applicant: { ...application.applicant },
    property: { ...application.property },
    unit: application.unit ? { ...application.unit } : undefined,
    supportingDocuments: application.supportingDocuments.map((document) => ({ ...document })),
  };
}

export async function fetchManagerApplications(): Promise<ManagerApplication[]> {
  return applications.map(copyApplication);
}

export async function setApplicationStatus(
  id: string,
  status: Extract<ApplicationStatus, 'approved' | 'rejected'>,
): Promise<ManagerApplication> {
  const application = findApplication(id);
  application.status = status;
  return copyApplication(application);
}

export async function saveInternalReviewNotes(
  id: string,
  notes: string,
): Promise<ManagerApplication> {
  const application = findApplication(id);
  application.internalReviewNotes = notes;
  return copyApplication(application);
}

export async function requestMoreInformation(
  id: string,
  message: string,
): Promise<ManagerApplication> {
  const application = findApplication(id);
  application.informationRequest = message;
  return copyApplication(application);
}
