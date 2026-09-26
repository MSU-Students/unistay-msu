<script setup lang="ts">
import Navbar from './Navbar.vue';
import Sidebar from './Sidebar.vue';
import OfflineBanner from './OfflineBanner.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 text-slate-900">
    <OfflineBanner />
    <Navbar />
    <div class="flex flex-1">
      <Sidebar class="hidden md:flex flex-shrink-0" />
      <main class="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <slot />
      </main>
    </div>
  </div>
</template>
