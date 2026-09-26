<script setup lang="ts">
import { onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useAuthStore } from '../stores/auth';
import { useNetworkStore } from '../stores/network';
import {
  Building2,
  Receipt,
  Wrench,
  CalendarDays,
  Briefcase,
  Wifi,
  WifiOff,
  Database,
  ArrowUpRight,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const networkStore = useNetworkStore();

onMounted(async () => {
  await networkStore.updateStatus();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Welcome Header -->
      <div class="bg-gradient-to-r from-msu-maroon to-msu-darkmaroon rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-1">
              MSU Housing Information System
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold">
              Welcome back, {{ authStore.user?.fullName || 'Resident' }}!
            </h1>
            <p class="text-slate-200 text-sm mt-1">
              Campus living dashboard with offline resilience & verifiable billing.
            </p>
          </div>

          <div class="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs">
            <component
              :is="networkStore.isOnline ? Wifi : WifiOff"
              :class="networkStore.isOnline ? 'text-emerald-400' : 'text-amber-400'"
              class="w-4 h-4"
            />
            <span class="font-semibold">
              {{ networkStore.isOnline ? 'Network Online' : 'Offline Mode (IndexedDB)' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div class="p-3 bg-red-50 text-msu-maroon rounded-lg">
            <Building2 class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs font-medium text-slate-500">Dormitory Status</div>
            <div class="text-lg font-bold text-slate-800">Alumni Dorm #204</div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div class="p-3 bg-emerald-50 text-emerald-700 rounded-lg">
            <Receipt class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs font-medium text-slate-500">Active Balance</div>
            <div class="text-lg font-bold text-slate-800">₱0.00 (All Paid)</div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div class="p-3 bg-blue-50 text-blue-700 rounded-lg">
            <CalendarDays class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs font-medium text-slate-500">Next Reservation</div>
            <div class="text-lg font-bold text-slate-800">Laundry (3:00 PM)</div>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div class="p-3 bg-amber-50 text-amber-700 rounded-lg">
            <Database class="w-6 h-6" />
          </div>
          <div>
            <div class="text-xs font-medium text-slate-500">Local Dexie Storage</div>
            <div class="text-lg font-bold text-slate-800">Active & Cached</div>
          </div>
        </div>
      </div>

      <!-- Quick Action Modules -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <router-link
          to="/housing"
          class="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-msu-maroon/30 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="w-10 h-10 rounded-lg bg-red-100 text-msu-maroon flex items-center justify-center mb-3">
              <Building2 class="w-5 h-5" />
            </div>
            <h3 class="font-bold text-slate-900 group-hover:text-msu-maroon transition-colors">
              Housing Directory
            </h3>
            <p class="text-xs text-slate-600 mt-1">
              Search institutional dorms and accredited private boarding houses with fair rate guidelines.
            </p>
          </div>
          <div class="flex items-center text-xs font-semibold text-msu-maroon mt-4">
            <span>Explore listings</span>
            <ArrowUpRight class="w-4 h-4 ml-1" />
          </div>
        </router-link>

        <router-link
          to="/billing"
          class="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-msu-maroon/30 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <Receipt class="w-5 h-5" />
            </div>
            <h3 class="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              Billing & Utility Splitting
            </h3>
            <p class="text-xs text-slate-600 mt-1">
              View immutable ledger, calculate shared water/power, and record offline payments.
            </p>
          </div>
          <div class="flex items-center text-xs font-semibold text-emerald-700 mt-4">
            <span>Manage billing</span>
            <ArrowUpRight class="w-4 h-4 ml-1" />
          </div>
        </router-link>

        <router-link
          to="/gigs"
          class="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-msu-maroon/30 transition-all flex flex-col justify-between"
        >
          <div>
            <div class="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
              <Briefcase class="w-5 h-5" />
            </div>
            <h3 class="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              Student Gig Board
            </h3>
            <p class="text-xs text-slate-600 mt-1">
              Post help-wanted micro jobs or accept errands to support the campus student economy.
            </p>
          </div>
          <div class="flex items-center text-xs font-semibold text-amber-700 mt-4">
            <span>Open marketplace</span>
            <ArrowUpRight class="w-4 h-4 ml-1" />
          </div>
        </router-link>
      </div>
    </div>
  </AppLayout>
</template>
