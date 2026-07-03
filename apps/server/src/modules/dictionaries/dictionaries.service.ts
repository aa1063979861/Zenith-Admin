import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { Client } from '../../entities/client.entity';
import { DictionaryItem, DictionaryType } from '../../entities/dictionary-item.entity';
import { EmployeeProfile } from '../../entities/employee-profile.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { createDictionaryItemCode } from './dictionary-code';
import { syncDictionaryItemReferences } from './dictionary-reference-sync';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';

const SUPPORTED_DICTIONARY_TYPES: DictionaryType[] = ['region', 'position'];
const VISIBLE_DICTIONARY_TYPES: DictionaryType[] = ['region', 'position'];

type DictionaryDefinition = {
  dictionaryType: DictionaryType;
  dictionaryName: string;
  itemCodeLabel: string;
  nameLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
  businessScene: string;
  manageMode: string;
  remark: string;
  systemPreset: boolean;
};

const PRESET_DICTIONARY_DEFINITIONS: DictionaryDefinition[] = [
  {
    dictionaryType: 'region',
    dictionaryName: '区划',
    itemCodeLabel: '区划项编码',
    nameLabel: '区划名称',
    codePlaceholder: '例如：KJ_Code',
    namePlaceholder: '例如：达州市',
    businessScene: '客户归属、单位库导入、订单筛选',
    manageMode: '系统统一维护',
    remark: '导入单位库时按区划名称匹配，停用后不再出现在业务下拉中。',
    systemPreset: true,
  },
  {
    dictionaryType: 'position',
    dictionaryName: '职位',
    itemCodeLabel: '职位项编码',
    nameLabel: '职位名称',
    codePlaceholder: '例如：TBY_Code',
    namePlaceholder: '例如：财报完成人',
    businessScene: '员工档案、团队岗位、用户资料',
    manageMode: '系统统一维护',
    remark: '用户和团队页面引用职位编码，不在员工表单中手写职位。',
    systemPreset: true,
  },
];

@Injectable()
export class DictionariesService {
  constructor(
    @InjectRepository(DictionaryItem) private readonly dictionaryRepository: Repository<DictionaryItem>,
    private readonly dataSource: DataSource,
  ) {}

  async list(query: { type?: string; enabled?: string | number }) {
    const where: Record<string, unknown> = {};
    if (query.type)
      where.dictionaryType = this.ensureSupportedDictionaryType(query.type);
    else
      where.dictionaryType = In(VISIBLE_DICTIONARY_TYPES);
    if (query.enabled !== undefined && query.enabled !== null && query.enabled !== '')
      where.enabled = Number(query.enabled) === 1;
    const rows = await this.dictionaryRepository.find({ where, order: { dictionaryType: 'ASC', sort: 'ASC', id: 'ASC' } });
    return rows.map(row => this.toDto(row));
  }

  async listDefinitions() {
    return PRESET_DICTIONARY_DEFINITIONS.map(definition => this.toDefinitionDto(definition));
  }

  async create(dto: CreateDictionaryItemDto) {
    const dictionaryType = this.ensureSupportedDictionaryType(dto.dictionaryType);
    const name = this.requiredName(dto.name);
    const code = this.resolveCode(name);
    if (!code)
      throw new BadRequestException('字典编码生成失败，请检查字典名称');
    await this.ensureCodeAvailable(this.dictionaryRepository, dictionaryType, code);
    await this.ensureNameAvailable(this.dictionaryRepository, dictionaryType, name);
    const item = this.dictionaryRepository.create({
      dictionaryType,
      code,
      name,
      enabled: dto.enabled ?? true,
      sort: dto.sort || 1,
      remark: dto.remark?.trim() || null,
    });
    return this.toDto(await this.dictionaryRepository.save(item));
  }

