<script setup lang="ts">
import { ref } from 'vue';
import {
  X,
  MapPin,
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  Wrench,
  Camera,
} from 'lucide-vue-next';
import { MaintenanceTicket } from '../../types';

const props = defineProps<{
  ticket: MaintenanceTicket | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedPhoto = ref<string | null>(null);
</script>

<template>
  <div
    v-if="isOpen && ticket"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
    >
      <!-- HEADER -->
      <div class="bg-gradient-to-r from-msu-maroon to-msu-darkmaroon p-5 text-white flex items-center justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded">
              {{ ticket.category }}
            </span>
            <span
              :class="[
                ticket.status === 'resolved' ? 'bg-emerald-500 text-white' :
                ticket.status === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-amber-400 text-amber-950',
                'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full'
              ]"
            >
              {{ ticket.status.replace('_', ' ') }}
            </span>
          </div>
          <h2 class="text-base sm:text-lg font-bold mt-1.5 leading-tight">{{ ticket.title }}</h2>
        </div>

        <button
          @click="emit('close')"
          class="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- BODY -->
      <div class="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
        <!-- Location & Urgency Grid -->
        <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Property & Unit</span>
            <div class="font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
              <MapPin class="w-3.5 h-3.5 text-msu-maroon flex-shrink-0" />
              <span>{{ ticket.property?.name || 'MSU Residence' }} {{ ticket.unit ? `• ${ticket.unit.roomNumber}` : '' }}</span>
            </div>
          </div>

          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Urgency</span>
            <div class="font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
              <Clock class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span class="uppercase font-bold">{{ ticket.priority }}</span>
            </div>
          </div>

          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Reported Date</span>
            <div class="font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
              <Calendar class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span>{{ new Date(ticket.createdAt).toLocaleString() }}</span>
            </div>
          </div>

          <div>
            <span class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Reporter</span>
            <div class="font-semibold text-slate-800 flex items-center space-x-1 mt-0.5">
              <User class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span>{{ ticket.reporter?.fullName || 'Resident' }}</span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">Issue Details</label>
          <div class="bg-white p-3.5 rounded-xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
            {{ ticket.description }}
          </div>
        </div>

        <!-- Resolution Notes if any -->
        <div v-if="ticket.resolutionNotes" class="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-900">
          <div class="font-bold flex items-center space-x-1.5 mb-1">
            <CheckCircle class="w-4 h-4 text-emerald-600" />
            <span>Staff Resolution Notes</span>
          </div>
          <p class="text-slate-700">{{ ticket.resolutionNotes }}</p>
        </div>

        <!-- Photo Evidence Gallery -->
        <div v-if="ticket.photoUrls && ticket.photoUrls.length > 0">
          <label class="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center space-x-1">
            <Camera class="w-3.5 h-3.5 text-slate-600" />
            <span>Attached Photo Evidence ({{ ticket.photoUrls.length }})</span>
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div
              v-for="(photo, index) in ticket.photoUrls"
              :key="index"
              @click="selectedPhoto = photo"
              class="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            >
              <img :src="photo" alt="Ticket photo evidence" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold">
                View Full
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button
          @click="emit('close')"
          class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-5 py-2 rounded-xl transition-colors"
        >
          Close
        </button>
      </div>
    </div>

    <!-- LIGHTBOX MODAL FOR ZOOMED PHOTO -->
    <div
      v-if="selectedPhoto"
      @click="selectedPhoto = null"
      class="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
    >
      <div class="relative max-w-3xl max-h-[90vh]">
        <img :src="selectedPhoto" alt="Zoomed evidence" class="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
        <button
          @click.stop="selectedPhoto = null"
          class="absolute -top-3 -right-3 bg-white text-slate-900 rounded-full p-1.5 shadow-lg hover:bg-slate-100"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>
