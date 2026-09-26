<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useHousingStore } from '../stores/housing';
import { Search, MapPin, CheckCircle2, Building, ShieldCheck } from 'lucide-vue-next';

const housingStore = useHousingStore();
const searchQuery = ref('');
const filterType = ref('');

onMounted(() => {
  housingStore.fetchProperties();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Housing & Dormitory Directory</h1>
          <p class="text-xs text-slate-600">Institutional dormitories and accredited private boarding houses inside MSU campus.</p>
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
        <!-- Default Starter Card if empty -->
        <div
          v-if="housingStore.properties.length === 0"
          class="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center"
        >
          <Building class="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 class="font-bold text-slate-800">No properties found</h3>
          <p class="text-xs text-slate-500 mt-1">Properties seeded from backend will appear here.</p>
        </div>

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
              Accredited
            </span>
          </div>

          <div class="p-5 flex-1 flex flex-col justify-between">
            <div>
              <div class="text-xs font-semibold text-msu-maroon uppercase tracking-wider">
                {{ prop.type === 'institutional_dorm' ? 'Institutional Dorm' : 'Private Boarding House' }}
              </div>
              <h2 class="text-base font-bold text-slate-900 mt-0.5">{{ prop.name }}</h2>
              <div class="flex items-center text-xs text-slate-500 mt-1">
                <MapPin class="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>{{ prop.address }}</span>
              </div>
              <p class="text-xs text-slate-600 mt-2 line-clamp-2">{{ prop.description }}</p>

              <!-- Amenities -->
              <div v-if="prop.amenities?.length" class="flex flex-wrap gap-1 mt-3">
                <span
                  v-for="amenity in prop.amenities.slice(0, 3)"
                  :key="amenity"
                  class="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded"
                >
                  {{ amenity }}
                </span>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase">Monthly Rate</span>
                <div class="font-bold text-slate-900 text-sm">
                  ₱{{ prop.minMonthlyRate }} - ₱{{ prop.maxMonthlyRate }}
                </div>
              </div>
              <button
                @click="housingStore.submitApplication(prop.id)"
                class="bg-msu-maroon text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-msu-darkmaroon transition-colors"
              >
                Apply Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
