import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { normalizePage, pageResult } from '../../common/page';
import { currentRequestContext } from '../../common/request-context';
import { resolveSort } from '../../common/sort';
import { OperationLog } from '../../entities/operation-log.entity';
import { User } from '../../entities/user.entity';

export type OperationLogInput = {
  module: string;
  action: string;
  targetType: string;
  targetId?: number | string | null;
  targetName?: string | null;
  user?: User | null;
  detailJson?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type OperationLogQuery = {
  pageNo?: number;
  pageSize?: number;
  module?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  userId?: string | number;
  startTime?: string;
  endTime?: string;
  keyword?: string;
  sortKey?: string;
  sortOrder?: string;
};

@Injectable()
export class OperationLogsService {
  constructor(
    @InjectRepository(OperationLog) private readonly logRepository: Repository<OperationLog>,
  ) {}

  async page(query: OperationLogQuery) {
    const { pageSize, skip } = normalizePage(query);
    const qb = this.logRepository.createQueryBuilder('log').skip(skip).take(pageSize);
    const userId = this.parseOptionalPositiveInt(query.userId);

    if (query.module)
      qb.andWhere('log.module = :module', { module: query.module });
    if (query.action)
      qb.andWhere('log.action = :action', { action: query.action });
    if (query.targetType)
      qb.andWhere('log.targetType = :targetType', { targetType: query.targetType });
    if (query.targetId?.trim())
      qb.andWhere('log.targetId = :targetId', { targetId: query.targetId.trim() });
    if (userId)
      qb.andWhere('log.userId = :userId', { userId });
    if (query.startTime)
      qb.andWhere('log.createTime >= :startTime', { startTime: `${query.startTime} 00:00:00` });
    if (query.endTime)
      qb.andWhere('log.createTime <= :endTime', { endTime: `${query.endTime} 23:59:59` });
    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      qb.andWhere(new Brackets((where) => {
        where.where('log.targetName LIKE :keyword', { keyword })
          .orWhere('log.targetId LIKE :keyword', { keyword })
          .orWhere('log.username LIKE :keyword', { keyword })
          .orWhere('log.userDisplayName LIKE :keyword', { keyword })
          .orWhere('log.ipAddress LIKE :keyword', { keyword })
          .orWhere('log.module LIKE :keyword', { keyword })
          .orWhere('log.action LIKE :keyword', { keyword })
          .orWhere('CAST(log.detailJson AS CHAR) LIKE :keyword', { keyword });
      }));
    }

    const sort = resolveSort(query.sortKey, query.sortOrder, {
      createTime: 'log.createTime',
      module: 'log.module',
      action: 'log.action',
      targetType: 'log.targetType',
      targetName: 'log.targetName',
      username: 'log.username',
    });
    if (sort)
      qb.orderBy(sort.column, sort.direction).addOrderBy('log.id', 'DESC');
    else
      qb.orderBy('log.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toRow(row)), total);
  }

  async options() {
    const [modules, actions, targetTypes, users] = await Promise.all([
      this.distinctColumnOptions('module'),
      this.distinctColumnOptions('action'),
      this.distinctColumnOptions('targetType'),
      this.userOptions(),
    ]);
    return { modules, actions, targetTypes, users };
  }

  async record(input: OperationLogInput) {
    const userDisplayName = resolveUserDisplayName(input.user);
    const request = currentRequestContext();
    const log = this.logRepository.create({
      module: input.module,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId === undefined || input.targetId === null ? null : String(input.targetId),
      targetName: input.targetName?.trim() || null,
      userId: input.user?.id || null,
      username: userDisplayName,
      userDisplayName,
      detailJson: input.detailJson || null,
      ipAddress: input.ipAddress || request?.ipAddress || null,
      userAgent: input.userAgent || request?.userAgent || null,
    });
    await this.logRepository.save(log);
  }

  private toRow(row: OperationLog) {
    return {
      id: row.id,
      module: row.module,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId || null,
      targetName: row.targetName || null,
      userId: row.userId || null,
      username: row.userDisplayName || row.username || null,
      detailJson: row.detailJson || null,
      ipAddress: row.ipAddress || null,
      userAgent: row.userAgent || null,
      createTime: row.createTime,
    };
  }

  private async distinctColumnOptions(column: 'module' | 'action' | 'targetType') {
    const rows = await this.logRepository.createQueryBuilder('log')
      .select(`log.${column}`, 'value')
      .where(`log.${column} IS NOT NULL`)
      .andWhere(`log.${column} <> ''`)
      .distinct(true)
      .orderBy(`log.${column}`, 'ASC')
      .limit(200)
      .getRawMany<{ value: string }>();
    return rows.map(row => ({ label: row.value, value: row.value }));
  }

  private async userOptions() {
    const rows = await this.logRepository.createQueryBuilder('log')
      .select('log.userId', 'value')
      .addSelect('COALESCE(log.userDisplayName, log.username)', 'label')
      .where('log.userId IS NOT NULL')
      .groupBy('log.userId')
      .addGroupBy('log.userDisplayName')
      .addGroupBy('log.username')
      .orderBy('label', 'ASC')
      .limit(200)
      .getRawMany<{ value: number; label: string | null }>();
    return rows.map(row => ({ label: row.label || `用户${row.value}`, value: row.value }));
  }

  private parseOptionalPositiveInt(value: string | number | undefined) {
    if (value === undefined || value === null || value === '')
      return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
}

export function resolveUserDisplayName(user?: User | null) {
  return user?.employeeProfile?.name || user?.nickName || (user?.userKind === 'SYSTEM_ADMIN' || user?.builtIn ? '超级管理员' : user?.username) || null;
}
