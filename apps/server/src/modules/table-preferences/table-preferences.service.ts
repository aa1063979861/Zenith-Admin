import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableDefaultPreference, TablePreferenceConfig } from '../../entities/table-default-preference.entity';
import { UserTablePreference } from '../../entities/user-table-preference.entity';

export interface ResolvedTablePreference {
  tableKey: string;
  defaultConfig: TablePreferenceConfig;
  userConfig: TablePreferenceConfig | null;
}

@Injectable()
export class TablePreferencesService {
  constructor(
    @InjectRepository(TableDefaultPreference) private readonly defaultPreferenceRepository: Repository<TableDefaultPreference>,
    @InjectRepository(UserTablePreference) private readonly userPreferenceRepository: Repository<UserTablePreference>,
  ) {}

  async resolveForUser(tableKey: string, userId: number, defaultConfig: TablePreferenceConfig): Promise<ResolvedTablePreference> {
    const normalizedTableKey = this.normalizeTableKey(tableKey);
    const normalizedDefaultConfig = this.normalizeConfig(defaultConfig, '默认列配置');
    const defaultPreference = await this.getOrCreateDefaultConfig(normalizedTableKey, normalizedDefaultConfig);
    const userPreference = await this.userPreferenceRepository.findOne({
      where: { tableKey: normalizedTableKey, userId },
    });

    return {
      tableKey: normalizedTableKey,
      defaultConfig: defaultPreference.defaultConfig,
      userConfig: userPreference?.settings ?? null,
    };
  }

  async saveUserConfig(tableKey: string, userId: number, settings: TablePreferenceConfig): Promise<ResolvedTablePreference> {
    const normalizedTableKey = this.normalizeTableKey(tableKey);
    const normalizedSettings = this.normalizeConfig(settings, '用户列配置');
    const defaultPreference = await this.defaultPreferenceRepository.findOne({
      where: { tableKey: normalizedTableKey },
    });
    if (!defaultPreference)
      throw new BadRequestException('表格默认配置不存在');

    let userPreference = await this.userPreferenceRepository.findOne({
      where: { tableKey: normalizedTableKey, userId },
    });
    if (!userPreference) {
      userPreference = this.userPreferenceRepository.create({
        tableKey: normalizedTableKey,
        userId,
        settings: normalizedSettings,
      });
    }
    else {
      userPreference.settings = normalizedSettings;
    }

    const savedPreference = await this.userPreferenceRepository.save(userPreference);
    return {
      tableKey: normalizedTableKey,
      defaultConfig: defaultPreference.defaultConfig,
      userConfig: savedPreference.settings,
    };
  }

  async resetUserConfig(tableKey: string, userId: number): Promise<ResolvedTablePreference> {
    const normalizedTableKey = this.normalizeTableKey(tableKey);
    const defaultPreference = await this.defaultPreferenceRepository.findOne({
      where: { tableKey: normalizedTableKey },
    });
    if (!defaultPreference)
      throw new BadRequestException('表格默认配置不存在');

    await this.userPreferenceRepository.delete({ tableKey: normalizedTableKey, userId });
    return {
      tableKey: normalizedTableKey,
      defaultConfig: defaultPreference.defaultConfig,
      userConfig: null,
    };
  }

  private async getOrCreateDefaultConfig(tableKey: string, defaultConfig: TablePreferenceConfig) {
    let defaultPreference = await this.defaultPreferenceRepository.findOne({
      where: { tableKey },
    });
    if (!defaultPreference) {
      defaultPreference = this.defaultPreferenceRepository.create({
        tableKey,
        defaultConfig,
      });
      return this.defaultPreferenceRepository.save(defaultPreference);
    }

    return defaultPreference;
  }

  private normalizeTableKey(tableKey: string) {
    const normalizedTableKey = tableKey.trim();
    if (!normalizedTableKey)
      throw new BadRequestException('表格唯一标识不能为空');
    if (normalizedTableKey.length > 160)
      throw new BadRequestException('表格唯一标识不能超过160个字符');
    return normalizedTableKey;
  }

  private normalizeConfig(config: TablePreferenceConfig, fieldName: string): TablePreferenceConfig {
    if (!config || typeof config !== 'object' || Array.isArray(config))
      throw new BadRequestException(`${fieldName}必须是对象`);

    return {
      order: this.normalizeKeyArray(config.order, `${fieldName}.order`),
      hidden: this.normalizeKeyArray(config.hidden, `${fieldName}.hidden`),
      widths: this.normalizeWidths(config.widths, `${fieldName}.widths`),
      defaultOrderKeys: this.normalizeKeyArray(config.defaultOrderKeys, `${fieldName}.defaultOrderKeys`),
      defaultHiddenKeys: this.normalizeKeyArray(config.defaultHiddenKeys, `${fieldName}.defaultHiddenKeys`),
      orderCustomized: this.normalizeBoolean(config.orderCustomized, `${fieldName}.orderCustomized`),
      hiddenCustomized: this.normalizeBoolean(config.hiddenCustomized, `${fieldName}.hiddenCustomized`),
    };
  }

  private normalizeKeyArray(value: unknown, fieldName: string) {
    if (!Array.isArray(value))
      throw new BadRequestException(`${fieldName}必须是数组`);
    const keys = value.map((item) => {
      if (typeof item !== 'string')
        throw new BadRequestException(`${fieldName}只能包含字符串`);
      const key = item.trim();
      if (!key)
        throw new BadRequestException(`${fieldName}不能包含空值`);
      if (key.length > 160)
        throw new BadRequestException(`${fieldName}单项不能超过160个字符`);
      return key;
    });
    return [...new Set(keys)];
  }

  private normalizeWidths(value: unknown, fieldName: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException(`${fieldName}必须是对象`);
    const widths: Record<string, number> = {};
    for (const [rawKey, rawWidth] of Object.entries(value)) {
      const key = rawKey.trim();
      if (!key)
        throw new BadRequestException(`${fieldName}不能包含空列名`);
      if (key.length > 160)
        throw new BadRequestException(`${fieldName}列名不能超过160个字符`);
      const width = Number(rawWidth);
      if (!Number.isFinite(width) || width <= 0)
        throw new BadRequestException(`${fieldName}.${key}必须是正数`);
      widths[key] = Math.round(width);
    }
    return widths;
  }

  private normalizeBoolean(value: unknown, fieldName: string) {
    if (typeof value !== 'boolean')
      throw new BadRequestException(`${fieldName}必须是布尔值`);
    return value;
  }

}
