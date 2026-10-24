<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useMaintenanceStore } from '../stores/maintenance';
import { useAuthStore } from '../stores/auth';
import { TicketStatus } from '../types';
import { AlertCircle, Plus } from 'lucide-vue-next';

const maintStore = useMaintenanceStore();
const authStore = useAuthStore();

const showCreateModal = ref(false);
const title = ref('');
const description = ref('');
const category = ref('plumbing');
const priority = ref('medium');
const propertyId = ref('');
const message = ref<string | null>(null);
const messageIsError = ref(false);
const isManager = computed(
  () => authStore.user?.role === 'property_manager' || authStore.user?.role === 'university_admin',
);
const ticketDrafts = reactive<Record<string, {
  status: TicketStatus;
  assignedToName: string;
  note: string;
  resolutionNotes: string;
}>>({});

function initializeTicketDrafts() {
  for (const ticket of maintStore.tickets) {
    ticketDrafts[ticket.id] = {
      status: ticket.status,
      assignedToName: ticket.assignedToName || '',
      note: '',
      resolutionNotes: ticket.resolutionNotes || '',
    };
  }
}

onMounted(async () => {
  await maintStore.fetchTickets();
  initializeTicketDrafts();
  maintStore.fetchOutages();
});

async function handleSubmitTicket() {
  if (!title.value || !description.value) return;
  const res = await maintStore.createTicket({
    title: title.value,
    description: description.value,
    category: category.value,
    priority: priority.value,
    propertyId: propertyId.value || 'mock-prop-id',
  });
  showCreateModal.value = false;
  title.value = '';
  description.value = '';
  message.value = res.online
    ? 'Maintenance ticket submitted successfully.'
    : res.message || 'Ticket saved offline in Dexie queue.';
  await maintStore.fetchTickets();
  initializeTicketDrafts();
}

