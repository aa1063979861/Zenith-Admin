export interface PageQuery {
  pageNo?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100000;

export function normalizePage(query: PageQuery) {
  const pageNo = Math.max(Number(query.pageNo || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
  return { pageNo, pageSize, skip: (pageNo - 1) * pageSize };
}

export function pageResult<T>(pageData: T[], total: number) {
  return { pageData, total };
}
