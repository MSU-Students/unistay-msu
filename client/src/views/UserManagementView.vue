<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useUsersStore } from '../stores/users';
import type { UserData } from '../stores/users';
import type { User, UserRole } from '../types';
import { Plus, Pencil, X } from 'lucide-vue-next';

const usersStore = useUsersStore();
const isModalOpen = ref(false);
const editingUser = ref<User | null>(null);
const errorMessage = ref('');
const saving = ref(false);
const form = reactive<UserData>({
  email: '',
  fullName: '',
  role: 'student',
  college: '',
  course: '',
  studentIdNumber: '',
  phoneNumber: '',
});

const roles: { value: UserRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'university_admin', label: 'University Admin' },
];

function resetForm() {
  Object.assign(form, {
    email: '',
    fullName: '',
    role: 'student',
    college: '',
    course: '',
    studentIdNumber: '',
    phoneNumber: '',
  });
  editingUser.value = null;
  errorMessage.value = '';
}

function openCreateModal() {
  resetForm();
  isModalOpen.value = true;
}

function openEditModal(user: User) {
  resetForm();
  editingUser.value = user;
  Object.assign(form, {
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    college: user.college || '',
    course: user.course || '',
    studentIdNumber: user.studentIdNumber || '',
    phoneNumber: user.phoneNumber || '',
  });
  isModalOpen.value = true;
}

function buildPayload(): UserData {
  return {
    email: form.email.trim(),
    fullName: form.fullName.trim(),
    role: form.role,
    college: form.college?.trim() || undefined,
    course: form.course?.trim() || undefined,
    studentIdNumber: form.studentIdNumber?.trim() || undefined,
    phoneNumber: form.phoneNumber?.trim() || undefined,
  };
}

async function submitForm() {
  saving.value = true;
  errorMessage.value = '';
  try {
    const payload = buildPayload();
    if (editingUser.value) {
      await usersStore.updateUser(editingUser.value.id, payload);
    } else {
      await usersStore.createUser(payload);
    }
    isModalOpen.value = false;
  } catch {
    errorMessage.value = 'Unable to save the user. Please try again.';
  } finally {
    saving.value = false;
  }
}

async function handleRoleChange(user: User, event: Event) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;

  errorMessage.value = '';
  try {
    await usersStore.assignRole(user.id, select.value as UserRole);
  } catch {
    select.value = user.role;
    errorMessage.value = `Unable to update the role for ${user.fullName}.`;
  }
}

async function handleStatusToggle(user: User) {
  errorMessage.value = '';
  try {
    await usersStore.toggleStatus(user.id, !user.isActive);
  } catch {
    errorMessage.value = `Unable to update the status for ${user.fullName}.`;
  }
}

onMounted(async () => {
  try {
    await usersStore.fetchUsers();
  } catch {
    errorMessage.value = 'Unable to load users. Please refresh and try again.';
  }
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">User Management</h1>
          <p class="mt-1 text-sm text-slate-600">Create and manage campus user accounts.</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-msu-darkmaroon"
          @click="openCreateModal"
        >
          <Plus class="h-4 w-4" />
          Add User
        </button>
      </div>

      <p v-if="errorMessage" role="alert" class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ errorMessage }}
      </p>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3 font-semibold">Name</th>
              <th class="px-4 py-3 font-semibold">Email</th>
              <th class="px-4 py-3 font-semibold">Role</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">College</th>
              <th class="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="usersStore.loading">
              <td colspan="6" class="px-4 py-8 text-center text-slate-500">Loading users...</td>
            </tr>
            <tr v-else-if="usersStore.users.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-slate-500">No users found.</td>
            </tr>
            <tr v-for="user in usersStore.users" :key="user.id" class="text-slate-700">
              <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{{ user.fullName }}</td>
              <td class="whitespace-nowrap px-4 py-3">{{ user.email }}</td>
              <td class="px-4 py-3">
                <select
                  :value="user.role"
                  :aria-label="`Role for ${user.fullName}`"
                  class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  @change="handleRoleChange(user, $event)"
                >
                  <option v-for="role in roles" :key="role.value" :value="role.value">
                    {{ role.label }}
                  </option>
                </select>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="user.isActive === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'"
                  class="rounded-full px-2.5 py-1 text-xs font-semibold"
                >
                  {{ user.isActive === false ? 'Inactive' : 'Active' }}
                </span>
              </td>
              <td class="px-4 py-3">{{ user.college || '—' }}</td>
              <td class="whitespace-nowrap px-4 py-3">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-msu-maroon hover:bg-red-50"
                    @click="openEditModal(user)"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    :class="user.isActive === false ? 'text-emerald-700 hover:bg-emerald-50' : 'text-red-700 hover:bg-red-50'"
                    class="rounded-md px-2 py-1.5 text-xs font-semibold"
                    @click="handleStatusToggle(user)"
                  >
                    {{ user.isActive === false ? 'Activate' : 'Deactivate' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
      @click.self="isModalOpen = false"
    >
      <section
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'user-form-title'"
        class="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
      >
        <div class="mb-5 flex items-center justify-between">
          <h2 id="user-form-title" class="text-lg font-bold text-slate-900">
            {{ editingUser ? 'Edit User' : 'Add User' }}
          </h2>
          <button
            type="button"
            aria-label="Close form"
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            @click="isModalOpen = false"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="submitForm">
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="space-y-1 text-sm font-medium text-slate-700">
              Full name
              <input v-model="form.fullName" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-sm font-medium text-slate-700">
              Email
              <input v-model="form.email" type="email" required class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-sm font-medium text-slate-700">
              Role
              <select v-model="form.role" required class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option>
              </select>
            </label>
            <label class="space-y-1 text-sm font-medium text-slate-700">
              College
              <input v-model="form.college" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-sm font-medium text-slate-700">
              Course
              <input v-model="form.course" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-sm font-medium text-slate-700">
              Student ID number
              <input v-model="form.studentIdNumber" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label class="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Phone number
              <input v-model="form.phoneNumber" type="tel" class="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <p v-if="errorMessage" role="alert" class="text-sm text-red-700">{{ errorMessage }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="isModalOpen = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving"
              class="rounded-lg bg-msu-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-msu-darkmaroon disabled:opacity-60"
            >
              {{ saving ? 'Saving...' : 'Save User' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </AppLayout>
</template>
