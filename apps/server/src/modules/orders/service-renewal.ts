export const RENEWAL_STATUSES = ['无需续签', '未到期', '待续签', '已续签', '不续签', '已终止'] as const;

export type RenewalStatus = typeof RENEWAL_STATUSES[number];

const FINAL_RENEWAL_STATUSES = new Set<RenewalStatus>(['无需续签', '已续签', '不续签', '已终止']);

export type RenewalSeed = {
  renewalStatus: RenewalStatus;
  renewalReminderDate: string | null;
};

export type RenewalSource = {
  renewalStatus?: string | null;
  renewalReminderDate?: string | null;
  renewedByServiceItemId?: number | null;
  serviceEndDate?: string | null;
};

export function createRenewalSeed(reminderEnabled: boolean, reminderDays: number, serviceEndDate?: string | null): RenewalSeed {
  if (!reminderEnabled)
    return { renewalStatus: '无需续签', renewalReminderDate: null };
  if (!serviceEndDate)
    return { renewalStatus: '未到期', renewalReminderDate: null };
  return {
    renewalStatus: '未到期',
    renewalReminderDate: addDaysText(serviceEndDate, -reminderDays),
  };
}

export function resolveRenewalStatus(row: RenewalSource, reminderDays: number): RenewalStatus {
  if (row.renewedByServiceItemId)
    return '已续签';
  const storedStatus = normalizeRenewalStatus(row.renewalStatus);
  if (storedStatus !== '无需续签' && FINAL_RENEWAL_STATUSES.has(storedStatus))
    return storedStatus;
  const reminderDate = row.renewalReminderDate || (row.serviceEndDate ? addDaysText(row.serviceEndDate, -reminderDays) : null);
  if (!reminderDate)
    return storedStatus;
  return reminderDate <= createTodayText() ? '待续签' : '未到期';
}

export function normalizeRenewalStatus(status?: string | null): RenewalStatus {
  return RENEWAL_STATUSES.includes(status as RenewalStatus) ? status as RenewalStatus : '无需续签';
}

export function addDaysText(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateText(date);
}

export function addMonthsInclusiveEndText(dateText: string, months: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() - 1);
  return formatDateText(date);
}

export function createTodayText() {
  return formatDateText(new Date());
}

function formatDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
