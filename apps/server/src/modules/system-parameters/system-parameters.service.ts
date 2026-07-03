import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalBooleanFlag, parseOptionalStringIn } from '../../common/query';
import { SystemParameter, SystemParameterValueType } from '../../entities/system-parameter.entity';
import {
  DEFAULT_ORDER_PERFORMER_DEFAULTS_TO_RECEIVER,
  DEFAULT_ORDER_NO_PREFIX,
  DEFAULT_ORDER_SERVICE_DUE_WARNING_DAYS,
  DEFAULT_ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT,
  DEFAULT_SECURITY_ACCESS_TOKEN_TTL_MINUTES,
  DEFAULT_SECURITY_PASSWORD_MIN_LENGTH,
  DEFAULT_SECURITY_REFRESH_TOKEN_TTL_MINUTES,
  DEFAULT_UI_LAYOUT_SETTING_VISIBLE,
  DEFAULT_UPLOAD_ARCHIVE_FILE_MAX_MB,
  DEFAULT_UPLOAD_AVATAR_MAX_MB,
  DEFAULT_UPLOAD_IMPORT_EXCEL_MAX_MB,
  EMPLOYEE_INITIAL_PASSWORD_KEY,
  CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY,
  DEFAULT_CLIENT_CREDENTIAL_SYSTEM_OPTIONS,
  KDOCS_HISTORY_LINKS_KEY,
  normalizeClientCredentialSystemOptionsValue,
  normalizeKdocsHistoryLinksValue,
  ORDER_NO_PREFIX_KEY,
  ORDER_PERFORMER_DEFAULTS_TO_RECEIVER_KEY,
  ORDER_SERVICE_DUE_WARNING_DAYS_KEY,
  ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT_KEY,
  parseClientCredentialSystemOptions,
  REGISTERED_SYSTEM_PARAMETER_MAP,
  SECURITY_ACCESS_TOKEN_TTL_MINUTES_KEY,
  SECURITY_PASSWORD_MIN_LENGTH_KEY,
  SECURITY_REFRESH_TOKEN_TTL_MINUTES_KEY,
  UI_LAYOUT_SETTING_VISIBLE_KEY,
  UPLOAD_ARCHIVE_FILE_MAX_MB_KEY,
  UPLOAD_AVATAR_MAX_MB_KEY,
  UPLOAD_IMPORT_EXCEL_MAX_MB_KEY,
} from './system-parameter-registry';
import { CreateSystemParameterDto } from './dto/create-system-parameter.dto';
import { UpdateSystemParameterDto } from './dto/update-system-parameter.dto';

const SYSTEM_PARAMETER_SORT_COLUMNS: Record<string, string> = {
  paramName: 'parameter.paramName',
  paramKey: 'parameter.paramKey',
  groupName: 'parameter.groupName',
  valueType: 'parameter.valueType',
  paramValue: 'parameter.paramValue',
  builtIn: 'parameter.builtIn',
  enabled: 'parameter.enabled',
  sort: 'parameter.sort',
  updateTime: 'parameter.updateTime',
  remark: 'parameter.remark',
};

const SYSTEM_PARAMETER_VALUE_TYPES: readonly SystemParameterValueType[] = ['string', 'number', 'boolean', 'password'];

@Injectable()
export class SystemParametersService {
  constructor(
    @InjectRepository(SystemParameter) private readonly parameterRepository: Repository<SystemParameter>,
  ) {}

