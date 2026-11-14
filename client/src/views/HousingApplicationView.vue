<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { isAxiosError } from 'axios';
import { ArrowLeft, CheckCircle2, ClipboardList, LoaderCircle, Save } from 'lucide-vue-next';
import AppLayout from '../components/layout/AppLayout.vue';
import { db } from '../db';
import { useAuthStore } from '../stores/auth';
import { useHousingStore } from '../stores/housing';
import type { HousingApplicationDraft } from '../types';
import { useRoute } from 'vue-router';

const route = useRoute();
const authStore = useAuthStore();
const housingStore = useHousingStore();
const studentId = authStore.user?.id ?? '';
const draftId = `housing-application-${studentId}`;

function createEmptyDraft(): HousingApplicationDraft {
  return {
    id: draftId,
    studentId,
    fullName: authStore.user?.fullName ?? '',
    studentNumber: '',
    email: authStore.user?.email ?? '',
    contactNumber: '',
    sex: '',
    dateOfBirth: '',
    religion: '',
    homeAddress: '',
    city: '',
    province: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
    emergencyContactRelationship: '',
    university: 'Mindanao State University - Main Campus',
    college: '',
    degreeProgram: '',
    yearLevel: '',
    academicYear: '',
    semester: '',
    housingType: '',
    propertyId: '',
    roomType: '',
    otherPreferences: '',
    updatedAt: new Date().toISOString(),
  };
}

const form = ref<HousingApplicationDraft>(createEmptyDraft());
const errors = ref<Partial<Record<keyof HousingApplicationDraft, string>>>({});
const listingsLoading = ref(true);
const listingsError = ref('');
const savingDraft = ref(false);
const submitting = ref(false);
const draftMessage = ref('');
const draftError = ref('');
const submitError = ref('');
const submitted = ref(false);
const loadedDraft = ref(false);
const maxDateOfBirth = new Date().toISOString().slice(0, 10);

const properties = computed(() =>
  housingStore.properties.filter(
    (property) =>
      property.availableSlots !== 0 &&
      (!form.value.housingType || property.type === form.value.housingType),
  ),
);

const requiredFields: Array<keyof HousingApplicationDraft> = [
  'fullName',
  'studentNumber',
  'email',
  'contactNumber',
  'sex',
  'dateOfBirth',
  'religion',
  'homeAddress',
  'city',
  'province',
  'emergencyContactName',
  'emergencyContactNumber',
  'emergencyContactRelationship',
  'university',
  'college',
  'degreeProgram',
  'yearLevel',
  'academicYear',
  'semester',
  'housingType',
  'propertyId',
  'roomType',
];

function inputClass(field: keyof HousingApplicationDraft) {
  return [
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2',
    errors.value[field]
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-msu-maroon focus:ring-msu-maroon/15',
  ];
}

function validateForm() {
  const nextErrors: Partial<Record<keyof HousingApplicationDraft, string>> = {};

  for (const field of requiredFields) {
    if (!String(form.value[field] ?? '').trim()) {
      nextErrors[field] = 'This field is required.';
    }
  }

  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    nextErrors.email = 'Enter a valid email address.';
  }

  const phonePattern = /^\+?[\d\s()-]{7,20}$/;
  if (form.value.contactNumber && !phonePattern.test(form.value.contactNumber)) {
    nextErrors.contactNumber = 'Enter a valid contact number.';
  }
  if (form.value.emergencyContactNumber && !phonePattern.test(form.value.emergencyContactNumber)) {
    nextErrors.emergencyContactNumber = 'Enter a valid contact number.';
  }

  if (form.value.dateOfBirth && form.value.dateOfBirth > maxDateOfBirth) {
    nextErrors.dateOfBirth = 'Date of birth cannot be in the future.';
  }

  errors.value = nextErrors;
  return Object.keys(nextErrors).length === 0;
}

function handleHousingTypeChange() {
  form.value.propertyId = '';
  errors.value.propertyId = undefined;
}

function handlePropertyChange() {
  const property = housingStore.properties.find((item) => item.id === form.value.propertyId);
  if (property) form.value.housingType = property.type;
  errors.value.propertyId = undefined;
}

