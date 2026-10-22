<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import { Search, MapPin, Building, ShieldCheck, CheckCircle, Users, Plus, Minus } from 'lucide-vue-next';

const housingStore = useHousingStore();
const searchQuery = ref('');
const filterType = ref('');

onMounted(() => {
  housingStore.fetchProperties();
});

// Handle property approval action
const handleApprove = async (id: string) => {
  const prop = housingStore.properties.find((p: any) => p.id === id);
  if (prop) prop.isAccredited = true;
};

// Handle slot adjustments for occupancy tracking
const updateSlots = (prop: any, change: number) => {
  if (!prop.availableSlots) prop.availableSlots = prop.totalSlots || 10;
  if (!prop.totalSlots) prop.totalSlots = 20;
  
  const newSlots = prop.availableSlots + change;
  if (newSlots >= 0 && newSlots <= prop.totalSlots) {
    prop.availableSlots = newSlots;
  }
};
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Housing & Dormitory Directory</h1>
          <p class="text-xs text-slate-600">Institutional dormitories and accredited private boarding houses inside MSU campus with live occupancy tracking.</p>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div class="relative flex-1">
          <Search class="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search dormitories, proximity to CNSM, CBAA, Law..."
            class="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-msu-maroon/20 focus:border-msu-maroon"
          />
        </div>

        <select
          v-model="filterType"
          @change="housingStore.fetchProperties({ type: filterType || undefined })"
          class="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-msu-maroon/20"
        >
          <option value="">All Housing Types</option>
          <option value="institutional_dorm">Institutional Dormitories</option>
          <option value="private_boarding_house">Private Boarding Houses</option>
        </select>
      </div>

      <!-- Properties Grid -->
      <div v-if="housingStore.loading" class="text-center py-12 text-slate-500">
        Loading housing directory from cache/server...
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="prop in housingStore.properties"
          :key="prop.id"
          class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
        >
          <div class="h-40 bg-slate-200 relative flex items-center justify-center text-slate-400">
            <Building class="w-12 h-12" />
            <span
              v-if="prop.isAccredited"
              class="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center space-x-1"
            >
              <ShieldCheck class="w-3 h-3 mr-0.5" />
              Published
            </span>
            <span
              v-else
              class="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            >
              Pending Approval
            </span>
          </div>

          <div class="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center">
                <span class="text-xs font-semibold text-msu-maroon uppercase tracking-wider">
                  {{ prop.type === 'institutional_dorm' ? 'Institutional Dorm' : 'Private Boarding House' }}
                </span>
                
                <!-- Live Occupancy Badge -->
                <span 
                  :class="(prop.availableSlots ?? 5) === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'"
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                >
                  <Users class="w-3 h-3" />
                  {{ (prop.availableSlots ?? 5) === 0 ? 'Fully Booked' : `${prop.availableSlots ?? 5} slots left` }}
                </span>
              </div>

              <h2 class="text-base font-bold text-slate-900 mt-0.5">{{ prop.name }}</h2>
              <div class="flex items-center text-xs text-slate-500 mt-1">
                <MapPin class="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>{{ prop.address }}</span>
              </div>
              <p class="text-xs text-slate-600 mt-2 line-clamp-2">{{ prop.description }}</p>

              <!-- Manager Slot Controls -->
              <div class="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <span class="font-medium text-slate-700">Manager Slot Control:</span>
                <div class="flex items-center space-x-1">
                  <button 
                    @click="updateSlots(prop, -1)" 
                    class="w-6 h-6 bg-white border border-slate-300 rounded flex items-center justify-center hover:bg-slate-100 font-bold"
                  >-</button>
                  <span class="px-2 font-bold text-slate-900">{{ prop.availableSlots ?? 5 }} / {{ prop.totalSlots ?? 20 }}</span>
                  <button 
                    @click="updateSlots(prop, 1)" 
                    class="w-6 h-6 bg-white border border-slate-300 rounded flex items-center justify-center hover:bg-slate-100 font-bold"
                  >+</button>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase">Monthly Rate</span>
                <div class="font-bold text-slate-900 text-sm">
                  ₱{{ prop.minMonthlyRate }} - ₱{{ prop.maxMonthlyRate }}
                </div>
              </div>

              <div class="flex gap-2">
                <!-- Approve Button -->
                <button
                  v-if="!prop.isAccredited"
                  @click="handleApprove(prop.id)"
                  class="bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >
                  <CheckCircle class="w-3.5 h-3.5" /> Approve
                </button>

                <!-- Apply Now Button (Disabled if Fully Booked) -->
                <button
                  :disabled="(prop.availableSlots ?? 5) === 0"
                  @click="housingStore.submitApplication(prop.id)"
                  :class="(prop.availableSlots ?? 5) === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-msu-maroon hover:bg-msu-darkmaroon'"
                  class="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  {{ (prop.availableSlots ?? 5) === 0 ? 'Full' : 'Apply Now' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>