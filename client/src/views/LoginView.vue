<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ShieldCheck, ArrowRight, UserCheck, KeyRound } from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();
const loading = ref(false);

function loginWithGoogle() {
  window.location.href = 'http://localhost:3000/api/v1/auth/google';
}

async function handleDevLogin(role: 'student' | 'property_manager' | 'university_admin') {
  loading.value = true;
  try {
    const email =
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

    await authStore.devLogin(email, role, name);
    router.push({ name: 'dashboard' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <!-- Header Banner -->
      <div class="bg-gradient-to-r from-msu-maroon to-msu-darkmaroon p-6 text-white text-center">
        <div class="w-12 h-12 bg-white/20 backdrop-blur rounded-xl mx-auto flex items-center justify-center font-black text-2xl mb-2">
          U
        </div>
        <h1 class="text-xl font-bold">UniStay MSU</h1>
        <p class="text-xs text-slate-200 mt-1">Institutional & Private Housing Management System</p>
        <div class="mt-3 inline-flex items-center space-x-1 text-[11px] bg-white/10 px-2.5 py-1 rounded-full text-amber-200">
          <ShieldCheck class="w-3.5 h-3.5" />
          <span>Restricted to @msu.edu.ph Accounts</span>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Google OAuth Button -->
        <div>
          <button
            @click="loginWithGoogle"
            class="w-full flex items-center justify-center space-x-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-sm"
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
          <span class="flex-shrink mx-4 text-slate-400 text-xs uppercase tracking-wider">Quick Dev Login (Local)</span>
          <div class="flex-grow border-t border-slate-200"></div>
        </div>

        <!-- Dev Mode One-Click Role Logins -->
        <div class="space-y-2">
          <button
            @click="handleDevLogin('student')"
            :disabled="loading"
            class="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-msu-maroon/50 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-slate-800">Student Account</div>
              <div class="text-slate-500 text-[11px]">Dorm tenant, utility viewer, gig worker</div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </button>

          <button
            @click="handleDevLogin('property_manager')"
            :disabled="loading"
            class="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-slate-800">Property Manager</div>
              <div class="text-slate-500 text-[11px]">Ledger billing, maintenance tracker</div>
            </div>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </button>

          <button
            @click="handleDevLogin('university_admin')"
            :disabled="loading"
            class="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
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
