<template>
    <div class="admin-listing-approval">
      <header class="admin-header">
        <h2>Admin Property Listing Approval</h2>
        <p class="subtitle">Review, approve, or reject pending housing listings for publication.</p>
      </header>
  
      <div v-if="listings.length === 0" class="no-listings">
        <p>No listings currently available for review.</p>
      </div>
  
      <div v-else class="listings-grid">
        <div v-for="listing in listings" :key="listing.id" class="listing-card">
          <div class="card-header">
            <span class="room-type">{{ listing.roomType }}</span>
            <span :class="['status-badge', listing.status.toLowerCase()]">
              {{ listing.status }}
            </span>
          </div>
  
          <div class="card-body">
            <h3 class="property-title">{{ listing.title }}</h3>
            <p class="property-location">📍 {{ listing.location }}</p>
            <p class="property-owner">👤 Owner/Applicant: <strong>{{ listing.owner }}</strong></p>
            <p class="property-price">₱{{ listing.price.toLocaleString() }} <span class="price-period">/ month</span></p>
          </div>
  
          <div class="card-footer">
            <template v-if="listing.status === 'Pending'">
              <button class="btn-approve" @click="updateStatus(listing.id, 'Approved')">
                Approve
              </button>
              <button class="btn-reject" @click="updateStatus(listing.id, 'Rejected')">
                Reject
              </button>
            </template>
            <template v-else>
              <span class="actioned-text">Action taken: <strong>{{ listing.status }}</strong></span>
              <button class="btn-reset" @click="updateStatus(listing.id, 'Pending')">
                Reset
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  
  // Reactive array of sample pending property listings
  const listings = ref([
    {
      id: 1,
      title: 'Mindanao State University Sunrise Boarding House',
      owner: 'Maria Santos',
      location: 'Marawi City, near MSU Campus Gate 1',
      price: 3500,
      roomType: 'Single Room',
      status: 'Pending'
    },
    {
      id: 2,
      title: 'Marawi Executive Dormitory & Apartments',
      owner: 'Abdulrahman Macabando',
      location: 'Amai Pakpak Avenue, Marawi City',
      price: 5000,
      roomType: 'Shared Apartment',
      status: 'Pending'
    },
    {
      id: 3,
      title: 'Lakewood View Student Residences',
      owner: 'Fatima Al-Jamil',
      location: 'Mindanao State University Campus Vicinity',
      price: 4000,
      roomType: 'Double Room',
      status: 'Pending'
    },
    {
      id: 4,
      title: 'Grand Vista Boarding Home',
      owner: 'Datumanong Sultan',
      location: 'Marawi City, Lanao del Sur',
      price: 3000,
      roomType: 'Single Room',
      status: 'Approved'
    }
  ])
  
  // Function to immediately update a listing's status
  const updateStatus = (id, newStatus) => {
    const listing = listings.value.find((item) => item.id === id)
    if (listing) {
      listing.status = newStatus
    }
  }
  </script>
  
  <style scoped>
  .admin-listing-approval {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #333;
  }
  
  .admin-header {
    margin-bottom: 24px;
    border-bottom: 2px solid #e9ecef;
    padding-bottom: 12px;
  }
  
  .admin-header h2 {
    margin: 0;
    font-size: 1.8rem;
    color: #1a1a1a;
  }
  
  .subtitle {
    margin: 4px 0 0;
    color: #6c757d;
    font-size: 0.95rem;
  }
  
  .no-listings {
    text-align: center;
    padding: 40px;
    color: #6c757d;
    font-size: 1.1rem;
  }
  
  .listings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }
  
  .listing-card {
    background: #ffffff;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  
  .listing-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .room-type {
    font-size: 0.85rem;
    font-weight: 600;
    color: #495057;
    background-color: #f1f3f5;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  /* Color-coded Status Badges */
  .status-badge {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .status-badge.pending {
    background-color: #fff3cd;
    color: #856404;
  }
  
  .status-badge.approved {
    background-color: #d4edda;
    color: #155724;
  }
  
  .status-badge.rejected {
    background-color: #f8d7da;
    color: #721c24;
  }
  
  .card-body {
    margin-bottom: 16px;
  }
  
  .property-title {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #212529;
  }
  
  .property-location,
  .property-owner {
    font-size: 0.9rem;
    color: #6c757d;
    margin: 4px 0;
  }
  
  .property-price {
    font-size: 1.25rem;
    font-weight: 700;
    color: #2b8a3e;
    margin: 12px 0 0 0;
  }
  
  .price-period {
    font-size: 0.8rem;
    font-weight: normal;
    color: #868e96;
  }
  
  .card-footer {
    display: flex;
    gap: 10px;
    border-top: 1px solid #f1f3f5;
    padding-top: 14px;
    align-items: center;
  }
  
  button {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .btn-approve {
    background-color: #2b8a3e;
    color: #ffffff;
  }
  
  .btn-approve:hover {
    background-color: #2b8a3e;
    filter: brightness(0.9);
  }
  
  .btn-reject {
    background-color: #c92a2a;
    color: #ffffff;
  }
  
  .btn-reject:hover {
    background-color: #c92a2a;
    filter: brightness(0.9);
  }
  
  .btn-reset {
    background-color: #868e96;
    color: #ffffff;
    flex: 0 0 auto;
    padding: 6px 10px;
    font-size: 0.8rem;
  }
  
  .btn-reset:hover {
    background-color: #495057;
  }
  
  .actioned-text {
    font-size: 0.85rem;
    color: #495057;
    flex: 1;
  }
  </style>