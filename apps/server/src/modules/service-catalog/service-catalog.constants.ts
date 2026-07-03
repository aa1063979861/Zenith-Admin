export const SERVICE_CATALOG_CATEGORIES = ['一次性', '周期性'] as const;

export const SERVICE_CATALOG_RULES = {
  一次性: {
    minMonths: 0,
    reminderEnabled: false,
  },
  周期性: {
    minMonths: 12,
    reminderEnabled: true,
  },
} as const;

export function normalizeServiceCatalogCategory(category?: string | null) {
  if (category === '报表')
    return '一次性';
  if (category === '服务')
    return '周期性';
  return category || '一次性';
}
