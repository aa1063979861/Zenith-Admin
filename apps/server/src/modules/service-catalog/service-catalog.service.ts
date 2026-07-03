import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ServiceCatalog } from '../../entities/service-catalog.entity';
import { createDictionaryItemCode } from '../dictionaries/dictionary-code';
import { CreateServiceCatalogDto } from './dto/create-service-catalog.dto';
import { UpdateServiceCatalogDto } from './dto/update-service-catalog.dto';
import { SERVICE_CATALOG_RULES, normalizeServiceCatalogCategory } from './service-catalog.constants';

@Injectable()
export class ServiceCatalogService {
  constructor(
    @InjectRepository(ServiceCatalog) private readonly serviceCatalogRepository: Repository<ServiceCatalog>,
  ) {}

  async list(query: { enabled?: string | number } = {}) {
    const where: Record<string, unknown> = {};
    if (query.enabled !== undefined && query.enabled !== null && query.enabled !== '')
      where.enabled = Number(query.enabled) === 1;
    const rows = await this.serviceCatalogRepository.find({ where, order: { sort: 'ASC', id: 'ASC' } });
    return rows.map(row => this.toDto(row));
  }

  async create(dto: CreateServiceCatalogDto) {
    const name = this.requiredName(dto.name);
    const code = createDictionaryItemCode(name);
    if (!code)
      throw new BadRequestException('服务编码生成失败，请检查服务名称');
    await this.ensureAvailable(code, name);
    const rule = SERVICE_CATALOG_RULES[dto.category];
    const row = this.serviceCatalogRepository.create({
      code,
      name,
      category: dto.category,
      defaultPrice: String(dto.defaultPrice || 0),
      minMonths: rule.minMonths,
      reminderEnabled: rule.reminderEnabled,
      enabled: dto.enabled ?? true,
      sort: dto.sort || 1,
      remark: dto.remark?.trim() || null,
    });
    return this.toDto(await this.serviceCatalogRepository.save(row));
  }

  async update(id: number, dto: UpdateServiceCatalogDto) {
    const row = await this.findOne(id);
    if (dto.name !== undefined) {
      const name = this.requiredName(dto.name);
      const code = createDictionaryItemCode(name);
      if (!code)
        throw new BadRequestException('服务编码生成失败，请检查服务名称');
      await this.ensureAvailable(code, name, id);
      row.code = code;
      row.name = name;
    }
    if (dto.category !== undefined) {
      const rule = SERVICE_CATALOG_RULES[dto.category];
      row.category = dto.category;
      row.minMonths = rule.minMonths;
      row.reminderEnabled = rule.reminderEnabled;
    }
    if (dto.defaultPrice !== undefined)
      row.defaultPrice = String(dto.defaultPrice);
    if (dto.enabled !== undefined)
      row.enabled = dto.enabled;
    if (dto.sort !== undefined)
      row.sort = dto.sort;
    if (dto.remark !== undefined)
      row.remark = dto.remark.trim() || null;
    return this.toDto(await this.serviceCatalogRepository.save(row));
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    await this.serviceCatalogRepository.softRemove(row);
    return true;
  }

  async findEnabledByCodeOrName(codeOrName: string) {
    const value = codeOrName.trim();
    if (!value)
      return null;
    const byCode = await this.serviceCatalogRepository.findOne({ where: { code: value, enabled: true } });
    if (byCode)
      return byCode;
    return this.serviceCatalogRepository.findOne({ where: { name: value, enabled: true } });
  }

  async findByCodeOrName(codeOrName: string) {
    const value = codeOrName.trim();
    if (!value)
      return null;
    const byCode = await this.serviceCatalogRepository.findOne({ where: { code: value } });
    if (byCode)
      return byCode;
    return this.serviceCatalogRepository.findOne({ where: { name: value } });
  }

  private async findOne(id: number) {
    const row = await this.serviceCatalogRepository.findOne({ where: { id } });
    if (!row)
      throw new NotFoundException('服务目录不存在');
    return row;
  }

  private requiredName(value: string) {
    const name = value.trim();
    if (!name)
      throw new BadRequestException('服务名称不能为空');
    return name;
  }

  private async ensureAvailable(code: string, name: string, currentId?: number) {
    const codeWhere = currentId ? { code, id: Not(currentId) } : { code };
    const nameWhere = currentId ? { name, id: Not(currentId) } : { name };
    const [codeExists, nameExists] = await Promise.all([
      this.serviceCatalogRepository.exists({ where: codeWhere }),
      this.serviceCatalogRepository.exists({ where: nameWhere }),
    ]);
    if (codeExists)
      throw new BadRequestException('服务编码已存在');
    if (nameExists)
      throw new BadRequestException('服务名称已存在');
  }

  private toDto(row: ServiceCatalog) {
    return {
      ...row,
      category: normalizeServiceCatalogCategory(row.category),
      defaultPrice: Number(row.defaultPrice || 0),
    };
  }
}
