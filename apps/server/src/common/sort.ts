import { BadRequestException } from '@nestjs/common';

export type SortDirection = 'ASC' | 'DESC';

export function resolveSort(
  sortKey: string | undefined,
  sortOrder: string | undefined,
  columns: Record<string, string>,
) {
  const key = sortKey?.trim();
  const order = String(sortOrder ?? '').trim();
  if (!key || !order || order === 'false')
    return null;

  const column = columns[key];
  if (!column)
    throw new BadRequestException('排序字段不支持');

  if (order === 'ascend')
    return { column, direction: 'ASC' as SortDirection };
  if (order === 'descend')
    return { column, direction: 'DESC' as SortDirection };
  throw new BadRequestException('排序方向无效');
}