async function loadDraft() {
  if (!studentId) return;

  try {
    const savedDraft = await db.applicationDrafts.get(draftId);
    if (savedDraft) {
      form.value = savedDraft;
      loadedDraft.value = true;
      draftMessage.value = 'Your saved draft has been restored from this device.';
    }
  } catch (error) {
    draftError.value =
      error instanceof Error
        ? `Unable to load your saved draft: ${error.message}`
        : 'Unable to load your saved draft from this device.';
  }
}

async function loadHousingOptions() {
  try {
    await housingStore.fetchProperties();
  } catch (error) {
    listingsError.value =
      error instanceof Error
        ? `Unable to load housing options: ${error.message}`
        : 'Unable to load housing options. Please try again later.';
  } finally {
    listingsLoading.value = false;
  }
}

async function saveDraft() {
  savingDraft.value = true;
  draftError.value = '';
  draftMessage.value = '';

  try {
    form.value.updatedAt = new Date().toISOString();
    await db.applicationDrafts.put({ ...form.value });
    loadedDraft.value = true;
    draftMessage.value = `Draft saved on this device at ${new Date(form.value.updatedAt).toLocaleTimeString()}.`;
  } catch (error) {
    draftError.value =
      error instanceof Error
        ? `Unable to save your draft: ${error.message}`
        : 'Unable to save your draft on this device.';
  } finally {
    savingDraft.value = false;
  }
}

function formatApplicationRemarks(application: HousingApplicationDraft) {
  const property = housingStore.properties.find((item) => item.id === application.propertyId);
  const preferredHousingType = property?.type ?? application.housingType;
  const housingTypeLabel =
    preferredHousingType === 'institutional_dorm'
      ? 'Institutional Dormitory'
      : 'Private Boarding House';

  return [
    'Housing application details',
    `Full name: ${application.fullName}`,
    `Student ID: ${application.studentNumber}`,
    `Email address: ${application.email}`,
    `Contact number: ${application.contactNumber}`,
    `Sex: ${application.sex}`,
    `Date of birth: ${application.dateOfBirth}`,
    `Religion: ${application.religion}`,
    `Home address: ${application.homeAddress}`,
    `City/Municipality: ${application.city}`,
    `Province: ${application.province}`,
    `Emergency contact: ${application.emergencyContactName}`,
    `Emergency contact number: ${application.emergencyContactNumber}`,
    `Emergency contact relationship: ${application.emergencyContactRelationship}`,
    `University: ${application.university}`,
    `College/Department: ${application.college}`,
    `Degree program: ${application.degreeProgram}`,
    `Year level: ${application.yearLevel}`,
    `Academic year: ${application.academicYear}`,
    `Semester: ${application.semester}`,
    `Preferred accommodation: ${housingTypeLabel}`,
    `Preferred housing: ${property?.name ?? 'Not specified'}`,
    `Preferred room type: ${application.roomType}`,
    `Other housing preferences: ${application.otherPreferences.trim() || 'None provided'}`,
  ].join('\n');
}

function getSubmitError(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (message) return message;
    if (!error.response) return 'Unable to reach the housing service. Check your connection and try again.';
    return `The housing service could not accept your application (HTTP ${error.response.status}). Please try again.`;
  }

  return error instanceof Error
    ? error.message
    : 'An unexpected error occurred. Your form data is still available to retry.';
}

async function submitApplication() {
  submitted.value = false;
  submitError.value = '';
  if (!validateForm()) return;

  submitting.value = true;
  try {
    await housingStore.submitApplication(
      form.value.propertyId,
      formatApplicationRemarks(form.value),
    );
    submitted.value = true;

    try {
      await db.applicationDrafts.delete(draftId);
      loadedDraft.value = false;
      draftMessage.value = '';
    } catch (error) {
      draftError.value =
        error instanceof Error
          ? `Application submitted, but the local draft could not be removed: ${error.message}`
          : 'Application submitted, but the local draft could not be removed.';
    }
  } catch (error) {
    submitError.value = getSubmitError(error);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadDraft(), loadHousingOptions()]);
  const requestedPropertyId =
    typeof route.query.propertyId === 'string' ? route.query.propertyId : '';
  const requestedProperty = properties.value.find(
    (property) => property.id === requestedPropertyId,
  );

  if (requestedProperty) {
    form.value.propertyId = requestedProperty.id;
    form.value.housingType = requestedProperty.type;
  }
});
</script>

