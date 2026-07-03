import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { pinyin } from 'pinyin-pro';
import { Brackets, In, Repository } from 'typeorm';
import { normalizePage, pageResult } from '../../common/page';
import { parseOptionalBooleanFlag, parseOptionalIntegerIn, parseOptionalPositiveInt, parseOptionalStringIn } from '../../common/query';
import { PROFILE_AVATAR_UPLOAD, UPLOAD_ROOT_DIR, UPLOAD_URL_PREFIX } from '../../common/upload.constants';
import { EmployeeProfile } from '../../entities/employee-profile.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { SystemParametersService } from '../system-parameters/system-parameters.service';
import {
  DEFAULT_EMPLOYEE_INITIAL_PASSWORD,
  EMPLOYEE_INITIAL_PASSWORD_KEY,
} from '../system-parameters/system-parameter-registry';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SORT_COLUMNS: Record<string, string> = {
  employeeName: 'employeeProfile.name',
  username: 'user.username',
  departmentName: 'employeeProfile.departmentName',
  positionName: 'employeeProfile.positionName',
  employeeNo: 'employeeProfile.employeeNo',
  phone: 'employeeProfile.phone',
  email: 'user.email',
  createTime: 'user.createTime',
  createDate: 'user.createTime',
  enable: 'user.enable',
};

export type UploadedProfileAvatarFile = {
  originalname: string;
  path?: string;
  buffer?: Buffer;
};

