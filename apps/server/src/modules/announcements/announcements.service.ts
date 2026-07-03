import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { normalizePage, pageResult } from '../../common/page';
import { Announcement } from '../../entities/announcement.entity';
import { User } from '../../entities/user.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

type AnnouncementQuery = {
  pageNo?: number;
  pageSize?: number;
  keyword?: string;
  type?: string;
  enabled?: string | number | boolean;
};

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement) private readonly announcementRepository: Repository<Announcement>,
  ) {}

  async page(query: AnnouncementQuery = {}) {
    const { pageSize, skip } = normalizePage(query);
    const qb = this.announcementRepository.createQueryBuilder('announcement').skip(skip).take(pageSize);
    const enabled = this.parseBooleanQuery(query.enabled);

    if (enabled !== undefined)
      qb.andWhere('announcement.enabled = :enabled', { enabled });
    if (query.type)
      qb.andWhere('announcement.type = :type', { type: query.type });

    const keyword = query.keyword?.trim();
    if (keyword) {
      qb.andWhere(new Brackets((builder) => {
        builder
          .where('announcement.title LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('announcement.content LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }

    qb
      .orderBy('announcement.pinned', 'DESC')
      .addOrderBy('announcement.sort', 'ASC')
      .addOrderBy('announcement.publishAt', 'DESC')
      .addOrderBy('announcement.id', 'DESC');

    const [rows, total] = await qb.getManyAndCount();
    return pageResult(rows.map(row => this.toDto(row)), total);
  }

  async active(limit = 5) {
    const now = new Date();
    const rows = await this.announcementRepository.createQueryBuilder('announcement')
      .where('announcement.enabled = :enabled', { enabled: true })
      .andWhere('(announcement.publishAt IS NULL OR announcement.publishAt <= :now)', { now })
      .andWhere('(announcement.expireAt IS NULL OR announcement.expireAt >= :now)', { now })
      .orderBy('announcement.pinned', 'DESC')
      .addOrderBy('announcement.sort', 'ASC')
      .addOrderBy('announcement.publishAt', 'DESC')
      .addOrderBy('announcement.id', 'DESC')
      .take(this.normalizeLimit(limit))
      .getMany();
    return rows.map(row => this.toDto(row));
  }

  async create(dto: CreateAnnouncementDto, user?: User) {
    const publishAt = this.parseDateBoundary(dto.publishAt, 'start');
    const expireAt = this.parseDateBoundary(dto.expireAt, 'end');
    this.assertDateRange(publishAt, expireAt);

    const row = this.announcementRepository.create({
      title: this.requiredText(dto.title, '公告标题'),
      content: this.requiredText(dto.content, '公告内容'),
      type: dto.type || '通知',
      enabled: dto.enabled ?? true,
      pinned: dto.pinned ?? false,
      sort: dto.sort || 1,
      publishAt,
      expireAt,
      creatorId: user?.id || null,
      creatorName: user?.nickName || user?.username || null,
    });
    return this.toDto(await this.announcementRepository.save(row));
  }

  async update(id: number, dto: UpdateAnnouncementDto) {
    const row = await this.findOne(id);
    const publishAt = dto.publishAt !== undefined ? this.parseDateBoundary(dto.publishAt, 'start') : row.publishAt || null;
    const expireAt = dto.expireAt !== undefined ? this.parseDateBoundary(dto.expireAt, 'end') : row.expireAt || null;
    this.assertDateRange(publishAt, expireAt);

    if (dto.title !== undefined)
      row.title = this.requiredText(dto.title, '公告标题');
    if (dto.content !== undefined)
      row.content = this.requiredText(dto.content, '公告内容');
    if (dto.type !== undefined)
      row.type = dto.type;
    if (dto.enabled !== undefined)
      row.enabled = dto.enabled;
    if (dto.pinned !== undefined)
      row.pinned = dto.pinned;
    if (dto.sort !== undefined)
      row.sort = dto.sort;
    if (dto.publishAt !== undefined)
      row.publishAt = publishAt;
    if (dto.expireAt !== undefined)
      row.expireAt = expireAt;

    return this.toDto(await this.announcementRepository.save(row));
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    await this.announcementRepository.softRemove(row);
    return true;
  }

  private async findOne(id: number) {
    const row = await this.announcementRepository.findOne({ where: { id } });
    if (!row)
      throw new NotFoundException('通知公告不存在');
    return row;
  }

  private requiredText(value: string, label: string) {
    const text = value.trim();
    if (!text)
      throw new BadRequestException(`${label}不能为空`);
    return text;
  }

  private parseDateBoundary(value: string | null | undefined, boundary: 'start' | 'end') {
    if (value === undefined || value === null || value === '')
      return null;

    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!matched)
      throw new BadRequestException('日期格式必须为 YYYY-MM-DD');

    const year = Number(matched[1]);
    const month = Number(matched[2]) - 1;
    const day = Number(matched[3]);
    const date = boundary === 'start'
      ? new Date(year, month, day, 0, 0, 0, 0)
      : new Date(year, month, day, 23, 59, 59, 999);

    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
      throw new BadRequestException('日期值无效');
    return date;
  }

  private assertDateRange(publishAt: Date | null, expireAt: Date | null) {
    if (publishAt && expireAt && expireAt < publishAt)
      throw new BadRequestException('过期日期不能早于发布日期');
  }

  private parseBooleanQuery(value: string | number | boolean | undefined) {
    if (value === undefined || value === null || value === '')
      return undefined;
    if (value === true || value === 1 || value === '1' || value === 'true')
      return true;
    if (value === false || value === 0 || value === '0' || value === 'false')
      return false;
    throw new BadRequestException('状态参数异常');
  }

  private normalizeLimit(value: number) {
    const limit = Number(value || 5);
    if (!Number.isFinite(limit))
      return 5;
    return Math.min(Math.max(limit, 1), 20);
  }

  private formatDate(value?: Date | null) {
    if (!value)
      return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toDto(row: Announcement) {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      enabled: row.enabled,
      pinned: row.pinned,
      sort: row.sort,
      publishAt: this.formatDate(row.publishAt),
      expireAt: this.formatDate(row.expireAt),
      creatorId: row.creatorId,
      creatorName: row.creatorName,
      createTime: row.createTime,
      updateTime: row.updateTime,
    };
  }
}
