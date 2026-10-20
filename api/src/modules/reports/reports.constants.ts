export const REPORT_THRESHOLDS = {
  pendingApplicationDays: 7,
  staleMaintenanceDays: 7,
  stalledGigDays: 14,
  highOccupancyPercent: 90,
} as const;

export const REPORT_PAGE_SIZE_DEFAULT = 20;
export const REPORT_PAGE_SIZE_MAX = 100;
