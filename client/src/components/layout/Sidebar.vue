
<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import {
  LayoutDashboard,
  Building2,
  BarChart3,
  FileText,
  ClipboardList,
  Receipt,
  Wrench,
  CalendarDays,
  Briefcase,
  ClipboardCheck,
} from 'lucide-vue-next';

const route = useRoute();
const authStore = useAuthStore();

const navigation = computed(() =>
  [
    {
      name: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      studentOnly: false,
      adminOnly: false,
    },
    {
      name: 'Housing Directory',
      path: '/housing',
      icon: Building2,
      studentOnly: false,
      adminOnly: false,
    },
    {
      name: 'Application Reports',
      path: '/admin/housing/application-reports',
      icon: BarChart3,
      reportsAccess: true,
    },
    {
      name: 'Billing & Utilities',
      path: '/billing',
      icon: Receipt,
      studentOnly: false,
      adminOnly: false,
    },
    {
      name: 'Maintenance Desk',
      path: '/maintenance',
      icon: Wrench,
      studentOnly: false,
      adminOnly: false,
    },
    {
      name: 'Facility Bookings',
      path: '/facilities',
      icon: CalendarDays,
      studentOnly: false,
      adminOnly: false,
    },
    {
      name: 'Student Gig Board',
      path: '/gigs',
      icon: Briefcase,
      studentOnly: false,
      adminOnly: false,
    },
    {
      name: 'Housing Application',
      path: '/housing/apply',
      icon: ClipboardList,
      studentOnly: true,
    },
    {
      name: 'Applications Review',
      path: '/applications/review',
      icon: ClipboardCheck,
      reviewAccess: true,
    },
  ].filter((item) => {
    const entry = item as {
      studentOnly?: boolean;
      adminOnly?: boolean;
      reportsAccess?: boolean;
      reviewAccess?: boolean;
    };

    return (
      (!entry.studentOnly || authStore.isStudent) &&
      (!entry.adminOnly || authStore.isAdmin) &&
      (!entry.reportsAccess ||
        authStore.isAdmin ||
        authStore.isManager) &&
      (!entry.reviewAccess ||
        authStore.isAdmin ||
        authStore.isManager)
    );
  }),
);
</script>

<template>
  <aside
    class="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-57px)] flex flex-col p-4 border-r border-slate-800"
  >
    <div class="text-xs font-bold uppercase tracking-wider text-slate-400 px-3 mb-3">
      Main Modules
    </div>

    <nav class="space-y-1">
      <router-link
        v-for="item in navigation"
        :key="item.path"
        :to="item.path"
        :class="[
          route.path === item.path ||
          (item.path === '/applications/review' &&
            route.path.startsWith('/applications/review'))
            ? 'bg-msu-maroon text-white font-semibold'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white',
          'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
        ]"
      >
        <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
        <span>{{ item.name }}</span>
      </router-link>
    </nav>

    <div class="mt-auto pt-6 border-t border-slate-800 text-xs text-slate-400 px-3">
      <div class="font-semibold text-slate-300">MSU Offline-First Engine</div>
      <div>IndexedDB Dexie.js v4</div>
      <div class="mt-2 text-[10px] text-slate-400">© 2026 MSU Marawi</div>
    </div>
  </aside>
</template>