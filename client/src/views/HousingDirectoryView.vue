<script setup>
import { ref, computed } from 'vue'

const mockListings = ref([
  {
    id: 1,
    title: 'Spartan Village Studio Apartment',
    location: 'East Lansing',
    price: 650,
    roomType: 'Studio',
    bedrooms: 1,
    amenities: ['WiFi', 'Parking', 'Laundry'],
    available: true,
    publishedAt: '2026-10-15T10:00:00Z',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 2,
    title: 'Grand River 2BR Luxury Suite',
    location: 'Downtown Lansing',
    price: 1200,
    roomType: '2 Bedroom',
    bedrooms: 2,
    amenities: ['WiFi', 'Gym', 'Air Conditioning', 'Parking'],
    available: true,
    publishedAt: '2026-10-16T14:30:00Z',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 3,
    title: 'Cozy Shared Room near Campus',
    location: 'East Lansing',
    price: 450,
    roomType: 'Shared',
    bedrooms: 1,
    amenities: ['WiFi', 'Laundry'],
    available: false,
    publishedAt: '2026-10-12T08:00:00Z',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 4,
    title: 'Okemos Executive 3BR House',
    location: 'Okemos',
    price: 1800,
    roomType: '3+ Bedroom',
    bedrooms: 3,
    amenities: ['WiFi', 'Parking', 'Gym', 'Air Conditioning', 'Laundry'],
    available: true,
    publishedAt: '2026-10-17T09:15:00Z',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80'
  }
])

// Filter state variables
const searchLocation = ref('')
const selectedRoomType = ref('')
const maxPrice = ref(2000)
const selectedAmenities = ref([])

const availableAmenitiesOptions = ['WiFi', 'Parking', 'Laundry', 'Gym', 'Air Conditioning']

// Toggle selection for amenity checkboxes
const toggleAmenity = (amenity) => {
  const index = selectedAmenities.value.indexOf(amenity)
  if (index === -1) {
    selectedAmenities.value.push(amenity)
  } else {
    selectedAmenities.value.splice(index, 1)
  }
}

// Reset filters to default state
const resetFilters = () => {
  searchLocation.value = ''
  selectedRoomType.value = ''
  maxPrice.value = 2000
  selectedAmenities.value = []
}

// Reactive filtering & sorting (Acceptance Criteria 3 & 4)
const filteredListings = computed(() => {
  return mockListings.value
    .filter((listing) => {
      // Filter by location substring
      const matchesLocation = !searchLocation.value || 
        listing.location.toLowerCase().includes(searchLocation.value.toLowerCase())
      
      // Filter by room type
      const matchesRoomType = !selectedRoomType.value || 
        listing.roomType === selectedRoomType.value
      
      // Filter by max price
      const matchesPrice = listing.price <= maxPrice.value
      
      // Filter by selected amenities (must match all selected)
      const matchesAmenities = selectedAmenities.value.every((amenity) => 
        listing.amenities.includes(amenity)
      )

      return matchesLocation && matchesRoomType && matchesPrice && matchesAmenities
    })
    .sort((a, b) => {
      // Primary sort: Available first
      if (a.available !== b.available) {
        return a.available ? -1 : 1
      }
      // Secondary sort: Newest published date first
      return new Date(b.publishedAt) - new Date(a.publishedAt)
    })
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8 font-sans">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Browse Housing Listings</h1>
      <p class="text-gray-600 mt-1">Find campus housing options sorted by availability and recent postings.</p>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- Sidebar Filters Section -->
      <aside class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-semibold text-gray-800">Filters</h2>
          <button 
            @click="resetFilters" 
            class="text-sm text-indigo-600 hover:underline focus:outline-none"
          >
            Reset All
          </button>
        </div>

        <!-- Location Search -->
        <div class="mb-5">
          <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <input
            v-model="searchLocation"
            type="text"
            placeholder="e.g. East Lansing"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <!-- Room Type Selection -->
        <div class="mb-5">
          <label class="block text-sm font-medium text-gray-700 mb-2">Room Type</label>
          <select
            v-model="selectedRoomType"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="">All Types</option>
            <option value="Studio">Studio</option>
            <option value="Shared">Shared</option>
            <option value="2 Bedroom">2 Bedroom</option>
            <option value="3+ Bedroom">3+ Bedroom</option>
          </select>
        </div>

        <!-- Price Range Slider -->
        <div class="mb-5">
          <div class="flex justify-between text-sm font-medium text-gray-700 mb-2">
            <span>Max Price</span>
            <span class="text-indigo-600 font-semibold">${{ maxPrice }}/mo</span>
          </div>
          <input
            v-model.number="maxPrice"
            type="range"
            min="300"
            max="2500"
            step="50"
            class="w-full accent-indigo-600 cursor-pointer"
          />
        </div>

        <!-- Amenities Checkboxes -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
          <div class="space-y-2">
            <label 
              v-for="amenity in availableAmenitiesOptions" 
              :key="amenity"
              class="flex items-center text-sm text-gray-600 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="selectedAmenities.includes(amenity)"
                @change="toggleAmenity(amenity)"
                class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-gray-300 mr-2"
              />
              {{ amenity }}
            </label>
          </div>
        </div>
      </aside>

      <!-- Property Listings Grid -->
      <main class="lg:col-span-3">
        <div class="mb-4 text-sm text-gray-500">
          Showing <span class="font-semibold text-gray-800">{{ filteredListings.length }}</span> properties
        </div>

        <div v-if="filteredListings.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="listing in filteredListings"
            :key="listing.id"
            class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            <!-- Image & Status Tag -->
            <div class="relative h-48 bg-gray-100">
              <img :src="listing.image" :alt="listing.title" class="w-full h-full object-cover" />
              <span
                :class="listing.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                class="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold"
              >
                {{ listing.available ? 'Available' : 'Occupied' }}
              </span>
            </div>

            <!-- Property Info Card -->
            <div class="p-5">
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-lg text-gray-900 leading-snug">{{ listing.title }}</h3>
                <span class="text-lg font-bold text-indigo-600">${{ listing.price }}<span class="text-xs text-gray-500 font-normal">/mo</span></span>
              </div>

              <p class="text-sm text-gray-500 mb-4 flex items-center">
                📍 {{ listing.location }} • {{ listing.bedrooms }} Bed ({{ listing.roomType }})
              </p>

              <!-- Amenities Pills -->
              <div class="flex flex-wrap gap-1.5 border-t pt-3 border-gray-100">
                <span
                  v-for="amenity in listing.amenities"
                  :key="amenity"
                  class="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-md"
                >
                  {{ amenity }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p class="text-gray-500 text-base">No housing listings match your selected filter criteria.</p>
          <button @click="resetFilters" class="mt-4 text-sm font-medium text-indigo-600 hover:underline">
            Clear all filters
          </button>
        </div>
      </main>
    </div>
  </div>
</template>