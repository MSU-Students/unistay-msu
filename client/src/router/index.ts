
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import HousingDirectoryView from '../views/HousingDirectoryView.vue';
import HousingApplicationReportsView from '../views/HousingApplicationReportsView.vue';
import HousingApplicationView from '../views/HousingApplicationView.vue';
import BillingLedgerView from '../views/BillingLedgerView.vue';
import MaintenanceDeskView from '../views/MaintenanceDeskView.vue';
import FacilityBookingView from '../views/FacilityBookingView.vue';
import GigBoardView from '../views/GigBoardView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import AuthCallbackView from '../views/AuthCallbackView.vue';
import ApplicationsReviewView from '../views/ApplicationsReviewView.vue';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      guestOnly: true,
      title: 'Login',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: {
      guestOnly: true,
      title: 'Register',
    },
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackView,
    meta: {
      title: 'Authentication',
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: {
      requiresAuth: true,
      title: 'Dashboard',
    },
  },
  {
    path: '/housing',
    name: 'housing-directory',
    component: HousingDirectoryView,
    meta: {
      requiresAuth: true,
      title: 'Housing Directory',
    },
  },
  {
    path: '/housing/apply',
    name: 'housing-application',
    component: HousingApplicationView,
    meta: {
      requiresAuth: true,
      studentOnly: true,
      title: 'Housing Application',
    },
  },
  {
    path: '/admin/housing/application-reports',
    name: 'housing-application-reports',
    component: HousingApplicationReportsView,
    meta: {
      requiresAuth: true,
      requiresHousingReportsAccess: true,
      title: 'Housing Application Reports',
    },
  },
  {
    path: '/applications/review',
    name: 'applications-review',
    component: ApplicationsReviewView,
    meta: {
      requiresAuth: true,
      requiresApplicationReviewAccess: true,
      title: 'Applications Review',
    },
  },
  {
    path: '/billing',
    name: 'billing-ledger',
    component: BillingLedgerView,
    meta: {
      requiresAuth: true,
      title: 'Billing & Utility Ledger',
    },
  },
  {
    path: '/maintenance',
    name: 'maintenance-desk',
    component: MaintenanceDeskView,
    meta: {
      requiresAuth: true,
      title: 'Maintenance Desk',
    },
  },
  {
    path: '/facilities',
    name: 'facility-booking',
    component: FacilityBookingView,
    meta: {
      requiresAuth: true,
      title: 'Facility Booking',
    },
  },
  {
    path: '/gigs',
    name: 'gig-board',
    component: GigBoardView,
    meta: {
      requiresAuth: true,
      title: 'Gig Board',
    },
  },
  {
    path: '/my-applications',
    name: 'my-applications',
    component: HousingApplicationView,
    meta: {
      requiresAuth: true,
      studentOnly: true,
      title: 'My Applications',
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  await authStore.restoreOfflineSession();

  document.title = `${to.meta.title ? to.meta.title + ' | ' : ''}UniStay MSU`;

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return { name: 'dashboard' };
  }

  if (to.meta.studentOnly && !authStore.isStudent) {
    return { name: 'dashboard' };
  }

  if (
    to.meta.requiresHousingReportsAccess &&
    !authStore.isAdmin &&
    !authStore.isManager
  ) {
    return { name: 'dashboard' };
  }

  if (
    to.meta.requiresApplicationReviewAccess &&
    !authStore.isAdmin &&
    !authStore.isManager
  ) {
    return { name: 'dashboard' };
  }

  if (to.meta.requiresManager && !authStore.isManager) {
    return { name: 'dashboard' };
  }

  if (to.name === 'my-applications' && !authStore.isStudent) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;