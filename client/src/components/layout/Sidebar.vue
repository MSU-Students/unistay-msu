<script setup lang="ts">
import { useRoute } from 'vue-router';
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Wrench,
  CalendarDays,
  Briefcase,
} from 'lucide-vue-next';

const route = useRoute();

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Housing Directory', path: '/housing', icon: Building2 },
  { name: 'Billing & Utilities', path: '/billing', icon: Receipt },
  { name: 'Maintenance Desk', path: '/maintenance', icon: Wrench },
  { name: 'Facility Bookings', path: '/facilities', icon: CalendarDays },
  { name: 'Student Gig Board', path: '/gigs', icon: Briefcase },
];
</script>

<template>
  <aside class="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-57px)] flex flex-col p-4 border-r border-slate-800">
    <div class="text-xs font-bold uppercase tracking-wider text-slate-400 px-3 mb-3">
      Main Modules
    </div>
    <nav class="space-y-1">
      <router-link
        v-for="item in navigation"
        :key="item.path"
        :to="item.path"
        :class="[
          route.path === item.path
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
