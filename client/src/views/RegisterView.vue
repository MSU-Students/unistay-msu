<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import {
  GraduationCap,
  ShieldCheck,
  User,
  Mail,
  Lock,
  Phone,
  BookOpen,
  Building2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

const fullName = ref('');
const nickName = ref('');
const email = ref('');
const studentIdNumber = ref('');
const college = ref('');
const course = ref('');
const phoneNumber = ref('');
const password = ref('');
const confirmPassword = ref('');
const agreeTerms = ref(true);

const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const msuColleges = [
  'College of Natural Sciences and Mathematics (CNSM)',
  'College of Information and Computing Sciences (CICS)',
  'College of Engineering (COE)',
  'College of Business Administration and Accountancy (CBAA)',
  'College of Education (CED)',
  'College of Social Sciences and Humanities (CSSH)',
  'College of Health Sciences (CHS)',
  'College of Agriculture (COA)',
  'College of Fisheries (COF)',
  'College of Forestry and Environmental Studies (CFES)',
  'College of Law (COL)',
  'King Faisal Center for Islamic, Arabic and Asian Studies (KFCIAAS)',
  'Other / Senior High School',
];

const isInstitutionalEmail = computed(() => {
  return email.value.trim().toLowerCase().endsWith('@msu.edu.ph');
});

async function handleRegister() {
  errorMessage.value = '';
  successMessage.value = '';

  // Client-side validations
  if (!fullName.value.trim()) {
    errorMessage.value = 'Please enter your full legal name.';
    return;
  }

  if (!email.value.trim()) {
    errorMessage.value = 'Please enter your email address.';
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value.trim())) {
    errorMessage.value = 'Please provide a valid email address.';
    return;
  }

  if (!password.value) {
    errorMessage.value = 'Please enter a password.';
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters long.';
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.';
    return;
  }

  if (!agreeTerms.value) {
    errorMessage.value = 'You must agree to the MSU Student Housing Code of Conduct.';
    return;
  }

  loading.value = true;
  try {
    await authStore.register({
      fullName: fullName.value.trim(),
      email: email.value.trim(),
      password: password.value,
      studentIdNumber: studentIdNumber.value.trim() || undefined,
      college: college.value || undefined,
      course: course.value.trim() || undefined,
      phoneNumber: phoneNumber.value.trim() || undefined,
      nickName: nickName.value.trim() || undefined,
    });

    successMessage.value = 'Account created successfully! Redirecting to your campus dashboard...';
    setTimeout(() => {
      router.push({ name: 'dashboard' });
    }, 1200);
  } catch (err: any) {
    const serverError = err.response?.data?.error;
    if (serverError) {
      if (typeof serverError === 'string') {
        errorMessage.value = serverError;
      } else if (Array.isArray(serverError.message)) {
        errorMessage.value = serverError.message.join('; ');
      } else if (serverError.message) {
        errorMessage.value = serverError.message;
      } else {
        errorMessage.value = 'Registration failed. Please check your information.';
      }
    } else if (err.message) {
      errorMessage.value = err.message;
    } else {
      errorMessage.value = 'Unable to complete registration. Please try again.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
    <div class="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
      <!-- Header Banner -->
      <div class="bg-gradient-to-r from-msu-maroon to-msu-darkmaroon p-6 text-white text-center relative">
        <div class="w-12 h-12 bg-white/20 backdrop-blur rounded-xl mx-auto flex items-center justify-center font-black text-2xl mb-2">
          U
        </div>
        <h1 class="text-xl font-bold tracking-tight">Student Self-Registration</h1>
        <p class="text-xs text-slate-200 mt-1">Create your resident student account to access MSU campus housing</p>

        <div class="mt-3 inline-flex items-center space-x-1 text-[11px] bg-white/10 px-3 py-1 rounded-full text-amber-200">
          <GraduationCap class="w-3.5 h-3.5" />
          <span>Role Assigned: Student / Dorm Resident</span>
        </div>
      </div>

      <!-- Form Content -->
      <form @submit.prevent="handleRegister" class="p-6 sm:p-8 space-y-6">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-xs"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div class="flex-1 font-medium">{{ errorMessage }}</div>
        </div>

        <!-- Success Banner -->
        <div
          v-if="successMessage"
          class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-700 text-xs"
        >
          <CheckCircle2 class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div class="flex-1 font-medium">{{ successMessage }}</div>
        </div>

        <!-- Section: Basic Information -->
        <div class="space-y-4">
          <div class="border-b border-slate-100 pb-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Personal Information</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Full Name -->
            <div class="col-span-full">
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <User class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  v-model="fullName"
                  type="text"
                  required
                  placeholder="e.g. Amina B. Dimaporo"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                />
              </div>
            </div>

            <!-- Nickname -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Preferred Name / Nickname</label>
              <input
                v-model="nickName"
                type="text"
                placeholder="e.g. Ami"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
              />
            </div>

            <!-- Mobile Phone -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Mobile Contact Number</label>
              <div class="relative">
                <Phone class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  v-model="phoneNumber"
                  type="tel"
                  placeholder="0912 345 6789"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Academic Details -->
        <div class="space-y-4">
          <div class="border-b border-slate-100 pb-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Academic & Student Details</h2>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Student ID -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                MSU Student ID Number
              </label>
              <div class="relative">
                <GraduationCap class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  v-model="studentIdNumber"
                  type="text"
                  placeholder="e.g. 2023-01234"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                />
              </div>
            </div>

            <!-- College Selection -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Collegiate Affiliation</label>
              <div class="relative">
                <Building2 class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select
                  v-model="college"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                >
                  <option value="">Select your College...</option>
                  <option v-for="col in msuColleges" :key="col" :value="col">
                    {{ col }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Course / Degree Program -->
            <div class="col-span-full">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Degree / Course Program</label>
              <div class="relative">
                <BookOpen class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  v-model="course"
                  type="text"
                  placeholder="e.g. BS Computer Science, BS Civil Engineering"
                  class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Credentials & Security -->
        <div class="space-y-4">
          <div class="border-b border-slate-100 pb-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Account Credentials</h2>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <Mail class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                v-model="email"
                type="email"
                required
                placeholder="student.name@msu.edu.ph or personal email"
                class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
              />
            </div>
            <div v-if="isInstitutionalEmail" class="mt-1 flex items-center space-x-1 text-[11px] text-emerald-700">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-600" />
              <span>Institutional email detected. Your account will receive MSU Verified status.</span>
            </div>
            <p v-else class="text-[11px] text-slate-500 mt-1">
              Tip: Use your official <strong>@msu.edu.ph</strong> email for automatic verification badge.
            </p>
          </div>

          <!-- Password & Confirm Password -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Password -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                Password <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  placeholder="Min 6 characters"
                  class="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <Eye v-if="!showPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Confirm Password -->
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  placeholder="Re-enter password"
                  class="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
                />
                <button
                  type="button"
                  @click="showConfirmPassword = !showConfirmPassword"
                  class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <Eye v-if="!showConfirmPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Honor Code & Terms -->
        <div class="pt-2">
          <label class="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
            <input
              v-model="agreeTerms"
              type="checkbox"
              class="rounded border-slate-300 text-msu-maroon focus:ring-msu-maroon mt-0.5"
            />
            <span>
              I agree to abide by Mindanao State University housing policies, terms of residency, and code of conduct.
            </span>
          </label>
        </div>

        <!-- Submit Button -->
        <div class="space-y-3 pt-2">
          <button
            type="submit"
            :disabled="loading"
            class="w-full flex items-center justify-center space-x-2 bg-msu-maroon hover:bg-msu-darkmaroon text-white font-semibold py-2.5 px-4 rounded-xl shadow-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!loading">Create Student Account</span>
            <span v-else>Registering Account...</span>
            <ArrowRight v-if="!loading" class="w-4 h-4" />
          </button>

          <div class="text-center text-xs text-slate-500">
            Already have an account?
            <router-link :to="{ name: 'login' }" class="text-msu-maroon hover:underline font-semibold ml-1">
              Sign In here
            </router-link>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

