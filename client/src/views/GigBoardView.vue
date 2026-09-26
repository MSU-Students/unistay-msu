<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppLayout from '../components/layout/AppLayout.vue';
import { useGigsStore } from '../stores/gigs';
import { Briefcase, Plus, DollarSign, MapPin, CheckCircle2 } from 'lucide-vue-next';

const gigsStore = useGigsStore();

const showPostModal = ref(false);
const title = ref('');
const description = ref('');
const category = ref('Delivery & Errands');
const compensation = ref(150);
const locationNote = ref('Commercial Center to Dorm 2');
const feedback = ref<string | null>(null);

onMounted(() => {
  gigsStore.fetchGigs();
});

async function handlePostGig() {
  if (!title.value || !description.value) return;
  await gigsStore.createGig({
    title: title.value,
    description: description.value,
    category: category.value,
    compensationAmount: compensation.value,
    locationNote: locationNote.value,
  });
  showPostModal.value = false;
  title.value = '';
  description.value = '';
  feedback.value = 'Gig posted on the MSU student marketplace!';
}

async function handleApply(gigId: string) {
  const res = await gigsStore.applyForGig(gigId, 'Available right away to fulfill this errand.');
  feedback.value = res.online
    ? 'Application submitted to the gig poster.'
    : res.message || 'Application queued offline in Dexie.';
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Student Gig Board</h1>
          <p class="text-xs text-slate-600">Micro-jobs engine connecting dorm residents with small errands and tasks to support the student economy.</p>
        </div>

        <button
          @click="showPostModal = !showPostModal"
          class="bg-msu-maroon hover:bg-msu-darkmaroon text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
        >
          <Plus class="w-4 h-4" />
          <span>Post a Micro-Job</span>
        </button>
      </div>

      <div v-if="feedback" class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
        <span>{{ feedback }}</span>
        <button @click="feedback = null" class="font-bold underline">Dismiss</button>
      </div>

      <!-- Post Gig Modal -->
      <div v-if="showPostModal" class="bg-white p-6 rounded-xl border border-slate-200 shadow-md space-y-4">
        <h2 class="font-bold text-sm text-slate-900">Create Help-Wanted Ad</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div class="sm:col-span-2">
            <label class="block font-medium text-slate-700 mb-1">Gig Title</label>
            <input
              v-model="title"
              placeholder="e.g. Laundry drop-off / CNSM library book return"
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-msu-maroon"
            />
          </div>

          <div>
            <label class="block font-medium text-slate-700 mb-1">Category</label>
            <select
              v-model="category"
              class="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none"
            >
              <option value="Delivery & Errands">Delivery & Errands</option>
              <option value="Laundry Assistance">Laundry Assistance</option>
              <option value="Academic Tutoring">Academic Tutoring</option>
              <option value="Room Cleaning">Room Cleaning</option>
            </select>
          </div>

          <div>
            <label class="block font-medium text-slate-700 mb-1">Compensation (₱)</label>
            <input
              v-model.number="compensation"
              type="number"
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="block font-medium text-slate-700 mb-1">Description & Requirements</label>
            <textarea
              v-model="description"
              rows="3"
              placeholder="Details of task..."
              class="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 pt-2">
          <button @click="showPostModal = false" class="text-xs text-slate-600 px-3 py-1.5 hover:bg-slate-100 rounded">Cancel</button>
          <button @click="handlePostGig" class="bg-msu-maroon text-white text-xs font-semibold px-4 py-2 rounded-lg">Post Gig</button>
        </div>
      </div>

      <!-- Gigs Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-if="gigsStore.gigs.length === 0" class="col-span-full bg-white p-8 text-center text-slate-400 text-xs rounded-xl border">
          No open student gigs currently available.
        </div>

        <div
          v-for="gig in gigsStore.gigs"
          :key="gig.id"
          class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                {{ gig.category }}
              </span>
              <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                ₱{{ gig.compensationAmount }}
              </span>
            </div>

            <h3 class="font-bold text-slate-900 text-sm mt-2">{{ gig.title }}</h3>
            <p class="text-xs text-slate-600 mt-1 line-clamp-3">{{ gig.description }}</p>

            <div v-if="gig.locationNote" class="flex items-center text-[11px] text-slate-500 mt-2">
              <MapPin class="w-3.5 h-3.5 mr-1 text-slate-400" />
              <span>{{ gig.locationNote }}</span>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-[11px] text-slate-400">
              Posted {{ new Date(gig.createdAt).toLocaleDateString() }}
            </span>
            <button
              v-if="gig.status === 'open'"
              @click="handleApply(gig.id)"
              class="bg-msu-maroon hover:bg-msu-darkmaroon text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Accept Gig
            </button>
            <span v-else class="text-xs font-semibold uppercase text-slate-400">{{ gig.status }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
