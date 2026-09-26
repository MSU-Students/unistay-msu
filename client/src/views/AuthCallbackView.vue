<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

onMounted(async () => {
  const token = route.query.token as string;
  const userParam = route.query.user as string;

  if (token && userParam) {
    try {
      const user = JSON.parse(decodeURIComponent(userParam));
      await authStore.setSession(token, user);
      router.push({ name: 'dashboard' });
    } catch (err) {
      console.error('Failed to parse auth payload:', err);
      router.push({ name: 'login' });
    }
  } else {
    router.push({ name: 'login' });
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm">
    <div class="text-center space-y-2">
      <div class="w-8 h-8 border-2 border-msu-maroon border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="font-medium">Finalizing MSU authentication...</p>
    </div>
  </div>
</template>