  async update(id: number, dto: UpdateDictionaryItemDto) {
    return this.dataSource.transaction(async (manager) => {
      const dictionaryRepository = manager.getRepository(DictionaryItem);
      const item = await this.findOneInRepository(dictionaryRepository, id);
      const oldCode = item.code;
      const oldName = item.name;
      const name = dto.name !== undefined ? this.requiredName(dto.name) : item.name;
      const code = this.resolveCode(name);
      if (!code)
        throw new BadRequestException('字典编码生成失败，请检查字典名称');

      await this.ensureNameAvailable(dictionaryRepository, item.dictionaryType, name, id);
      await this.ensureCodeAvailable(dictionaryRepository, item.dictionaryType, code, id);
      item.name = name;
      item.code = code;

      if (dto.enabled !== undefined)
        item.enabled = dto.enabled;
      if (dto.sort !== undefined)
        item.sort = dto.sort;
      if (dto.remark !== undefined)
        item.remark = dto.remark.trim() || null;

      const saved = await dictionaryRepository.save(item);
      if (saved.code !== oldCode || saved.name !== oldName) {
        await syncDictionaryItemReferences(manager, {
          dictionaryType: saved.dictionaryType,
          oldCode,
          newCode: saved.code,
          oldName,
          newName: saved.name,
        });
      }

      return this.toDto(saved);
    });
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    await this.assertNotReferenced(item);
    await this.dictionaryRepository.softRemove(item);
    return true;
  }

  async findEnabled(type: DictionaryType, code: string) {
    return this.dictionaryRepository.findOne({ where: { dictionaryType: type, code, enabled: true } });
  }

  async findOne(id: number) {
    return this.findOneInRepository(this.dictionaryRepository, id);
  }

  private async findOneInRepository(repository: Repository<DictionaryItem>, id: number) {
    const item = await repository.findOne({ where: { id } });
    if (!item)
      throw new NotFoundException('字典项不存在');
    return item;
  }

  private resolveCode(name: string) {
    return createDictionaryItemCode(name);
  }

  private ensureSupportedDictionaryType(dictionaryType: string): DictionaryType {
    if (!SUPPORTED_DICTIONARY_TYPES.includes(dictionaryType as DictionaryType))
      throw new BadRequestException('字典类型仅支持区划、职位');
    return dictionaryType as DictionaryType;
  }

  private toDefinitionDto(definition: DictionaryDefinition) {
    return {
      ...definition,
      dictionaryCode: createDictionaryItemCode(definition.dictionaryName),
    };
  }

  private toDto(row: DictionaryItem) {
    return {
      ...row,
    };
  }

  private requiredName(value: string) {
    const name = value.trim();
    if (!name)
      throw new BadRequestException('字典名称不能为空');
    return name;
  }

  private async ensureCodeAvailable(repository: Repository<DictionaryItem>, dictionaryType: DictionaryType, code: string, currentId?: number) {
    const where = currentId
      ? { dictionaryType, code, id: Not(currentId) }
      : { dictionaryType, code };
    const codeExists = await repository.exists({ where });
    if (codeExists)
      throw new BadRequestException('字典编码已存在');
  }

  private async ensureNameAvailable(repository: Repository<DictionaryItem>, dictionaryType: DictionaryType, name: string, currentId?: number) {
    const where = currentId
      ? { dictionaryType, name, id: Not(currentId) }
      : { dictionaryType, name };
    const nameExists = await repository.exists({ where });
    if (nameExists)
      throw new BadRequestException('字典名称已存在');
  }

  private async assertNotReferenced(item: DictionaryItem) {
    const references = await this.countReferences(item);
    const usedReferences = references.filter(reference => reference.count > 0);
    if (!usedReferences.length)
      return;

    const detail = usedReferences
      .map(reference => `${reference.label}${reference.count}条`)
      .join('、');
    throw new BadRequestException(`字典项「${item.name}」已被${detail}引用，不能删除；如需停用请关闭启用状态`);
  }

  private async countReferences(item: DictionaryItem) {
    if (item.dictionaryType === 'region') {
      const [clientCount, orderCount, serviceItemCount] = await Promise.all([
        this.dataSource.getRepository(Client).count({ where: { regionCode: item.code } }),
        this.dataSource.getRepository(Order).count({ where: { regionCode: item.code } }),
        this.dataSource.getRepository(ServiceItem).count({ where: { regionCode: item.code } }),
      ]);
      return [
        { label: '客户', count: clientCount },
        { label: '订单', count: orderCount },
        { label: '服务项', count: serviceItemCount },
      ];
    }

    const profileCount = await this.dataSource.getRepository(EmployeeProfile).count({ where: { positionCode: item.code } });
    return [{ label: '员工档案', count: profileCount }];
  }
}
