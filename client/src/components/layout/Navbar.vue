<script setup lang="ts">
import { useAuthStore } from '../../stores/auth';
import { useRouter } from 'vue-router';
import { LogOut, User as UserIcon, ShieldCheck } from 'lucide-vue-next';

const authStore = useAuthStore();
const router = useRouter();

async function handleLogout() {
  await authStore.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-8 py-3 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <div class="w-9 h-9 bg-msu-maroon rounded-lg flex items-center justify-center text-white font-black text-lg shadow-sm">
        U
      </div>
      <div>
        <h1 class="font-bold text-slate-900 text-base leading-tight">UniStay MSU</h1>
        <p class="text-xs text-slate-500 hidden sm:block">Mindanao State University Housing System</p>
      </div>
    </div>

    <div class="flex items-center space-x-4">
      <div v-if="authStore.user" class="flex items-center space-x-3">
        <div class="text-right hidden sm:block">
          <div class="text-sm font-semibold text-slate-800 flex items-center justify-end space-x-1">
            <span>{{ authStore.user.fullName }}</span>
            <ShieldCheck v-if="authStore.user.isInstitutionalVerified" class="w-4 h-4 text-emerald-600 inline" title="MSU Verified" />
          </div>
          <div class="text-xs text-slate-500 uppercase tracking-wider font-medium">
            {{ authStore.user.role.replace('_', ' ') }}
          </div>
        </div>
        <div class="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-semibold">
          {{ authStore.user.fullName?.charAt(0) || 'U' }}
        </div>
        <button
          v-if="!authStore.isAdmin"
          @click="authStore.devLogin('admin.housing@msu.edu.ph', 'university_admin', 'Dr. Taratingan (Housing Admin)')"
          class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center space-x-1"
          title="Switch to University Admin role to test Application Reports"
        >
          <span>Admin Mode</span>
        </button>
        <button
          v-else
          @click="authStore.devLogin('student.msu@msu.edu.ph', 'student', 'Amina Dimaporo (Student)')"
          class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
          title="Switch back to Student role"
        >
          <span>Student Mode</span>
        </button>

        <button
          @click="handleLogout"
          class="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut class="w-5 h-5" />
        </button>
      </div>

      <div v-else class="flex items-center space-x-2">
        <router-link
          to="/register"
          class="border border-msu-maroon/70 text-msu-maroon hover:bg-msu-maroon hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
        >
          <UserIcon class="w-3.5 h-3.5" />
          <span>Register as Student</span>
        </router-link>
        <router-link
          to="/login"
          class="bg-msu-maroon text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-msu-darkmaroon transition-colors"
        >
          Sign In
        </router-link>
      </div>
    </div>
  </header>
</template>
