<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useMaintenanceStore } from '../stores/maintenance';
import { useHousingStore } from '../stores/housing';
import {
  Wrench,
  AlertCircle,
  Plus,
  Camera,
  MapPin,
  Building2,
  Trash,
  Loader2,
} from 'lucide-vue-next';

const maintStore = useMaintenanceStore();
const housingStore = useHousingStore();

const showCreateForm = ref(false);
const title = ref('');
const description = ref('');
const category = ref<'plumbing' | 'electrical' | 'sanitation' | 'carpentry' | 'other'>('plumbing');
const priority = ref<'low' | 'medium' | 'high' | 'urgent'>('medium');
const photos = ref<{ file?: File; previewUrl: string }[]>([]);
const isSubmitting = ref(false);
const feedback = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

onMounted(() => {
  maintStore.fetchTickets();
  maintStore.fetchOutages();
  if (!housingStore.residence) {
    housingStore.fetchMyResidence();
  }
});

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files) return;

  const filesArray = Array.from(target.files);
  for (const file of filesArray) {
    if (photos.value.length >= 5) break;
    const previewUrl = URL.createObjectURL(file);
    photos.value.push({ file, previewUrl });
  }
  target.value = '';
}

function removePhoto(index: number) {
  const item = photos.value[index];
  if (item && item.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(item.previewUrl);
  }
  photos.value.splice(index, 1);
}

