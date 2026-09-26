import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { User, UserRole } from '../types';
import apiClient from '../api/client';
import { db } from '../db';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('unistay_token'));
  const user = ref<User | null>(
    localStorage.getItem('unistay_user')
      ? JSON.parse(localStorage.getItem('unistay_user')!)
      : null,
  );

  const isAuthenticated = computed(() => !!token.value);
  const isStudent = computed(() => user.value?.role === 'student');
  const isManager = computed(() => user.value?.role === 'property_manager');
  const isAdmin = computed(() => user.value?.role === 'university_admin');

  async function setSession(newToken: string, newUser: User) {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('unistay_token', newToken);
    localStorage.setItem('unistay_user', JSON.stringify(newUser));

    // Cache to Dexie for offline session retrieval
    await db.cachedProfile.put({
      key: 'current_session',
      user: newUser,
      token: newToken,
    });
  }

  async function devLogin(email: string, role: UserRole = 'student', fullName?: string) {
    const res = await apiClient.post('/auth/dev-login', {
      email,
      role,
      fullName: fullName || (role === 'student' ? 'MSU Student Scholar' : 'MSU Housing Manager'),
    });
    const { accessToken, user: authUser } = res.data.data;
    await setSession(accessToken, authUser);
    return authUser;
  }

  async function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('unistay_token');
    localStorage.removeItem('unistay_user');
    await db.cachedProfile.delete('current_session');
  }

  async function restoreOfflineSession() {
    if (!user.value) {
      const cached = await db.cachedProfile.get('current_session');
      if (cached) {
        token.value = cached.token;
        user.value = cached.user;
      }
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    isStudent,
    isManager,
    isAdmin,
    setSession,
    devLogin,
    logout,
    restoreOfflineSession,
  };
});