  async page(query: { pageNo?: number; pageSize?: number; keyword?: string; enabled?: string | number; groupName?: string; valueType?: SystemParameterValueType; builtIn?: string | number; bound?: string | number; sortKey?: string; sortOrder?: string }) {
    const { pageSize, skip } = normalizePage(query);
    const registeredKeys = [...REGISTERED_SYSTEM_PARAMETER_MAP.keys()];
    const enabled = parseOptionalBooleanFlag(query.enabled, '状态');
    const builtIn = parseOptionalBooleanFlag(query.builtIn, '来源');
    const bound = parseOptionalBooleanFlag(query.bound, '生效状态');
    const valueType = parseOptionalStringIn(query.valueType, '值类型', SYSTEM_PARAMETER_VALUE_TYPES);
    const qb = this.parameterRepository.createQueryBuilder('parameter')
      .skip(skip)
      .take(pageSize);

    if (query.keyword) {
      qb.andWhere('(parameter.paramKey LIKE :keyword OR parameter.paramName LIKE :keyword)', {
        keyword: `%${query.keyword}%`,
      });
    }
    if (enabled !== null)
      qb.andWhere('parameter.enabled = :enabled', { enabled });
    if (query.groupName) {
      qb.andWhere('parameter.groupName = :groupName', { groupName: query.groupName });
    }
    if (valueType)
      qb.andWhere('parameter.valueType = :valueType', { valueType });
    if (builtIn !== null)
      qb.andWhere('parameter.builtIn = :builtIn', { builtIn });
    if (bound !== null) {
      if (bound)
        qb.andWhere('parameter.paramKey IN (:...registeredKeys)', { registeredKeys });
      else
        qb.andWhere('parameter.paramKey NOT IN (:...registeredKeys)', { registeredKeys });
    }

    const sort = this.resolveParameterSort(query.sortKey, query.sortOrder);
    if (sort) {
      qb
        .orderBy(sort.column, sort.direction)
        .addOrderBy('parameter.id', 'ASC');
    }
    else {
      qb
        .orderBy('parameter.sort', 'ASC')
        .addOrderBy('parameter.id', 'ASC');
    }

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.withRuntimeMeta(row)), total);
  }

  async create(dto: CreateSystemParameterDto) {
    const paramKey = this.requiredText(dto.paramKey, '参数键');
    if (REGISTERED_SYSTEM_PARAMETER_MAP.has(paramKey))
      throw new BadRequestException('系统内置参数键不可作为自定义参数创建');

    const existed = await this.parameterRepository.findOne({ where: { paramKey }, withDeleted: true });
    if (existed)
      throw new BadRequestException('参数键已存在');

    const valueType = dto.valueType ?? 'string';
    const parameter = this.parameterRepository.create({
      paramKey,
      paramName: this.requiredText(dto.paramName, '参数名称'),
      valueType,
      paramValue: await this.normalizeValue(valueType, dto.paramValue, paramKey),
      groupName: dto.groupName?.trim() || null,
      enabled: dto.enabled ?? true,
      builtIn: false,
      sort: dto.sort ?? 1,
      remark: dto.remark?.trim() || null,
    });
    return this.withRuntimeMeta(await this.parameterRepository.save(parameter));
  }

  async update(id: number, dto: UpdateSystemParameterDto) {
    const parameter = await this.findOne(id);
    const isLockedParameter = parameter.builtIn || REGISTERED_SYSTEM_PARAMETER_MAP.has(parameter.paramKey);
    if (isLockedParameter) {
      if (dto.paramName !== undefined && this.requiredText(dto.paramName, '参数名称') !== parameter.paramName)
        throw new BadRequestException('已绑定系统参数不可修改参数名称');
      if (dto.valueType !== undefined && dto.valueType !== parameter.valueType)
        throw new BadRequestException('已绑定系统参数不可修改值类型');
      if (dto.enabled === false)
        throw new BadRequestException('已绑定系统参数不可停用');
      if (dto.groupName !== undefined && (dto.groupName.trim() || null) !== (parameter.groupName || null))
        throw new BadRequestException('已绑定系统参数不可修改参数分组');
    }
    const nextValueType = dto.valueType ?? parameter.valueType;
    if (dto.paramName !== undefined)
      parameter.paramName = this.requiredText(dto.paramName, '参数名称');
    if (dto.valueType !== undefined)
      parameter.valueType = dto.valueType;
    if (dto.paramValue !== undefined)
      parameter.paramValue = await this.normalizeValue(nextValueType, dto.paramValue, parameter.paramKey);
    if (dto.groupName !== undefined)
      parameter.groupName = dto.groupName.trim() || null;
    if (dto.enabled !== undefined)
      parameter.enabled = dto.enabled;
    if (dto.sort !== undefined)
      parameter.sort = dto.sort;
    if (dto.remark !== undefined)
      parameter.remark = dto.remark.trim() || null;
    return this.withRuntimeMeta(await this.parameterRepository.save(parameter));
  }

  async remove(id: number) {
    const parameter = await this.findOne(id);
    if (parameter.builtIn || REGISTERED_SYSTEM_PARAMETER_MAP.has(parameter.paramKey))
      throw new BadRequestException('已绑定系统参数不可删除');
    await this.parameterRepository.softRemove(parameter);
    return true;
  }

  async getEnabledValue(paramKey: string, fallback: string) {
    const parameter = await this.parameterRepository.findOne({ where: { paramKey, enabled: true } });
    return parameter?.paramValue ?? fallback;
  }

  async getEnabledNumber(paramKey: string, fallback: number) {
    const rawValue = await this.getEnabledValue(paramKey, String(fallback));
    const value = Number(rawValue);
    if (!Number.isFinite(value))
      throw new BadRequestException(`系统参数 ${paramKey} 必须是有效数字`);
    return this.validateRegisteredNumber(paramKey, value);
  }

  async getEnabledBoolean(paramKey: string, fallback: boolean) {
    const rawValue = await this.getEnabledValue(paramKey, String(fallback));
    const value = rawValue.trim().toLowerCase();
    if (value === 'true' || value === '1')
      return true;
    if (value === 'false' || value === '0')
      return false;
    throw new BadRequestException(`系统参数 ${paramKey} 必须是布尔值`);
  }

  getAccessTokenTtlMinutes() {
    return this.getEnabledNumber(SECURITY_ACCESS_TOKEN_TTL_MINUTES_KEY, DEFAULT_SECURITY_ACCESS_TOKEN_TTL_MINUTES);
  }

  getRefreshTokenTtlMinutes() {
    return this.getEnabledNumber(SECURITY_REFRESH_TOKEN_TTL_MINUTES_KEY, DEFAULT_SECURITY_REFRESH_TOKEN_TTL_MINUTES);
  }

  getPasswordMinLength() {
    return this.getEnabledNumber(SECURITY_PASSWORD_MIN_LENGTH_KEY, DEFAULT_SECURITY_PASSWORD_MIN_LENGTH);
  }

  async getOrderNoPrefix() {
    return this.normalizeOrderNoPrefix(await this.getEnabledValue(ORDER_NO_PREFIX_KEY, DEFAULT_ORDER_NO_PREFIX));
  }

  getServiceDueWarningDays() {
    return this.getEnabledNumber(ORDER_SERVICE_DUE_WARNING_DAYS_KEY, DEFAULT_ORDER_SERVICE_DUE_WARNING_DAYS);
  }

  getAvatarUploadMaxMb() {
    return this.getEnabledNumber(UPLOAD_AVATAR_MAX_MB_KEY, DEFAULT_UPLOAD_AVATAR_MAX_MB);
  }

  getImportExcelUploadMaxMb() {
    return this.getEnabledNumber(UPLOAD_IMPORT_EXCEL_MAX_MB_KEY, DEFAULT_UPLOAD_IMPORT_EXCEL_MAX_MB);
  }

  getArchiveFileUploadMaxMb() {
    return this.getEnabledNumber(UPLOAD_ARCHIVE_FILE_MAX_MB_KEY, DEFAULT_UPLOAD_ARCHIVE_FILE_MAX_MB);
  }

  async getClientCredentialSystemOptions() {
    const rawValue = await this.getEnabledValue(CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY, DEFAULT_CLIENT_CREDENTIAL_SYSTEM_OPTIONS);
    try {
      return parseClientCredentialSystemOptions(rawValue);
    }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `${CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY} 配置无效`);
    }
  }

  async runtimeConfig() {
    const [
      layoutSettingVisible,
      performerDefaultsToReceiver,
      serviceYearPreviousYearDefault,
    ] = await Promise.all([
      this.getEnabledBoolean(UI_LAYOUT_SETTING_VISIBLE_KEY, DEFAULT_UI_LAYOUT_SETTING_VISIBLE),
      this.getEnabledBoolean(ORDER_PERFORMER_DEFAULTS_TO_RECEIVER_KEY, DEFAULT_ORDER_PERFORMER_DEFAULTS_TO_RECEIVER),
      this.getEnabledBoolean(ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT_KEY, DEFAULT_ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT),
    ]);
    return {
      layoutSettingVisible,
      performerDefaultsToReceiver,
      serviceYearPreviousYearDefault,
    };
  }

  async validatePasswordLength(value: string, label = '密码') {
    const password = value.trim();
    const minLength = await this.getPasswordMinLength();
    if (password.length < minLength)
      throw new BadRequestException(`${label}不能少于 ${minLength} 位`);
    return password;
  }

  async groups() {
    const rows = await this.parameterRepository
      .createQueryBuilder('parameter')
      .select('DISTINCT parameter.groupName', 'groupName')
      .where('parameter.groupName IS NOT NULL')
      .andWhere("parameter.groupName <> ''")
      .orderBy('parameter.groupName', 'ASC')
      .getRawMany<{ groupName: string }>();
    return rows.map(row => row.groupName);
  }

  async findOne(id: number) {
    const parameter = await this.parameterRepository.findOne({ where: { id } });
    if (!parameter)
      throw new NotFoundException('系统参数不存在');
    return parameter;
  }

  private withRuntimeMeta(parameter: SystemParameter) {
    const meta = REGISTERED_SYSTEM_PARAMETER_MAP.get(parameter.paramKey);
    return {
      ...parameter,
      bound: Boolean(meta),
      paramValue: parameter.valueType === 'password' ? '' : parameter.paramValue,
      usageScene: meta?.usageScene || '未绑定业务',
      effectiveScope: meta?.effectiveScope || '仅保存配置，不会被业务自动读取',
      minNumber: meta?.minNumber,
      maxNumber: meta?.maxNumber,
      integer: meta?.integer,
    };
  }

  private requiredText(value: string, fieldName: string) {
    const text = value.trim();
    if (!text)
      throw new BadRequestException(`${fieldName}不能为空`);
    return text;
  }

  private async normalizeValue(valueType: SystemParameterValueType, rawValue: string, paramKey: string) {
    const value = rawValue.trim();
    if (!value)
      throw new BadRequestException('参数值不能为空');

    if (valueType === 'number') {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue))
        throw new BadRequestException('数字类型参数值必须是有效数字');
      const normalizedNumber = this.validateRegisteredNumber(paramKey, numberValue);
      if (paramKey === SECURITY_PASSWORD_MIN_LENGTH_KEY)
        await this.validateExistingEmployeeInitialPassword(normalizedNumber);
      return String(normalizedNumber);
    }

    if (valueType === 'boolean') {
      if (value === 'true' || value === '1')
        return 'true';
      if (value === 'false' || value === '0')
        return 'false';
      throw new BadRequestException('布尔类型参数值只能是 true 或 false');
    }

    if (paramKey === EMPLOYEE_INITIAL_PASSWORD_KEY)
      return this.validatePasswordLength(value, '员工初始密码');

    if (paramKey === ORDER_NO_PREFIX_KEY)
      return this.normalizeOrderNoPrefix(value);

    if (paramKey === KDOCS_HISTORY_LINKS_KEY) {
      try {
        return normalizeKdocsHistoryLinksValue(value);
      }
      catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : `${KDOCS_HISTORY_LINKS_KEY} 配置无效`);
      }
    }

    if (paramKey === CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY) {
      try {
        return normalizeClientCredentialSystemOptionsValue(value);
      }
      catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : `${CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY} 配置无效`);
      }
    }

    return value;
  }

  private normalizeOrderNoPrefix(value: string) {
    const prefix = value.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(prefix))
      throw new BadRequestException('订单编号前缀只能使用1-8位英文字母或数字');
    return prefix;
  }

  private async validateExistingEmployeeInitialPassword(minLength: number) {
    const passwordParameter = await this.parameterRepository.findOne({ where: { paramKey: EMPLOYEE_INITIAL_PASSWORD_KEY, enabled: true } });
    const password = passwordParameter?.paramValue?.trim();
    if (password && password.length < minLength)
      throw new BadRequestException(`员工初始密码不能少于 ${minLength} 位，请先调整员工初始密码`);
  }

  private validateRegisteredNumber(paramKey: string, value: number) {
    const meta = REGISTERED_SYSTEM_PARAMETER_MAP.get(paramKey);
    if (!meta)
      return value;
    if (meta.integer && !Number.isInteger(value))
      throw new BadRequestException(`${meta.paramName}必须是整数`);
    if (meta.minNumber !== undefined && value < meta.minNumber)
      throw new BadRequestException(`${meta.paramName}不能小于 ${meta.minNumber}`);
    if (meta.maxNumber !== undefined && value > meta.maxNumber)
      throw new BadRequestException(`${meta.paramName}不能大于 ${meta.maxNumber}`);
    return value;
  }

  private resolveParameterSort(sortKey?: string, sortOrder?: string) {
    const key = sortKey?.trim();
    if (!key || !sortOrder)
      return null;
    const column = SYSTEM_PARAMETER_SORT_COLUMNS[key];
    if (!column)
      return null;
    if (sortOrder === 'ascend')
      return { column, direction: 'ASC' as const };
    if (sortOrder === 'descend')
      return { column, direction: 'DESC' as const };
    return null;
  }
}
