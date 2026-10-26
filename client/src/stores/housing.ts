import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  Application,
  ApplicationStatus,
  HousingApplicationReport,
  HousingApplicationReportFilters,
  HousingApplicationReportItem,
  Property,
  StudentResidence,
} from '../types';
import apiClient from '../api/client';
import { db } from '../db';

export const useHousingStore = defineStore('housing', () => {
  const properties = ref<Property[]>([]);
  const applications = ref<Application[]>([]);
  const residence = ref<StudentResidence | null>(null);
  const loading = ref<boolean>(false);
  const applicationsLoading = ref<boolean>(false);
  const applicationsError = ref<string | null>(null);
  const adminApplicationReport = ref<HousingApplicationReport | null>(null);
  const adminReportLoading = ref<boolean>(false);
  const adminReportError = ref<string | null>(null);
  const selectedProperty = ref<Property | null>(null);

  async function fetchProperties(filter?: { type?: string; maxPrice?: number }) {
    loading.value = true;
    try {
      const res = await apiClient.get('/housing/properties', { params: filter });
      properties.value = res.data.data;
      // Cache in Dexie for offline lookup
      await db.properties.clear();
      await db.properties.bulkPut(properties.value);
    } catch (err) {
      console.warn('[HousingStore] API unreachable, loading properties from Dexie offline cache...');
      properties.value = await db.properties.toArray();
      if (properties.value.length === 0) {
        properties.value = [
          {
            id: 'prop-1',
            name: 'MSU Alumni Dormitory',
            type: 'institutional_dorm',
            address: '4th Street, MSU Main Campus',
            minMonthlyRate: 1500,
            maxMonthlyRate: 2500,
            isAccredited: true,
            description: 'Institutional dorm near CNSM and College of Law.',
            amenities: ['Wi-Fi', 'Study Hall', 'CCTV', 'Water Tank'],
          },
          {
            id: 'prop-2',
            name: 'Khadijah Ladies Hall',
            type: 'institutional_dorm',
            address: 'Commercial Center Road, MSU Campus',
            minMonthlyRate: 1800,
            maxMonthlyRate: 2800,
            isAccredited: true,
            description: 'Institutional female residence hall near University Mosque.',
            amenities: ['24/7 Security', 'Study Area', 'Wi-Fi'],
          },
          {
            id: 'prop-3',
            name: 'Mindanao Hall Dormitory',
            type: 'institutional_dorm',
            address: 'University Heights, MSU Marawi',
            minMonthlyRate: 1400,
            maxMonthlyRate: 2200,
            isAccredited: true,
            description: 'Institutional male residence hall.',
            amenities: ['Basketball Court', 'Water Tank', 'Wi-Fi'],
          },
        ];
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchPropertyById(id: string) {
    loading.value = true;
    try {
      const res = await apiClient.get(`/housing/properties/${id}`);
      selectedProperty.value = res.data.data;
    } catch (err) {
      selectedProperty.value = (await db.properties.get(id)) || null;
    } finally {
      loading.value = false;
    }
  }

  async function submitApplication(propertyId: string, remarks?: string) {
    const res = await apiClient.post('/housing/applications', { propertyId, remarks });
    return res.data.data;
  }

  async function fetchMyApplications() {
    applicationsLoading.value = true;
    applicationsError.value = null;
    try {
      const res = await apiClient.get('/housing/my-applications');
      applications.value = res.data.data;
    } catch (err) {
      applicationsError.value =
        err instanceof Error ? err.message : 'Unable to load your applications. Please try again.';
    } finally {
      applicationsLoading.value = false;
    }
  }

  // Offline sample data for local preview & offline resilience
  const mockReportApplications = ref<HousingApplicationReportItem[]>([
    {
      id: 'app-001',
      status: 'pending',
      statusHistory: [
        { status: 'pending', changedAt: new Date(Date.now() - 86400000 * 2).toISOString(), changedBy: 'applicant-1' },
      ],
      policyException: true,
      policyExceptionReason: 'Late submission approved due to typhoon disruption',
      escalated: false,
      escalationReason: null,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      applicant: {
        id: 'usr-101',
        fullName: 'Nor-ainah Macapodi',
        studentIdNumber: '2023-01824',
        college: 'CNSM',
        course: 'BS Biology',
      },
      property: {
        id: 'prop-1',
        name: 'MSU Alumni Dormitory',
        address: '4th Street, MSU Main Campus',
      },
      unit: { id: 'u-101', roomNumber: '104-B' },
    },
    {
      id: 'app-002',
      status: 'approved',
      statusHistory: [
        { status: 'pending', changedAt: new Date(Date.now() - 86400000 * 5).toISOString(), changedBy: 'applicant-2' },
        { status: 'approved', changedAt: new Date(Date.now() - 86400000 * 1).toISOString(), changedBy: 'admin-1' },
      ],
      policyException: false,
      policyExceptionReason: null,
      escalated: false,
      escalationReason: null,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      applicant: {
        id: 'usr-102',
        fullName: 'Abdul Jamil Disomimba',
        studentIdNumber: '2022-09412',
        college: 'COE',
        course: 'BS Civil Engineering',
      },
      property: {
        id: 'prop-2',
        name: 'Khadijah Ladies Hall',
        address: 'Commercial Center Road, MSU Campus',
      },
      unit: { id: 'u-204', roomNumber: '208-A' },
    },
    {
      id: 'app-003',
      status: 'pending',
      statusHistory: [
        { status: 'pending', changedAt: new Date(Date.now() - 86400000 * 3).toISOString(), changedBy: 'applicant-3' },
      ],
      policyException: false,
      policyExceptionReason: null,
      escalated: true,
      escalationReason: 'Priority housing request escalated by Dean of Student Affairs',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      applicant: {
        id: 'usr-103',
        fullName: 'Rohani Sultan',
        studentIdNumber: '2024-00129',
        college: 'CBAA',
        course: 'BS Accountancy',
      },
      property: {
        id: 'prop-1',
        name: 'MSU Alumni Dormitory',
        address: '4th Street, MSU Main Campus',
      },
      unit: null,
    },
  ]);

  function computeLocalSummary(apps: HousingApplicationReportItem[]) {
    return {
      total: apps.length,
      pending: apps.filter((a) => a.status === 'pending').length,
      approved: apps.filter((a) => a.status === 'approved').length,
      rejected: apps.filter((a) => a.status === 'rejected').length,
      cancelled: apps.filter((a) => a.status === 'cancelled').length,
      policyExceptions: apps.filter((a) => a.policyException).length,
      escalated: apps.filter((a) => a.escalated).length,
    };
  }

  async function fetchAdminApplicationReport(filters: HousingApplicationReportFilters = {}) {
    adminReportLoading.value = true;
    adminReportError.value = null;
    try {
      const res = await apiClient.get('/housing/admin/application-report', { params: filters });
      adminApplicationReport.value = res.data.data;
    } catch (err) {
      console.warn('[HousingStore] Backend API unreachable, using local report demo data...');
      let filtered = [...mockReportApplications.value];
      if (filters.status) {
        filtered = filtered.filter((a) => a.status === filters.status);
      }
      if (filters.fromDate) {
        filtered = filtered.filter((a) => a.createdAt >= `${filters.fromDate}T00:00:00.000Z`);
      }
      if (filters.toDate) {
        filtered = filtered.filter((a) => a.createdAt.slice(0, 10) <= filters.toDate!);
      }
      adminApplicationReport.value = {
        summary: computeLocalSummary(filtered),
        applications: filtered,
      };
    } finally {
      adminReportLoading.value = false;
    }
  }

  async function updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    filters: HousingApplicationReportFilters = {},
  ) {
    try {
      const res = await apiClient.patch(`/housing/applications/${id}/status`, { status });
      await fetchAdminApplicationReport(filters);
      return res.data.data;
    } catch (err) {
      console.warn('[HousingStore] Backend unreachable, updating status locally...');
      const target = mockReportApplications.value.find((a) => a.id === id);
      if (target && target.status !== status) {
        target.status = status;
        target.statusHistory = [
          ...(target.statusHistory || []),
          {
            status,
            changedAt: new Date().toISOString(),
            changedBy: 'admin-housing',
          },
        ];
        target.updatedAt = new Date().toISOString();
      }
      await fetchAdminApplicationReport(filters);
      return target;
    }
  }

  async function updateApplicationCompliance(
    id: string,
    data: {
      policyException: boolean;
      policyExceptionReason?: string;
      escalated: boolean;
      escalationReason?: string;
    },
    filters: HousingApplicationReportFilters = {},
  ) {
    try {
      const res = await apiClient.patch(`/housing/applications/${id}/compliance`, data);
      await fetchAdminApplicationReport(filters);
      return res.data.data;
    } catch (err) {
      console.warn('[HousingStore] Backend unreachable, updating compliance locally...');
      const target = mockReportApplications.value.find((a) => a.id === id);
      if (target) {
        target.policyException = data.policyException;
        target.policyExceptionReason = data.policyException ? data.policyExceptionReason || null : null;
        target.escalated = data.escalated;
        target.escalationReason = data.escalated ? data.escalationReason || null : null;
        target.updatedAt = new Date().toISOString();
      }
      await fetchAdminApplicationReport(filters);
      return target;
    }
  }

  async function fetchMyResidence(): Promise<StudentResidence | null> {
    try {
      const res = await apiClient.get('/housing/my-residence');
      if (res.data?.data) {
        residence.value = res.data.data;
        return res.data.data;
      }
    } catch (err) {
      console.warn('[HousingStore] Unable to fetch student residence online');
    }
    return residence.value;
  }
  async function fetchApplicationsForReview() {
    applicationsLoading.value = true;
    applicationsError.value = null;

    try {
      const res = await apiClient.get('/housing/applications/review');
      applications.value = res.data.data;
    } catch (err) {
      applicationsError.value = 'Unable to load applications. Please try again.';
      console.warn('[HousingStore] Unable to fetch applications for review', err);
    } finally {
      applicationsLoading.value = false;
    }
  }

  return {
    properties,
    applications,
    residence,
    loading,
    applicationsLoading,
    applicationsError,
    adminApplicationReport,
    adminReportLoading,
    adminReportError,
    selectedProperty,
    fetchProperties,
    fetchPropertyById,
    submitApplication,
    fetchMyApplications,
    fetchAdminApplicationReport,
    updateApplicationStatus,
    updateApplicationCompliance,
    fetchMyResidence,
    fetchApplicationsForReview,
  };
});

