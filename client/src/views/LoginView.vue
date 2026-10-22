<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import {
  ShieldCheck,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  UserPlus,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const devLoading = ref(false);
const errorMessage = ref('');

function loginWithGoogle() {
  window.location.href = 'http://localhost:3000/api/v1/auth/google';
}

async function handlePasswordLogin() {
  errorMessage.value = '';
  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Please provide both email and password.';
    return;
  }

  loading.value = true;
  try {
    await authStore.login(email.value.trim(), password.value);
    router.push({ name: 'dashboard' });
  } catch (err: any) {
    const serverMsg = err.response?.data?.error?.message || err.response?.data?.error;
    if (serverMsg) {
      errorMessage.value = typeof serverMsg === 'string' ? serverMsg : 'Invalid email or password.';
    } else {
      errorMessage.value = 'Unable to sign in. Please verify your credentials or server connection.';
    }
  } finally {
    loading.value = false;
  }
}

async function handleDevLogin(role: 'student' | 'property_manager' | 'university_admin') {
  devLoading.value = true;
  errorMessage.value = '';
  try {
    const devEmail =
      role === 'student'
        ? 'student.msu@msu.edu.ph'
        : role === 'property_manager'
        ? 'manager.dorm@msu.edu.ph'
        : 'admin.housing@msu.edu.ph';
    const name =
      role === 'student'
        ? 'Amina Dimaporo (Student)'
        : role === 'property_manager'
        ? 'Engr. Haron Lucman (Dorm Manager)'
        : 'Dr. Taratingan (Housing Admin)';

    await authStore.devLogin(devEmail, role, name);
    router.push({ name: 'dashboard' });
  } finally {
    devLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-4">
      <!-- Header Banner -->
      <div class="bg-gradient-to-r from-msu-maroon to-msu-darkmaroon p-6 text-white text-center">
        <div class="w-12 h-12 bg-white/20 backdrop-blur rounded-xl mx-auto flex items-center justify-center font-black text-2xl mb-2">
          U
        </div>
        <h1 class="text-xl font-bold">UniStay MSU</h1>
        <p class="text-xs text-slate-200 mt-1">Institutional & Private Housing Management System</p>
        <div class="mt-3 inline-flex items-center space-x-1 text-[11px] bg-white/10 px-2.5 py-1 rounded-full text-amber-200">
          <ShieldCheck class="w-3.5 h-3.5" />
          <span>Mindanao State University Main Campus</span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-5">
        <!-- Error Banner -->
        <div
          v-if="errorMessage"
          class="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-xs"
        >
          <AlertCircle class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div class="flex-1 font-medium">{{ errorMessage }}</div>
        </div>

        <!-- Credentials Login Form -->
        <form @submit.prevent="handlePasswordLogin" class="space-y-3.5">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div class="relative">
              <Mail class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                v-model="email"
                type="email"
                required
                placeholder="student.name@msu.edu.ph"
                class="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700">Password</label>
            </div>
            <div class="relative">
              <Lock class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                placeholder="Enter your password"
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

          <button
            type="submit"
            :disabled="loading"
            class="w-full flex items-center justify-center space-x-2 bg-msu-maroon hover:bg-msu-darkmaroon text-white font-semibold py-2 px-4 rounded-xl shadow-sm transition-colors text-sm disabled:opacity-50"
          >
            <span v-if="!loading">Sign In</span>
            <span v-else>Signing in...</span>
          </button>
        </form>

        <!-- Student Self-Registration Entry Point -->
        <div class="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-center">
          <div class="text-xs text-amber-900 font-semibold mb-1">New to MSU Housing?</div>
          <p class="text-[11px] text-amber-800 mb-2">Register your own student account in just a minute.</p>
          <router-link
            :to="{ name: 'register' }"
            class="inline-flex items-center justify-center space-x-2 w-full bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-xs"
          >
            <UserPlus class="w-3.5 h-3.5 text-msu-maroon" />
            <span>Register as Student</span>
          </router-link>
        </div>

        <div class="relative flex py-1 items-center">
          <div class="flex-grow border-t border-slate-200"></div>
          <span class="flex-shrink mx-4 text-slate-400 text-[11px] uppercase tracking-wider">Or continue with</span>
          <div class="flex-grow border-t border-slate-200"></div>
        </div>

        <!-- Google OAuth Button -->
        <div>
          <button
            @click="loginWithGoogle"
            class="w-full flex items-center justify-center space-x-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-xl shadow-xs transition-colors text-xs"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with MSU Google Account</span>
          </button>
        </div>

        <div class="relative flex py-1 items-center">
          <div class="flex-grow border-t border-slate-200"></div>
          <span class="flex-shrink mx-4 text-slate-400 text-[10px] uppercase tracking-wider">Quick Dev Login (Local)</span>
          <div class="flex-grow border-t border-slate-200"></div>
        </div>

        <!-- Dev Mode One-Click Role Logins -->
        <div class="space-y-1.5">
          <button
            @click="handleDevLogin('student')"
            :disabled="devLoading"
            class="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-msu-maroon/50 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-slate-800">Student Account</div>
              <div class="text-slate-500 text-[11px]">Dorm tenant, utility viewer, gig worker</div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </button>

          <button
            @click="handleDevLogin('property_manager')"
            :disabled="devLoading"
            class="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-slate-800">Property Manager</div>
              <div class="text-slate-500 text-[11px]">Ledger billing, maintenance tracker</div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </button>

          <button
            @click="handleDevLogin('university_admin')"
            :disabled="devLoading"
            class="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-slate-800">University Administrator</div>
              <div class="text-slate-500 text-[11px]">Campus accreditation & governance</div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
