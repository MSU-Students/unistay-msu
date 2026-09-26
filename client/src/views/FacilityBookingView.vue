<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useFacilitiesStore } from '../stores/facilities';
import { CalendarDays, Clock, CheckCircle2, Car, Shirt, BookOpen } from 'lucide-vue-next';

const facStore = useFacilitiesStore();

const selectedFacilityId = ref('');
const startTime = ref('');
const endTime = ref('');
const message = ref<string | null>(null);

onMounted(() => {
  facStore.fetchFacilities();
  facStore.fetchMyBookings();
});

async function handleBook() {
  if (!selectedFacilityId.value || !startTime.value || !endTime.value) return;
  const res = await facStore.createBooking(
    selectedFacilityId.value,
    new Date(startTime.value).toISOString(),
    new Date(endTime.value).toISOString(),
  );
  message.value = res.online
    ? 'Reservation confirmed successfully!'
    : res.message || 'Reservation queued offline in Dexie.';
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Shared Facilities & Amenity Booking</h1>
        <p class="text-xs text-slate-600">Digital reservation engine for laundry hubs, parking slots, and study rooms to avoid conflicts.</p>
      </div>

      <div v-if="message" class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
        <span>{{ message }}</span>
        <button @click="message = null" class="font-bold underline">Dismiss</button>
      </div>

      <!-- Quick Reservation Form -->
      <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 class="font-bold text-sm text-slate-800 flex items-center space-x-2">
          <CalendarDays class="w-4 h-4 text-msu-maroon" />
          <span>New Amenity Reservation</span>
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label class="block font-medium text-slate-700 mb-1">Select Amenity</label>
            <select
              v-model="selectedFacilityId"
              class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none"
            >
              <option value="">Choose Facility...</option>
              <option v-for="f in facStore.facilities" :key="f.id" :value="f.id">
                {{ f.name }} ({{ f.type }})
              </option>
            </select>
          </div>

          <div>
            <label class="block font-medium text-slate-700 mb-1">Start Time</label>
            <input
              v-model="startTime"
              type="datetime-local"
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div>
            <label class="block font-medium text-slate-700 mb-1">End Time</label>
            <input
              v-model="endTime"
              type="datetime-local"
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none"
            />
          </div>
        </div>

        <button
          @click="handleBook"
          class="bg-msu-maroon hover:bg-msu-darkmaroon text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
        >
          Reserve Slot
        </button>
      </div>

      <!-- My Active Bookings -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h2 class="font-bold text-sm text-slate-800">My Active Reservations</h2>
        <div v-if="facStore.bookings.length === 0" class="text-xs text-slate-400 py-4 text-center">
          No facility bookings reserved currently.
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            v-for="b in facStore.bookings"
            :key="b.id"
            class="p-3 border rounded-lg flex items-center justify-between text-xs"
          >
            <div>
              <div class="font-bold text-slate-800">{{ b.facility?.name || 'Shared Amenity' }}</div>
              <div class="text-slate-500 text-[11px] mt-0.5">
                {{ new Date(b.startTime).toLocaleString() }} - {{ new Date(b.endTime).toLocaleTimeString() }}
              </div>
            </div>
            <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
              {{ b.status }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
