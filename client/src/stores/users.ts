import { defineStore } from 'pinia';
import { ref } from 'vue';
import { User, UserRole } from '../types';
import apiClient from '../api/client';

export interface UserData {
  email: string;
  fullName: string;
  role: UserRole;
  college?: string;
  course?: string;
  studentIdNumber?: string;
  phoneNumber?: string;
}

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>([]);
  const loading = ref<boolean>(false);

  async function fetchUsers() {
    loading.value = true;
    try {
      const response = await apiClient.get('/users');
      users.value = response.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function createUser(data: UserData): Promise<User> {
    const response = await apiClient.post('/users', data);
    const user: User = response.data.data;
    users.value.push(user);
    return user;
  }

  async function updateUser(id: string, data: Partial<UserData>): Promise<User> {
    const response = await apiClient.patch(`/users/${id}`, data);
    const user: User = response.data.data;
    const index = users.value.findIndex((item) => item.id === id);
    if (index !== -1) users.value[index] = user;
    return user;
  }

  async function toggleStatus(id: string, isActive: boolean): Promise<User> {
    const response = await apiClient.patch(`/users/${id}/status`, { isActive });
    const user: User = response.data.data;
    const index = users.value.findIndex((item) => item.id === id);
    if (index !== -1) users.value[index] = user;
    return user;
  }

  async function assignRole(id: string, role: UserRole): Promise<User> {
    const response = await apiClient.patch(`/users/${id}/role`, { role });
    const user: User = response.data.data;
    const index = users.value.findIndex((item) => item.id === id);
    if (index !== -1) users.value[index] = user;
    return user;
  }

  return {
    users,
    loading,
    fetchUsers,
    createUser,
    updateUser,
    toggleStatus,
    assignRole,
  };
});