async function saveTicketUpdate(ticketId: string) {
  const draft = ticketDrafts[ticketId];
  if (!draft) return;

  try {
    await maintStore.updateTicket(ticketId, {
      status: draft.status,
      assignedToName: draft.assignedToName,
      note: draft.note,
      resolutionNotes: draft.resolutionNotes,
    });
    initializeTicketDrafts();
    message.value = 'Ticket updated successfully.';
    messageIsError.value = false;
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to update the ticket.';
    messageIsError.value = true;
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Maintenance & Sanitation Desk</h1>
          <p class="text-xs text-slate-600">Photo-documented repair requests and campus-wide utility status reports.</p>
        </div>

        <button
          @click="showCreateModal = !showCreateModal"
          class="bg-msu-maroon hover:bg-msu-darkmaroon text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>File Repair Ticket</span>
        </button>
      </div>

      <div
        v-if="message"
        :class="messageIsError
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'"
        class="border p-3 rounded-lg text-xs flex items-center justify-between"
      >
        <span>{{ message }}</span>
        <button @click="message = null" class="font-bold underline">Dismiss</button>
      </div>

      <!-- Outage Alert Banner if active -->
      <div v-if="maintStore.outages.length > 0" class="space-y-2">
        <div
          v-for="outage in maintStore.outages"
          :key="outage.id"
          class="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg text-amber-900 text-xs"
        >
          <div class="font-bold flex items-center space-x-1.5">
            <AlertCircle class="w-4 h-4 text-amber-600" />
            <span>Campus Utility Outage: {{ outage.utilityType }} ({{ outage.affectedArea }})</span>
          </div>
          <p class="mt-1 text-slate-700">{{ outage.message }}</p>
        </div>
      </div>

      <!-- Modal / New Ticket Form -->
      <div v-if="showCreateModal" class="bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-4">
        <h2 class="font-bold text-sm text-slate-900">New Maintenance Ticket (Offline Supported)</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label class="block font-medium text-slate-700 mb-1">Issue Title</label>
            <input
              v-model="title"
              placeholder="e.g. Broken faucet in Room 204"
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
            />
          </div>
          <div>
            <label class="block font-medium text-slate-700 mb-1">Category</label>
            <select
              v-model="category"
              class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none"
            >
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="sanitation">Sanitation</option>
              <option value="carpentry">Carpentry</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="block font-medium text-slate-700 mb-1">Description</label>
            <textarea
              v-model="description"
              rows="3"
              placeholder="Describe the issue in detail..."
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 pt-2">
          <button
            @click="showCreateModal = false"
            class="text-xs text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded"
          >
            Cancel
          </button>
          <button
            @click="handleSubmitTicket"
            class="bg-msu-maroon text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-msu-darkmaroon transition-colors"
          >
            Submit Ticket
          </button>
        </div>
      </div>

      <!-- Tickets List -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-if="maintStore.tickets.length === 0" class="col-span-full bg-white p-8 text-center rounded-xl border text-slate-400 text-xs">
          No maintenance tickets logged yet.
        </div>

        <div
          v-for="ticket in maintStore.tickets"
          :key="ticket.id"
          class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {{ ticket.category }}
              </span>
              <span
                :class="[
                  ticket.status === 'resolved' || ticket.status === 'closed' ? 'bg-emerald-100 text-emerald-800' :
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  ticket.status === 'waiting_on_vendor' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800',
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full'
                ]"
              >
                {{ ticket.status.replace('_', ' ') }}
              </span>
            </div>
            <h3 class="font-bold text-slate-900 text-sm mt-2">{{ ticket.title }}</h3>
            <p class="text-xs text-slate-600 mt-1 line-clamp-3">{{ ticket.description }}</p>
            <p v-if="ticket.assignedToName" class="mt-2 text-xs text-slate-600">
              Assigned to: <strong class="text-slate-800">{{ ticket.assignedToName }}</strong>
            </p>
          </div>

          <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Priority: <strong class="uppercase text-slate-700">{{ ticket.priority }}</strong></span>
            <span>{{ new Date(ticket.createdAt).toLocaleDateString() }}</span>
          </div>

          <div v-if="isManager && ticketDrafts[ticket.id]" class="space-y-3 border-t border-slate-100 pt-3">
            <label class="block text-[11px] font-medium text-slate-700">
              Status
              <select
                v-model="ticketDrafts[ticket.id].status"
                class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_on_vendor">Waiting on vendor</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label class="block text-[11px] font-medium text-slate-700">
              Assigned vendor or technician
              <input
                v-model="ticketDrafts[ticket.id].assignedToName"
                placeholder="Name"
                class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
              />
            </label>
            <label class="block text-[11px] font-medium text-slate-700">
              Add note
              <textarea
                v-model="ticketDrafts[ticket.id].note"
                rows="2"
                placeholder="Progress update or internal note"
                class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
              ></textarea>
            </label>
            <label class="block text-[11px] font-medium text-slate-700">
              Resolution details
              <textarea
                v-model="ticketDrafts[ticket.id].resolutionNotes"
                rows="2"
                placeholder="How was the issue resolved?"
                class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
              ></textarea>
            </label>
            <button
              @click="saveTicketUpdate(ticket.id)"
              class="w-full rounded-lg bg-msu-maroon px-3 py-2 text-xs font-semibold text-white hover:bg-msu-darkmaroon"
            >
              Save ticket update
            </button>
          </div>

          <div v-if="ticket.resolutionNotes" class="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
            <p class="font-semibold">Resolution details</p>
            <p class="mt-1">{{ ticket.resolutionNotes }}</p>
          </div>

          <details v-if="ticket.activities?.length" class="border-t border-slate-100 pt-3">
            <summary class="cursor-pointer text-xs font-semibold text-slate-700">
              Ticket history ({{ ticket.activities.length }})
            </summary>
            <ol class="mt-2 space-y-2">
              <li
                v-for="activity in ticket.activities"
                :key="activity.id"
                class="border-l-2 border-slate-200 pl-2 text-[11px] text-slate-600"
              >
                <p class="font-medium text-slate-800">
                  {{ activity.actor?.fullName || 'User' }}
                  <span class="font-normal text-slate-400">
                    · {{ new Date(activity.createdAt).toLocaleString() }}
                  </span>
                </p>
                <p v-if="activity.status">Status: {{ activity.status.replaceAll('_', ' ') }}</p>
                <p v-if="activity.assignedToName">Assigned to: {{ activity.assignedToName }}</p>
                <p v-if="activity.note">{{ activity.note }}</p>
                <p v-if="activity.resolutionNotes">Resolution: {{ activity.resolutionNotes }}</p>
              </li>
            </ol>
          </details>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
