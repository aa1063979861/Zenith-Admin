import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalBooleanFlag, parseOptionalIntegerIn } from '../../common/query';
import { DictionaryItem } from '../../entities/dictionary-item.entity';
import { EmployeeProfile } from '../../entities/employee-profile.entity';
import { OrgDepartment } from '../../entities/org-department.entity';
import { User } from '../../entities/user.entity';
import { UpdateTeamProfileDto } from './dto/update-team-profile.dto';

const TEAM_SORT_COLUMNS: Record<string, string> = {
  employeeName: 'employeeProfile.name',
  username: 'user.username',
  departmentName: 'employeeProfile.departmentName',
  positionName: 'employeeProfile.positionName',
  employeeNo: 'employeeProfile.employeeNo',
  gender: 'user.gender',
  phone: 'employeeProfile.phone',
  email: 'user.email',
  entryDate: 'employeeProfile.entryDate',
  leaveDate: 'employeeProfile.leaveDate',
  active: 'employeeProfile.active',
};

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(EmployeeProfile) private readonly employeeRepository: Repository<EmployeeProfile>,
    @InjectRepository(DictionaryItem) private readonly dictionaryRepository: Repository<DictionaryItem>,
    @InjectRepository(OrgDepartment) private readonly departmentRepository: Repository<OrgDepartment>,
  ) {}

  async employees() {
    const users = await this.userRepository.find({
      where: { userKind: 'EMPLOYEE', enable: true },
      relations: ['employeeProfile'],
      order: { id: 'ASC' },
    });
    return users.filter(user => user.employeeProfile?.active).map(user => ({
      id: user.id,
      name: user.employeeProfile?.name || user.nickName || user.username,
      role: this.resolveEmployeePositionName(user.employeeProfile),
      departmentName: user.employeeProfile?.departmentName || '',
      active: !!user.employeeProfile?.active && user.enable,
    }));
  }

  async summary() {
    const users = await this.userRepository.find({
      where: { userKind: 'EMPLOYEE' },
      relations: ['employeeProfile'],
    });
    const activeCount = users.filter(user => user.employeeProfile?.active).length;
    const activeUsers = users.filter(user => user.employeeProfile?.active);
    const departmentCodes = new Set(users.map(user => user.employeeProfile?.departmentCode).filter(Boolean));
    const positionCodes = new Set(users.map(user => user.employeeProfile?.positionCode).filter(Boolean));
    const missingProfileCount = activeUsers.filter(user => this.profileIssues(user).length > 0).length;

    return {
      total: users.length,
      active: activeCount,
      inactive: users.length - activeCount,
      departments: departmentCodes.size,
      positions: positionCodes.size,
      missingDepartmentCount: activeUsers.filter(user => !user.employeeProfile?.departmentCode).length,
      missingPositionCount: activeUsers.filter(user => !user.employeeProfile?.positionCode).length,
      missingEmployeeNoCount: activeUsers.filter(user => !user.employeeProfile?.employeeNo).length,
      missingPhoneCount: activeUsers.filter(user => !user.employeeProfile?.phone).length,
      missingEntryDateCount: activeUsers.filter(user => !user.employeeProfile?.entryDate).length,
      missingEmergencyContactCount: activeUsers.filter(user => !user.employeeProfile?.emergencyContact || !user.employeeProfile?.emergencyPhone).length,
      missingProfileCount,
      departmentStats: this.buildDepartmentStats(users),
    };
  }

  async page(query: {
    pageNo?: number;
    pageSize?: number;
    keyword?: string;
    username?: string;
    active?: string | number;
    gender?: string | number;
    positionCode?: string;
    departmentCode?: string;
    sortKey?: string;
    sortOrder?: string;
  }) {
    const { pageSize, skip } = normalizePage(query);
    const active = parseOptionalBooleanFlag(query.active, '在职状态');
    const gender = parseOptionalIntegerIn(query.gender, '性别', [0, 1, 2]);
    const builder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.employeeProfile', 'employeeProfile')
      .leftJoin('employeeProfile.department', 'department')
      .leftJoin(DictionaryItem, 'positionItem', 'positionItem.dictionaryType = :positionDictionaryType AND positionItem.code = employeeProfile.positionCode', { positionDictionaryType: 'position' })
      .addSelect('CASE WHEN employeeProfile.departmentId IS NULL THEN 1 ELSE 0 END', 'departmentMissingOrder')
      .addSelect('department.sort_order', 'departmentSortOrder')
      .addSelect('department.id', 'departmentIdOrder')
      .addSelect('CASE WHEN employeeProfile.positionCode IS NULL THEN 1 ELSE 0 END', 'positionMissingOrder')
      .addSelect('positionItem.sort_order', 'positionSortOrder')
      .where('user.userKind = :userKind', { userKind: 'EMPLOYEE' });

    const keyword = query.keyword?.trim() || query.username?.trim();
    if (keyword) {
      builder.andWhere(new Brackets((qb) => {
        qb.where('user.username LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('user.nickName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('employeeProfile.name LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('employeeProfile.employeeNo LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('employeeProfile.phone LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }
    if (active !== null)
      builder.andWhere('employeeProfile.active = :active', { active });
    if (gender !== null)
      builder.andWhere('user.gender = :gender', { gender });
    if (query.positionCode?.trim())
      builder.andWhere('employeeProfile.positionCode = :positionCode', { positionCode: query.positionCode.trim() });
    if (query.departmentCode?.trim())
      builder.andWhere('employeeProfile.departmentCode = :departmentCode', { departmentCode: query.departmentCode.trim() });

    const sort = this.resolveTeamSort(query.sortKey, query.sortOrder);
    if (sort) {
      builder
        .orderBy(sort.column, sort.direction)
        .addOrderBy('user.id', 'ASC');
    }
    else {
      builder
        .orderBy('employeeProfile.active', 'DESC')
        .addOrderBy('departmentMissingOrder', 'ASC')
        .addOrderBy('departmentSortOrder', 'ASC')
        .addOrderBy('departmentIdOrder', 'ASC')
        .addOrderBy('employeeProfile.departmentName', 'ASC')
        .addOrderBy('positionMissingOrder', 'ASC')
        .addOrderBy('positionSortOrder', 'ASC')
        .addOrderBy('employeeProfile.positionName', 'ASC')
        .addOrderBy('user.id', 'ASC');
    }

    const [users, total] = await builder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return pageResult(users.map(user => this.toListItem(user)), total);
  }

  async updateProfile(userId: number, dto: UpdateTeamProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'employeeProfile'],
    });
    if (!user || user.userKind !== 'EMPLOYEE' || !user.employeeProfile)
      throw new NotFoundException('员工不存在');

    const profile = user.employeeProfile;
    const position = dto.positionCode !== undefined ? await this.resolvePosition(dto.positionCode) : null;
    const department = dto.departmentCode !== undefined ? await this.resolveDepartment(dto.departmentCode) : null;

    if (dto.employeeName !== undefined) {
      const name = dto.employeeName.trim();
      if (!name)
        throw new BadRequestException('员工姓名不能为空');
      user.nickName = name;
      profile.name = name;
    }
    if (dto.gender !== undefined)
      user.gender = dto.gender;
    if (dto.email !== undefined)
      user.email = this.optionalText(dto.email);
    if (dto.address !== undefined)
      user.address = this.optionalText(dto.address);
    if (dto.positionCode !== undefined) {
      profile.positionCode = position?.code || null;
      profile.positionName = position?.name || null;
    }
    if (dto.departmentCode !== undefined) {
      profile.departmentId = department?.id || null;
      profile.departmentCode = department?.code || null;
      profile.departmentName = department?.name || null;
    }
    if (dto.employeeNo !== undefined)
      profile.employeeNo = this.optionalText(dto.employeeNo);
    if (dto.phone !== undefined)
      profile.phone = this.optionalText(dto.phone);
    if (dto.entryDate !== undefined)
      profile.entryDate = this.optionalDate(dto.entryDate, '入职日期');
    if (dto.birthday !== undefined)
      profile.birthday = this.optionalDate(dto.birthday, '出生日期');
    if (dto.active !== undefined) {
      profile.active = dto.active;
      if (!dto.active)
        user.enable = false;
    }
    if (dto.leaveDate !== undefined)
      profile.leaveDate = this.optionalDate(dto.leaveDate, '离职日期');
    if (profile.active)
      profile.leaveDate = null;
    if (!profile.active && !profile.leaveDate)
      throw new BadRequestException('员工离职时必须填写离职日期');
    if (dto.emergencyContact !== undefined)
      profile.emergencyContact = this.optionalText(dto.emergencyContact);
    if (dto.emergencyPhone !== undefined)
      profile.emergencyPhone = this.optionalText(dto.emergencyPhone);
    if (dto.profileRemark !== undefined)
      profile.remark = this.optionalText(dto.profileRemark);

    await this.userRepository.save(user);
    await this.employeeRepository.save(profile);
    return this.toListItem(user);
  }

  private toListItem(user: User) {
    return {
      id: user.id,
      username: user.username,
      nickName: user.nickName,
      gender: user.gender,
      email: user.email,
      address: user.address,
      enable: user.enable,
      builtIn: user.builtIn,
      userKind: user.userKind,
      roles: user.roles || [],
      createTime: user.createTime,
      employeeName: user.employeeProfile?.name,
      positionCode: user.employeeProfile?.positionCode,
      positionName: this.resolveEmployeePositionName(user.employeeProfile),
      departmentId: user.employeeProfile?.departmentId,
      departmentCode: user.employeeProfile?.departmentCode,
      departmentName: user.employeeProfile?.departmentName,
      employeeNo: user.employeeProfile?.employeeNo,
      phone: user.employeeProfile?.phone,
      entryDate: user.employeeProfile?.entryDate,
      birthday: user.employeeProfile?.birthday,
      leaveDate: user.employeeProfile?.leaveDate,
      emergencyContact: user.employeeProfile?.emergencyContact,
      emergencyPhone: user.employeeProfile?.emergencyPhone,
      profileRemark: user.employeeProfile?.remark,
      active: !!user.employeeProfile?.active,
    };
  }

  private resolveEmployeePositionName(profile?: EmployeeProfile | null) {
    return profile?.positionName || '未设置';
  }

  private profileIssues(user: User) {
    const profile = user.employeeProfile;
    if (!profile?.active)
      return [];
    return [
      profile.departmentCode ? null : 'department',
      profile.positionCode ? null : 'position',
      profile.employeeNo ? null : 'employeeNo',
      profile.phone ? null : 'phone',
      profile.entryDate ? null : 'entryDate',
      profile.emergencyContact && profile.emergencyPhone ? null : 'emergencyContact',
    ].filter(Boolean);
  }

  private async resolvePosition(positionCode: string | undefined) {
    const code = positionCode?.trim();
    if (!code)
      return null;
    const position = await this.dictionaryRepository.findOne({
      where: { dictionaryType: 'position', code, enabled: true },
    });
    if (!position)
      throw new BadRequestException('职位不存在或已停用');
    return position;
  }

  private async resolveDepartment(departmentCode: string | undefined) {
    const code = departmentCode?.trim();
    if (!code)
      return null;
    const department = await this.departmentRepository.findOne({ where: { code, enabled: true } });
    if (!department)
      throw new BadRequestException('部门不存在或已停用');
    return department;
  }

  private optionalText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private optionalDate(value?: string | null, label?: string) {
    const text = value?.trim();
    if (!text)
      return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
      throw new BadRequestException(`${label || '日期'}格式必须为 YYYY-MM-DD`);
    return text;
  }

  private buildDepartmentStats(users: User[]) {
    const stats = new Map<string, {
      departmentCode: string | null;
      departmentName: string;
      total: number;
      active: number;
      inactive: number;
    }>();

    for (const user of users) {
      const profile = user.employeeProfile;
      const departmentCode = profile?.departmentCode?.trim() || null;
      const departmentName = profile?.departmentName?.trim() || departmentCode || '未设置';
      const key = departmentCode || '__unset__';
      const current = stats.get(key) || {
        departmentCode,
        departmentName,
        total: 0,
        active: 0,
        inactive: 0,
      };

      current.total += 1;
      if (profile?.active)
        current.active += 1;
      else
        current.inactive += 1;
      stats.set(key, current);
    }

    return [...stats.values()].sort((a, b) => {
      if (!a.departmentCode)
        return 1;
      if (!b.departmentCode)
        return -1;
      return a.departmentName.localeCompare(b.departmentName, 'zh-CN');
    });
  }

  private resolveTeamSort(sortKey?: string, sortOrder?: string) {
    const key = sortKey?.trim();
    if (!key || !sortOrder)
      return null;
    const column = TEAM_SORT_COLUMNS[key];
    if (!column)
      return null;
    if (sortOrder === 'ascend')
      return { column, direction: 'ASC' as const };
    if (sortOrder === 'descend')
      return { column, direction: 'DESC' as const };
    return null;
  }
}