async function handleSubmitTicket() {
  errorMessage.value = null;

  if (!title.value.trim() || !description.value.trim()) {
    errorMessage.value = 'Please provide both an issue title and description.';
    return;
  }

  isSubmitting.value = true;

  try {
    // 1. Upload photos if any
    const uploadedUrls: string[] = [];
    for (const p of photos.value) {
      if (p.file) {
        const url = await maintStore.uploadPhoto(p.file);
        uploadedUrls.push(url);
      }
    }

    // 2. Submit ticket linked automatically to assigned residence
    const res = await maintStore.createTicket({
      title: title.value.trim(),
      description: description.value.trim(),
      category: category.value,
      priority: priority.value,
      propertyId: housingStore.residence?.property.id || '',
      unitId: housingStore.residence?.unit.id,
      photoUrls: uploadedUrls,
    });

    // 3. Reset form
    showCreateForm.value = false;
    title.value = '';
    description.value = '';
    category.value = 'plumbing';
    priority.value = 'medium';
    photos.value = [];

    // 4. Confirmation notice
    feedback.value = res.online
      ? `Maintenance ticket #${res.ticket.id.substring(0, 8)} submitted successfully with status OPEN.`
      : res.message || 'Maintenance ticket saved offline in Dexie queue with status OPEN.';
  } catch (err: any) {
    errorMessage.value = err?.message || 'Failed to submit maintenance request.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- HEADER -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Maintenance & Sanitation Desk</h1>
          <p class="text-xs text-slate-600">
            Submit photo-documented repair requests for issues in your assigned unit.
          </p>
        </div>

        <button
          @click="showCreateForm = !showCreateForm"
          class="bg-msu-maroon hover:bg-msu-darkmaroon text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>{{ showCreateForm ? 'Close Form' : 'File Repair Ticket' }}</span>
        </button>
      </div>

      <!-- CONFIRMATION FEEDBACK BANNER (Students receive confirmation after submission) -->
      <div
        v-if="feedback"
        class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between"
      >
        <div class="flex items-center space-x-2">
          <CheckCircle2 class="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{{ feedback }}</span>
        </div>
        <button @click="feedback = null" class="font-bold underline text-xs">Dismiss</button>
      </div>

      <!-- OUTAGE ALERT BANNER IF ACTIVE -->
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

      <!-- IN-PAGE TICKET FORM (NOT A MODAL, matching Student Gig Board pattern) -->
      <div
        v-if="showCreateForm"
        class="bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-4"
      >
        <h2 class="font-bold text-sm text-slate-900">New Maintenance Ticket</h2>

        <div v-if="errorMessage" class="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
          {{ errorMessage }}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <!-- Issue Title -->
          <div>
            <label class="block font-medium text-slate-700 mb-1">Issue Title</label>
            <input
              v-model="title"
              placeholder="e.g. Broken water pipe valve under sink"
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon h-[38px]"
            />
          </div>

          <!-- Property Name Field -->
          <div>
            <label class="block font-medium text-slate-700 mb-1">Property</label>
            <div class="flex items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 font-medium space-x-1.5 h-[38px]">
              <Building2 class="w-4 h-4 text-msu-maroon flex-shrink-0" />
              <span class="truncate">{{ housingStore.residence?.property?.name || 'Alumni Residence Hall' }}</span>
              <span v-if="housingStore.residence?.unit" class="text-slate-500 font-normal truncate">
                — {{ housingStore.residence.unit.roomNumber }}
              </span>
            </div>
          </div>

          <!-- Enum Dropdown: Category -->
          <div>
            <label class="block font-medium text-slate-700 mb-1">Category</label>
            <select
              v-model="category"
              class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-msu-maroon h-[38px]"
            >
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="sanitation">Sanitation</option>
              <option value="carpentry">Carpentry</option>
              <option value="other">Other</option>
            </select>
          </div>

          <!-- Enum Dropdown: Urgency / Priority -->
          <div>
            <label class="block font-medium text-slate-700 mb-1">Urgency</label>
            <select
              v-model="priority"
              class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-msu-maroon h-[38px]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <!-- Description -->
          <div class="sm:col-span-2">
            <label class="block font-medium text-slate-700 mb-1">Description</label>
            <textarea
              v-model="description"
              rows="3"
              placeholder="Describe the issue in your unit..."
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
            ></textarea>
          </div>

          <!-- Photo Attachments -->
          <div class="sm:col-span-2">
            <label class="block font-medium text-slate-700 mb-1">Attach Photos (Optional)</label>
            <div class="flex items-center space-x-3">
              <label class="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded border border-slate-300 flex items-center space-x-1.5 transition-colors">
                <Camera class="w-4 h-4 text-msu-maroon" />
                <span>Choose Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  @change="handleFileSelect"
                  class="hidden"
                />
              </label>
              <span class="text-[11px] text-slate-500">Max 5 photos (PNG, JPG, WEBP)</span>
            </div>

            <!-- Preview Strip -->
            <div v-if="photos.length > 0" class="flex flex-wrap gap-2 mt-2">
              <div
                v-for="(photo, index) in photos"
                :key="index"
                class="relative group w-14 h-14 rounded border border-slate-200 overflow-hidden"
              >
                <img :src="photo.previewUrl" alt="Thumbnail" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="removePhoto(index)"
                  class="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash class="w-3.5 h-3.5 text-red-300" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Form Action Buttons -->
        <div class="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            @click="showCreateForm = false"
            :disabled="isSubmitting"
            class="text-xs text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleSubmitTicket"
            :disabled="isSubmitting"
            class="bg-msu-maroon hover:bg-msu-darkmaroon text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isSubmitting ? 'Submitting...' : 'Submit Ticket' }}</span>
          </button>
        </div>
      </div>

      <!-- TICKETS GRID (OLD UI / GIG BOARD STYLE - NO FILTERING OR CATEGORY DROPDOWN) -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-if="!maintStore.isInitialLoaded && maintStore.tickets.length === 0"
          class="col-span-full bg-white p-8 text-center rounded-xl border text-slate-400 text-xs"
        >
          Loading maintenance tickets...
        </div>

        <div
          v-else-if="maintStore.tickets.length === 0"
          class="col-span-full bg-white p-8 text-center rounded-xl border text-slate-400 text-xs"
        >
          No maintenance tickets logged yet.
        </div>

        <div
          v-for="ticket in maintStore.tickets"
          :key="ticket.id"
          class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {{ ticket.category }}
              </span>
              <span
                :class="[
                  ticket.status === 'resolved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : ticket.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-amber-100 text-amber-800',
                  'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full'
                ]"
              >
                {{ ticket.status ? ticket.status.replace('_', ' ') : 'open' }}
              </span>
            </div>

            <!-- Issue Title  -->
            <h3 class="font-bold text-slate-900 text-sm">{{ ticket.title }}</h3>
            <span class="text-[11px] font-medium text-slate-600 flex items-center flex-shrink-0 mt-1">
              <Building2 class="w-3 h-3 mr-1 text-msu-maroon flex-shrink-0" />
              <span>{{ ticket.property?.name || 'Assigned Property' }}{{ ticket.unit ? ` • ${ticket.unit.roomNumber}` : '' }}</span>
            </span>
            <p class="text-xs text-slate-600 mt-1 line-clamp-3">{{ ticket.description }}</p>

            <!-- Attached photo previews if any -->
            <div
              v-if="ticket.photoUrls && ticket.photoUrls.length > 0"
              class="flex gap-1.5 mt-2.5 overflow-x-auto pb-1"
            >
              <img
                v-for="(photo, idx) in ticket.photoUrls"
                :key="idx"
                :src="photo"
                alt="Ticket photo"
                class="w-10 h-10 object-cover rounded border border-slate-200 flex-shrink-0"
              />
            </div>
          </div>

          <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Priority: <strong class="uppercase text-slate-700">{{ ticket.priority }}</strong></span>
            <span>{{ ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'Just now' }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