<template>
  <AppLayout>
    <div class="mx-auto max-w-5xl space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <router-link
            to="/housing"
            class="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-msu-maroon"
          >
            <ArrowLeft class="h-4 w-4" />
            Back to housing directory
          </router-link>
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-msu-maroon">
              <ClipboardList class="h-5 w-5" />
            </div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-msu-maroon">Student Services</p>
              <h1 class="text-2xl font-bold text-slate-900">Housing Application</h1>
            </div>
          </div>
          <p class="mt-2 max-w-2xl text-sm text-slate-600">
            Complete your student, academic, and accommodation details. You can save a draft on this device and finish it later.
          </p>
        </div>
        <span
          v-if="loadedDraft"
          class="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"
        >
          <Save class="h-3.5 w-3.5" />
          Draft in progress
        </span>
      </div>

      <div
        v-if="submitted"
        role="status"
        class="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
      >
        <CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p class="font-semibold">Application submitted successfully.</p>
          <p class="mt-1 text-sm">Your housing application has been received by the housing service.</p>
        </div>
      </div>

      <div
        v-if="submitError"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <p class="font-semibold">We couldn't submit your application.</p>
        <p class="mt-1">{{ submitError }}</p>
        <p class="mt-1">Your entered information is still here. Correct any issues and try again.</p>
      </div>

      <div
        v-if="draftMessage"
        role="status"
        class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
      >
        {{ draftMessage }}
      </div>
      <div
        v-if="draftError"
        role="alert"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      >
        {{ draftError }}
      </div>

      <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Drafts are stored only in this browser on this device. Submitted form details are sent to the current housing API in the application's remarks field.
      </div>

      <form novalidate @submit.prevent="submitApplication" class="space-y-5">
        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="personal-heading">
          <div class="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
            <p class="text-xs font-semibold uppercase tracking-wider text-msu-maroon">Section 1</p>
            <h2 id="personal-heading" class="mt-1 text-lg font-bold text-slate-900">Personal Information</h2>
            <p class="mt-1 text-sm text-slate-600">Provide your identity and emergency contact details.</p>
          </div>
          <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <div>
              <label for="fullName" class="mb-1.5 block text-sm font-medium text-slate-700">Full Name <span class="text-red-600">*</span></label>
              <input id="fullName" v-model.trim="form.fullName" :class="inputClass('fullName')" autocomplete="name" placeholder="e.g. Juan Dela Cruz" :aria-invalid="Boolean(errors.fullName)" />
              <p v-if="errors.fullName" class="mt-1 text-xs text-red-700">{{ errors.fullName }}</p>
            </div>
            <div>
              <label for="studentNumber" class="mb-1.5 block text-sm font-medium text-slate-700">Student ID <span class="text-red-600">*</span></label>
              <input id="studentNumber" v-model.trim="form.studentNumber" :class="inputClass('studentNumber')" placeholder="Enter your MSU student number" :aria-invalid="Boolean(errors.studentNumber)" />
              <p v-if="errors.studentNumber" class="mt-1 text-xs text-red-700">{{ errors.studentNumber }}</p>
            </div>
            <div>
              <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700">Email Address <span class="text-red-600">*</span></label>
              <input id="email" v-model.trim="form.email" type="email" :class="inputClass('email')" autocomplete="email" placeholder="name@msu.edu.ph" :aria-invalid="Boolean(errors.email)" />
              <p v-if="errors.email" class="mt-1 text-xs text-red-700">{{ errors.email }}</p>
            </div>
            <div>
              <label for="contactNumber" class="mb-1.5 block text-sm font-medium text-slate-700">Contact Number <span class="text-red-600">*</span></label>
              <input id="contactNumber" v-model.trim="form.contactNumber" type="tel" :class="inputClass('contactNumber')" autocomplete="tel" placeholder="e.g. 0917 123 4567" :aria-invalid="Boolean(errors.contactNumber)" />
              <p v-if="errors.contactNumber" class="mt-1 text-xs text-red-700">{{ errors.contactNumber }}</p>
            </div>
            <div>
              <label for="sex" class="mb-1.5 block text-sm font-medium text-slate-700">Sex <span class="text-red-600">*</span></label>
              <select id="sex" v-model="form.sex" :class="inputClass('sex')" :aria-invalid="Boolean(errors.sex)">
                <option value="" disabled>Select sex</option>
                <option>Female</option>
                <option>Male</option>
                <option>Prefer not to say</option>
              </select>
              <p v-if="errors.sex" class="mt-1 text-xs text-red-700">{{ errors.sex }}</p>
            </div>
            <div>
              <label for="dateOfBirth" class="mb-1.5 block text-sm font-medium text-slate-700">Date of Birth <span class="text-red-600">*</span></label>
              <input id="dateOfBirth" v-model="form.dateOfBirth" type="date" :max="maxDateOfBirth" :class="inputClass('dateOfBirth')" :aria-invalid="Boolean(errors.dateOfBirth)" />
              <p v-if="errors.dateOfBirth" class="mt-1 text-xs text-red-700">{{ errors.dateOfBirth }}</p>
            </div>
            <div>
              <label for="religion" class="mb-1.5 block text-sm font-medium text-slate-700">Religion <span class="text-red-600">*</span></label>
              <input id="religion" v-model.trim="form.religion" :class="inputClass('religion')" placeholder="Enter your religion" :aria-invalid="Boolean(errors.religion)" />
              <p v-if="errors.religion" class="mt-1 text-xs text-red-700">{{ errors.religion }}</p>
            </div>
            <div class="sm:col-span-2">
              <label for="homeAddress" class="mb-1.5 block text-sm font-medium text-slate-700">Home Address <span class="text-red-600">*</span></label>
              <input id="homeAddress" v-model.trim="form.homeAddress" :class="inputClass('homeAddress')" autocomplete="street-address" placeholder="House number, street, barangay" :aria-invalid="Boolean(errors.homeAddress)" />
              <p v-if="errors.homeAddress" class="mt-1 text-xs text-red-700">{{ errors.homeAddress }}</p>
            </div>
            <div>
              <label for="city" class="mb-1.5 block text-sm font-medium text-slate-700">City/Municipality <span class="text-red-600">*</span></label>
              <input id="city" v-model.trim="form.city" :class="inputClass('city')" autocomplete="address-level2" placeholder="City or municipality" :aria-invalid="Boolean(errors.city)" />
              <p v-if="errors.city" class="mt-1 text-xs text-red-700">{{ errors.city }}</p>
            </div>
            <div>
              <label for="province" class="mb-1.5 block text-sm font-medium text-slate-700">Province <span class="text-red-600">*</span></label>
              <input id="province" v-model.trim="form.province" :class="inputClass('province')" autocomplete="address-level1" placeholder="Province" :aria-invalid="Boolean(errors.province)" />
              <p v-if="errors.province" class="mt-1 text-xs text-red-700">{{ errors.province }}</p>
            </div>
            <div class="sm:col-span-2 lg:col-span-3">
              <h3 class="border-t border-slate-100 pt-4 text-sm font-semibold text-slate-800">Emergency Contact</h3>
            </div>
            <div>
              <label for="emergencyContactName" class="mb-1.5 block text-sm font-medium text-slate-700">Contact Name <span class="text-red-600">*</span></label>
              <input id="emergencyContactName" v-model.trim="form.emergencyContactName" :class="inputClass('emergencyContactName')" autocomplete="off" placeholder="Emergency contact's full name" :aria-invalid="Boolean(errors.emergencyContactName)" />
              <p v-if="errors.emergencyContactName" class="mt-1 text-xs text-red-700">{{ errors.emergencyContactName }}</p>
            </div>
            <div>
              <label for="emergencyContactNumber" class="mb-1.5 block text-sm font-medium text-slate-700">Contact Number <span class="text-red-600">*</span></label>
              <input id="emergencyContactNumber" v-model.trim="form.emergencyContactNumber" type="tel" :class="inputClass('emergencyContactNumber')" placeholder="e.g. 0917 123 4567" :aria-invalid="Boolean(errors.emergencyContactNumber)" />
              <p v-if="errors.emergencyContactNumber" class="mt-1 text-xs text-red-700">{{ errors.emergencyContactNumber }}</p>
            </div>
            <div>
              <label for="emergencyContactRelationship" class="mb-1.5 block text-sm font-medium text-slate-700">Relationship <span class="text-red-600">*</span></label>
              <input id="emergencyContactRelationship" v-model.trim="form.emergencyContactRelationship" :class="inputClass('emergencyContactRelationship')" placeholder="e.g. Parent, guardian, sibling" :aria-invalid="Boolean(errors.emergencyContactRelationship)" />
              <p v-if="errors.emergencyContactRelationship" class="mt-1 text-xs text-red-700">{{ errors.emergencyContactRelationship }}</p>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="academic-heading">
          <div class="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
            <p class="text-xs font-semibold uppercase tracking-wider text-msu-maroon">Section 2</p>
            <h2 id="academic-heading" class="mt-1 text-lg font-bold text-slate-900">Academic Information</h2>
            <p class="mt-1 text-sm text-slate-600">Tell us about your current university enrollment.</p>
          </div>
          <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <label for="university" class="mb-1.5 block text-sm font-medium text-slate-700">University <span class="text-red-600">*</span></label>
              <input id="university" v-model.trim="form.university" :class="inputClass('university')" placeholder="University name and campus" :aria-invalid="Boolean(errors.university)" />
              <p v-if="errors.university" class="mt-1 text-xs text-red-700">{{ errors.university }}</p>
            </div>
            <div>
              <label for="college" class="mb-1.5 block text-sm font-medium text-slate-700">College or Department <span class="text-red-600">*</span></label>
              <input id="college" v-model.trim="form.college" :class="inputClass('college')" placeholder="e.g. College of Natural Sciences and Mathematics" :aria-invalid="Boolean(errors.college)" />
              <p v-if="errors.college" class="mt-1 text-xs text-red-700">{{ errors.college }}</p>
            </div>
            <div>
              <label for="degreeProgram" class="mb-1.5 block text-sm font-medium text-slate-700">Degree Program <span class="text-red-600">*</span></label>
              <input id="degreeProgram" v-model.trim="form.degreeProgram" :class="inputClass('degreeProgram')" placeholder="e.g. BS Computer Science" :aria-invalid="Boolean(errors.degreeProgram)" />
              <p v-if="errors.degreeProgram" class="mt-1 text-xs text-red-700">{{ errors.degreeProgram }}</p>
            </div>
            <div>
              <label for="yearLevel" class="mb-1.5 block text-sm font-medium text-slate-700">Year Level <span class="text-red-600">*</span></label>
              <select id="yearLevel" v-model="form.yearLevel" :class="inputClass('yearLevel')" :aria-invalid="Boolean(errors.yearLevel)">
                <option value="" disabled>Select year level</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
                <option>5th Year</option>
                <option>Graduate Student</option>
              </select>
              <p v-if="errors.yearLevel" class="mt-1 text-xs text-red-700">{{ errors.yearLevel }}</p>
            </div>
            <div>
              <label for="academicYear" class="mb-1.5 block text-sm font-medium text-slate-700">Academic Year <span class="text-red-600">*</span></label>
              <input id="academicYear" v-model.trim="form.academicYear" :class="inputClass('academicYear')" placeholder="e.g. 2026-2027" :aria-invalid="Boolean(errors.academicYear)" />
              <p v-if="errors.academicYear" class="mt-1 text-xs text-red-700">{{ errors.academicYear }}</p>
            </div>
            <div>
              <label for="semester" class="mb-1.5 block text-sm font-medium text-slate-700">Semester <span class="text-red-600">*</span></label>
              <select id="semester" v-model="form.semester" :class="inputClass('semester')" :aria-invalid="Boolean(errors.semester)">
                <option value="" disabled>Select semester</option>
                <option>1st Semester</option>
                <option>2nd Semester</option>
                <option>Summer</option>
              </select>
              <p v-if="errors.semester" class="mt-1 text-xs text-red-700">{{ errors.semester }}</p>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="housing-heading">
          <div class="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
            <p class="text-xs font-semibold uppercase tracking-wider text-msu-maroon">Section 3</p>
            <h2 id="housing-heading" class="mt-1 text-lg font-bold text-slate-900">Housing Preferences</h2>
            <p class="mt-1 text-sm text-slate-600">Choose the listing and room arrangement that best suits your needs.</p>
          </div>
          <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <label for="housingType" class="mb-1.5 block text-sm font-medium text-slate-700">Preferred Housing Type <span class="text-red-600">*</span></label>
              <select id="housingType" v-model="form.housingType" :class="inputClass('housingType')" @change="handleHousingTypeChange" :aria-invalid="Boolean(errors.housingType)">
                <option value="" disabled>Select accommodation type</option>
                <option value="institutional_dorm">Institutional Dormitory</option>
                <option value="private_boarding_house">Private Boarding House</option>
              </select>
              <p v-if="errors.housingType" class="mt-1 text-xs text-red-700">{{ errors.housingType }}</p>
            </div>
            <div>
              <label for="propertyId" class="mb-1.5 block text-sm font-medium text-slate-700">Preferred Housing <span class="text-red-600">*</span></label>
              <select id="propertyId" v-model="form.propertyId" :class="inputClass('propertyId')" :disabled="listingsLoading || properties.length === 0" @change="handlePropertyChange" :aria-invalid="Boolean(errors.propertyId)">
                <option value="" disabled>
                  {{ listingsLoading ? 'Loading housing options...' : properties.length ? 'Select a housing listing' : 'No listings available' }}
                </option>
                <option v-for="property in properties" :key="property.id" :value="property.id">
                  {{ property.name }}
                </option>
              </select>
              <p v-if="errors.propertyId" class="mt-1 text-xs text-red-700">{{ errors.propertyId }}</p>
              <p v-else-if="listingsError" class="mt-1 text-xs text-red-700">{{ listingsError }}</p>
              <p v-else-if="!listingsLoading && properties.length === 0" class="mt-1 text-xs text-slate-500">
                No housing listings are currently available. Visit the directory to check again later.
              </p>
            </div>
            <div>
              <label for="roomType" class="mb-1.5 block text-sm font-medium text-slate-700">Preferred Room Type <span class="text-red-600">*</span></label>
              <select id="roomType" v-model="form.roomType" :class="inputClass('roomType')" :aria-invalid="Boolean(errors.roomType)">
                <option value="" disabled>Select room type</option>
                <option>Single occupancy</option>
                <option>Shared room - 2 occupants</option>
                <option>Shared room - 3 or more occupants</option>
                <option>No preference</option>
              </select>
              <p v-if="errors.roomType" class="mt-1 text-xs text-red-700">{{ errors.roomType }}</p>
            </div>
            <div class="sm:col-span-2">
              <label for="otherPreferences" class="mb-1.5 block text-sm font-medium text-slate-700">Other Relevant Housing Preferences <span class="font-normal text-slate-500">(optional)</span></label>
              <textarea id="otherPreferences" v-model.trim="form.otherPreferences" rows="4" :class="inputClass('otherPreferences')" placeholder="Share accessibility needs, preferred amenities, proximity requirements, or other details." />
            </div>
          </div>
        </section>

        <div class="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-slate-500"><span class="text-red-600">*</span> Required fields</p>
          <div class="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              :disabled="savingDraft || submitting"
              @click="saveDraft"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LoaderCircle v-if="savingDraft" class="h-4 w-4 animate-spin" />
              <Save v-else class="h-4 w-4" />
              {{ savingDraft ? 'Saving draft...' : 'Save as Draft' }}
            </button>
            <button
              type="submit"
              :disabled="submitting || savingDraft || listingsLoading || properties.length === 0"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-msu-maroon px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-msu-darkmaroon disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" />
              <CheckCircle2 v-else class="h-4 w-4" />
              {{ submitting ? 'Submitting...' : 'Submit Application' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </AppLayout>
</template>
