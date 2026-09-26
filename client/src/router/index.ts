import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import HousingDirectoryView from '../views/HousingDirectoryView.vue';
import BillingLedgerView from '../views/BillingLedgerView.vue';
import MaintenanceDeskView from '../views/MaintenanceDeskView.vue';
import FacilityBookingView from '../views/FacilityBookingView.vue';
import GigBoardView from '../views/GigBoardView.vue';
import LoginView from '../views/LoginView.vue';
import AuthCallbackView from '../views/AuthCallbackView.vue';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true, title: 'Campus Dashboard' },
  },
  {
    path: '/housing',
    name: 'housing',
    component: HousingDirectoryView,
    meta: { requiresAuth: false, title: 'Dormitory & Housing Directory' },
  },
  {
    path: '/billing',
    name: 'billing',
    component: BillingLedgerView,
    meta: { requiresAuth: true, title: 'Billing & Utility Ledger' },
  },
  {
    path: '/maintenance',
    name: 'maintenance',
    component: MaintenanceDeskView,
    meta: { requiresAuth: true, title: 'Maintenance & Service Desk' },
  },
  {
    path: '/facilities',
    name: 'facilities',
    component: FacilityBookingView,
    meta: { requiresAuth: true, title: 'Facility Reservations' },
  },
  {
    path: '/gigs',
    name: 'gigs',
    component: GigBoardView,
    meta: { requiresAuth: true, title: 'Student Gig Board' },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guestOnly: true, title: 'Institutional Login' },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackView,
    meta: { title: 'Authenticating...' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  await authStore.restoreOfflineSession();

  document.title = `${to.meta.title ? to.meta.title + ' | ' : ''}UniStay MSU`;

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else if (to.meta.guestOnly && authStore.isAuthenticated) {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