const USER_KIND_VALUES: readonly User['userKind'][] = ['SYSTEM_ADMIN', 'EMPLOYEE'];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(EmployeeProfile) private readonly employeeRepository: Repository<EmployeeProfile>,
    private readonly parametersService: SystemParametersService,
  ) {}

  async page(query: {
    pageNo?: number;
    pageSize?: number;
    keyword?: string;
    username?: string;
    enable?: string | number;
    userKind?: User['userKind'];
    gender?: string | number;
    positionCode?: string;
    departmentCode?: string;
    roleId?: string | number;
    sortKey?: string;
    sortOrder?: string;
  }) {
    const { pageSize, skip } = normalizePage(query);
    const enable = parseOptionalBooleanFlag(query.enable, '账号状态');
    const gender = parseOptionalIntegerIn(query.gender, '性别', [0, 1, 2]);
    const roleId = parseOptionalPositiveInt(query.roleId, '角色ID');
    const userKind = parseOptionalStringIn(query.userKind, '用户类型', USER_KIND_VALUES);
    const builder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'roles')
      .leftJoinAndSelect('user.employeeProfile', 'employeeProfile');

    if (userKind)
      builder.where('user.userKind = :userKind', { userKind });

    const keyword = query.keyword?.trim() || query.username?.trim();
    if (keyword) {
      builder.andWhere(new Brackets((qb) => {
        qb.where('user.username LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('user.nickName LIKE :keyword', { keyword: `%${keyword}%` })
          .orWhere('employeeProfile.name LIKE :keyword', { keyword: `%${keyword}%` });
      }));
    }
    if (enable !== null)
      builder.andWhere('user.enable = :enable', { enable });
    if (gender !== null)
      builder.andWhere('user.gender = :gender', { gender });
    if (query.positionCode?.trim())
      builder.andWhere('employeeProfile.positionCode = :positionCode', { positionCode: query.positionCode.trim() });
    if (query.departmentCode?.trim())
      builder.andWhere('employeeProfile.departmentCode = :departmentCode', { departmentCode: query.departmentCode.trim() });
    if (roleId !== null) {
      // 角色筛选使用独立join，避免列表展示时只加载被筛选命中的单个角色。
      builder.innerJoin('user.roles', 'roleFilter', 'roleFilter.id = :roleId', { roleId });
    }

    const sort = this.resolveUserSort(query.sortKey, query.sortOrder);
    if (sort) {
      builder
        .orderBy(sort.column, sort.direction)
        .addOrderBy('user.id', 'ASC');
    }
    else {
      builder
        .orderBy('user.builtIn', 'DESC')
        .addOrderBy('user.id', 'ASC');
    }

    const [users, total] = await builder
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    return pageResult(users.map(user => this.toListItem(user)), total);
  }

  async detail(userId: number, currentRoleCode?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['roles', 'employeeProfile'],
    });
    if (!user)
      throw new NotFoundException('用户不存在');

    return {
      id: user.id,
      username: user.username,
      userKind: user.userKind,
      builtIn: user.builtIn,
      enable: user.enable,
      roles: user.roles || [],
      currentRole: this.resolveCurrentRole(user, currentRoleCode),
      profile: {
        avatar: user.avatar,
        nickName: user.nickName,
        gender: user.gender,
        address: user.address,
        email: user.email,
        employeeName: user.employeeProfile?.name,
        employeeNo: user.employeeProfile?.employeeNo,
        departmentName: user.employeeProfile?.departmentName,
        positionName: this.resolveEmployeePositionName(user.employeeProfile),
        phone: user.employeeProfile?.phone,
        entryDate: user.employeeProfile?.entryDate,
        active: user.employeeProfile?.active,
      },
    };
  }

  async create(dto: CreateUserDto) {
    if (!dto.employeeName?.trim())
      throw new BadRequestException('员工姓名不能为空');

    const roles = await this.resolveAssignableRoles(dto.roleIds);
    const initialPassword = await this.getEmployeeInitialPassword();
    const username = await this.generateEmployeeUsername(dto.employeeName);
    const user = this.userRepository.create({
      username,
      passwordHash: await bcrypt.hash(initialPassword, 10),
      enable: dto.enable ?? true,
      userKind: 'EMPLOYEE',
      nickName: dto.employeeName.trim(),
      gender: 0,
      roles,
    });
    const saved = await this.userRepository.save(user);
    await this.employeeRepository.save(this.employeeRepository.create({
      userId: saved.id,
      name: dto.employeeName.trim(),
      active: true,
    }));
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    this.assertEmployeeManagementTarget(user);

    if (dto.roleIds !== undefined)
      user.roles = await this.resolveAssignableRoles(dto.roleIds);
    if (dto.enable !== undefined)
      user.enable = dto.enable;

    const saved = await this.userRepository.save(user);
    return this.findOne(saved.id);
  }

  async updateProfile(id: number, dto: UpdateProfileDto) {
    const user = await this.findOne(id);
    if (dto.avatar !== undefined)
      user.avatar = dto.avatar;
    if (dto.nickName !== undefined)
      user.nickName = dto.nickName;
    if (dto.gender !== undefined)
      user.gender = dto.gender;
    if (dto.address !== undefined)
      user.address = dto.address;
    if (dto.email !== undefined)
      user.email = dto.email;
    await this.userRepository.save(user);
    return this.findOne(id);
  }

  async saveProfileAvatarFile(file?: UploadedProfileAvatarFile) {
    if (!file?.path && !file?.buffer)
      throw new BadRequestException('请选择头像图片');

    const ext = extname(file.originalname || '').toLowerCase();
    if (!PROFILE_AVATAR_UPLOAD.ALLOWED_EXTENSIONS.includes(ext as typeof PROFILE_AVATAR_UPLOAD.ALLOWED_EXTENSIONS[number]))
      throw new BadRequestException('只能上传 png、jpg、jpeg、webp 或 gif 图片');

    const storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    const storageKey = `${PROFILE_AVATAR_UPLOAD.STORAGE_DIR}/${storedName}`;
    const absolutePath = join(process.cwd(), UPLOAD_ROOT_DIR, PROFILE_AVATAR_UPLOAD.STORAGE_DIR, storedName);
    await mkdir(dirname(absolutePath), { recursive: true });
    if (file.path)
      await rename(file.path, absolutePath);
    else
      await writeFile(absolutePath, file.buffer as Buffer);

    return { avatar: `${UPLOAD_URL_PREFIX}${storageKey}` };
  }

  async resetPassword(id: number) {
    const user = await this.findOne(id);
    this.assertEmployeeManagementTarget(user);
    const password = await this.getEmployeeInitialPassword();
    user.passwordHash = await bcrypt.hash(password, 10);
    await this.userRepository.save(user);
    return true;
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    this.assertEmployeeManagementTarget(user);
    await this.userRepository.softRemove(user);
    return true;
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'employeeProfile'],
    });
    if (!user)
      throw new NotFoundException('用户不存在');
    return user;
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
      departmentCode: user.employeeProfile?.departmentCode,
      departmentName: user.employeeProfile?.departmentName,
      departmentId: user.employeeProfile?.departmentId,
      employeeNo: user.employeeProfile?.employeeNo,
      phone: user.employeeProfile?.phone,
      entryDate: user.employeeProfile?.entryDate,
      birthday: user.employeeProfile?.birthday,
      emergencyContact: user.employeeProfile?.emergencyContact,
      emergencyPhone: user.employeeProfile?.emergencyPhone,
      profileRemark: user.employeeProfile?.remark,
      active: !!user.employeeProfile?.active && user.enable,
    };
  }

  private assertEmployeeManagementTarget(user: User) {
    if (user.builtIn || user.userKind !== 'EMPLOYEE')
      throw new BadRequestException('用户管理只能维护普通员工账号');
  }

  private async resolveAssignableRoles(roleIds?: number[]) {
    const ids = this.normalizeRoleIds(roleIds || []);
    if (!ids.length)
      return [];

    const roles = await this.roleRepository.findBy({ id: In(ids) });
    if (roles.length !== ids.length)
      throw new BadRequestException('存在无效角色');
    if (roles.some(role => !role.enable))
      throw new BadRequestException('停用角色不能授权给员工');
    return roles;
  }

  private normalizeRoleIds(roleIds: number[]) {
    const ids = roleIds.map(id => Number(id));
    if (ids.some(id => !Number.isInteger(id) || id <= 0))
      throw new BadRequestException('存在无效角色');
    return [...new Set(ids)];
  }

  private resolveEmployeePositionName(profile?: EmployeeProfile | null) {
    return profile?.positionName || '未设置';
  }

  private resolveUserSort(sortKey?: string, sortOrder?: string) {
    const key = sortKey?.trim();
    if (!key || !sortOrder)
      return null;
    const column = USER_SORT_COLUMNS[key];
    if (!column)
      return null;
    if (sortOrder === 'ascend')
      return { column, direction: 'ASC' as const };
    if (sortOrder === 'descend')
      return { column, direction: 'DESC' as const };
    return null;
  }

  private async generateEmployeeUsername(employeeName: string) {
    const baseUsername = this.buildUsernameBase(employeeName);
    let username = baseUsername;
    let suffix = 2;

    while (await this.usernameExists(username)) {
      username = `${baseUsername}${suffix}`;
      suffix += 1;
    }

    return username;
  }

  private async usernameExists(username: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.username = :username', { username })
      .getExists();
  }

  private buildUsernameBase(employeeName: string) {
    const pinyinText = pinyin(employeeName.trim(), {
      toneType: 'none',
      type: 'array',
      surname: 'head',
      nonZh: 'consecutive',
      v: true,
    }).join('');
    const username = pinyinText.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!username)
      throw new BadRequestException('员工姓名无法生成登录账号，请使用中文姓名或字母数字姓名');
    return username.slice(0, 70);
  }

  private resolveCurrentRole(user: User, currentRoleCode?: string) {
    if (user.builtIn)
      return null;
    const enabledRoles = (user.roles || []).filter(role => role.enable);
    if (!currentRoleCode)
      return enabledRoles[0] || null;
    return enabledRoles.find(role => role.code === currentRoleCode) || enabledRoles[0] || null;
  }

  private async getEmployeeInitialPassword() {
    const password = await this.parametersService.getEnabledValue(EMPLOYEE_INITIAL_PASSWORD_KEY, DEFAULT_EMPLOYEE_INITIAL_PASSWORD);
    return this.parametersService.validatePasswordLength(password, '员工初始密码');
  }
}
