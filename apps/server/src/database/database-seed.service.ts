import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { SERVER_DEFAULTS } from '../common/runtime.constants';
import { Announcement } from '../entities/announcement.entity';
import { DictionaryItem } from '../entities/dictionary-item.entity';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { SystemParameter } from '../entities/system-parameter.entity';
import { User } from '../entities/user.entity';
import { createDictionaryItemCode } from '../modules/dictionaries/dictionary-code';
import { syncDictionaryItemReferences } from '../modules/dictionaries/dictionary-reference-sync';
import { REGISTERED_SYSTEM_PARAMETERS } from '../modules/system-parameters/system-parameter-registry';

type SeedPermission = {
  code: string;
  name: string;
  type: 'MENU' | 'BUTTON';
  path?: string;
  component?: string;
  icon?: string;
  layout?: string | null;
  activeMenuCode?: string | null;
  order: number;
  show: boolean;
  parentId?: number | null;
  keepAlive?: boolean;
};

type SeedButtonPermission = Omit<SeedPermission, 'type' | 'show' | 'parentId'>;

const FINANCE_BUTTON_ORDERS: Record<string, number> = {
  ViewFinance: 1,
  MaintainFinanceContract: 2,
  MaintainFinanceInvoice: 3,
  MaintainFinancePayment: 4,
  MatchFinancePayment: 5,
  ImportFinancePayment: 6,
};

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Permission) private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(SystemParameter) private readonly parameterRepository: Repository<SystemParameter>,
    @InjectRepository(DictionaryItem) private readonly dictionaryRepository: Repository<DictionaryItem>,
    @InjectRepository(Announcement) private readonly announcementRepository: Repository<Announcement>,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureBuiltInAdmin();
    await this.ensureSystemParameters();
    await this.ensureDefaultAnnouncements();
    await this.normalizeDictionaryItems();
    await this.ensureSystemPermissions();
    await this.ensureJoinTableComments();
  }

  private async ensureBuiltInAdmin() {
    const username = process.env.SYSTEM_ADMIN_USERNAME || SERVER_DEFAULTS.SYSTEM_ADMIN_USERNAME;
    const password = process.env.SYSTEM_ADMIN_PASSWORD || SERVER_DEFAULTS.SYSTEM_ADMIN_PASSWORD;
    const existed = await this.userRepository.findOne({ where: { username } });
    if (existed) {
      let changed = false;
      if (!existed.nickName) {
        existed.nickName = '超级管理员';
        changed = true;
      }
      if (!existed.enable) {
        existed.enable = true;
        changed = true;
      }
      if (!existed.builtIn) {
        existed.builtIn = true;
        changed = true;
      }
      if (existed.userKind !== 'SYSTEM_ADMIN') {
        existed.userKind = 'SYSTEM_ADMIN';
        changed = true;
      }
      if (changed)
        await this.userRepository.save(existed);
      return;
    }

    await this.userRepository.save(this.userRepository.create({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      enable: true,
      builtIn: true,
      userKind: 'SYSTEM_ADMIN',
      nickName: '超级管理员',
      gender: 0,
    }));
  }

  private async ensureSystemPermissions() {
    const permissions: SeedPermission[] = [
      { code: 'TeamManagement', name: '组织管理', type: 'MENU', path: '/team', component: '/src/views/business/team/index.vue', icon: 'i-fe:git-branch', order: 10, show: true },
      { code: 'ClientManagement', name: '客户管理', type: 'MENU', path: '/clients', component: '/src/views/business/clients/index.vue', icon: 'i-fe:users', order: 20, show: true },
      { code: 'OrderManagement', name: '订单管理', type: 'MENU', path: '/orders', component: '/src/views/business/orders/index.vue', icon: 'i-fe:file-text', order: 30, show: true },
      { code: 'FinanceSettlement', name: '财务管理', type: 'MENU', path: '/finance', component: '/src/views/business/finance/index.vue', icon: 'i-fe:credit-card', order: 40, show: true },
      { code: 'ArchiveFiles', name: '资料中心', type: 'MENU', path: '/archive', component: '/src/views/business/archive/index.vue', icon: 'i-fe:archive', order: 60, show: true },
      { code: 'KingsoftDocs', name: '金山历史', type: 'MENU', path: '/kdocs-history', component: '/src/views/business/kdocs/index.vue', icon: 'i-fe:search', order: 65, show: true },
      { code: 'BusinessDashboard', name: '经营看板', type: 'MENU', path: '/dashboard', component: '/src/views/business/dashboard/index.vue', icon: 'i-fe:bar-chart-2', order: 70, show: true },
      { code: 'SystemManagement', name: '系统管理', type: 'MENU', icon: 'i-fe:settings', order: 9999, show: true },
    ];

    const systemPermission = permissions.find(permission => permission.code === 'SystemManagement');
    if (!systemPermission)
      throw new Error('SystemManagement permission seed missing');
    const system = await this.upsertPermission(systemPermission);
    const dictionary = await this.upsertPermission({ code: 'BusinessSettings', name: '基础设置', type: 'MENU', path: '/settings', component: '/src/views/business/settings/index.vue', icon: 'i-fe:list', order: 1, show: true, parentId: system.id });
    await this.upsertPermission({ code: 'OperationLogs', name: '操作日志', type: 'MENU', path: '/system/operation-logs', component: '/src/views/system/operation-logs/index.vue', icon: 'i-fe:file-text', order: 2, show: true, parentId: system.id });
    const parameters = await this.upsertPermission({ code: 'SystemParameters', name: '系统参数', type: 'MENU', path: '/system/parameters', component: '/src/views/system/parameters/index.vue', icon: 'i-fe:sliders', order: 3, show: true, parentId: system.id });
    const resource = await this.upsertPermission({ code: 'ResourceMgt', name: '菜单管理', type: 'MENU', path: '/pms/resource', component: '/src/views/pms/resource/index.vue', icon: 'i-fe:grid', order: 4, show: true, parentId: system.id });
    const role = await this.upsertPermission({ code: 'RoleMgt', name: '角色管理', type: 'MENU', path: '/pms/role', component: '/src/views/pms/role/index.vue', icon: 'i-fe:shield', order: 5, show: true, parentId: system.id });
    const user = await this.upsertPermission({ code: 'UserMgt', name: '用户管理', type: 'MENU', path: '/pms/user', component: '/src/views/pms/user/index.vue', icon: 'i-fe:user', order: 6, show: true, parentId: system.id });
    await this.upsertPermission({ code: 'RoleUser', name: '角色用户', type: 'MENU', path: '/pms/role/user/:roleId', component: '/src/views/pms/role/role-user.vue', icon: 'i-fe:user-plus', activeMenuCode: 'RoleMgt', order: 7, show: false });

    const businessMenus = new Map<string, Permission>();
    for (const permission of permissions.filter(item => item.code !== 'SystemManagement')) {
      const savedPermission = await this.upsertPermission(permission);
      businessMenus.set(savedPermission.code, savedPermission);
    }
    const commission = await this.upsertPermission({
      code: 'CommissionRules',
      name: '提成结算',
      type: 'MENU',
      path: '/commission',
      component: '/src/views/business/commission/index.vue',
      icon: 'i-fe:percent',
      activeMenuCode: 'FinanceSettlement',
      order: 50,
      show: false,
      parentId: null,
    });
    businessMenus.set(commission.code, commission);

    const dashboard = businessMenus.get('BusinessDashboard');
    const dashboardChildren: SeedPermission[] = dashboard
      ? [
          { code: 'DashboardOverview', name: '经营总览', type: 'MENU', path: '/dashboard/overview', component: '/src/views/business/dashboard/index.vue', icon: 'i-fe:bar-chart-2', order: 1, show: true, parentId: dashboard.id },
          { code: 'DashboardReceivables', name: '回款分析', type: 'MENU', path: '/dashboard/receivables', component: '/src/views/business/dashboard/index.vue', icon: 'i-fe:credit-card', order: 2, show: true, parentId: dashboard.id },
          { code: 'DashboardFulfillment', name: '履约待办', type: 'MENU', path: '/dashboard/fulfillment', component: '/src/views/business/dashboard/index.vue', icon: 'i-fe:check-square', order: 3, show: true, parentId: dashboard.id },
          { code: 'DashboardRanking', name: '排行分析', type: 'MENU', path: '/dashboard/ranking', component: '/src/views/business/dashboard/index.vue', icon: 'i-fe:list', order: 4, show: true, parentId: dashboard.id },
        ]
      : [];
    for (const child of dashboardChildren) {
      const savedChild = await this.upsertPermission(child);
      businessMenus.set(savedChild.code, savedChild);
      await this.ensureRolesInheritPermission('BusinessDashboard', savedChild.code);
    }

    await this.ensureButtonPermissions(resource, [
      { code: 'AddMenu', name: '新增菜单', order: 1 },
      { code: 'EditMenu', name: '编辑菜单', order: 2 },
      { code: 'DeleteMenu', name: '删除菜单', order: 3 },
      { code: 'AddButton', name: '新增按钮', order: 4 },
      { code: 'EditButton', name: '编辑按钮', order: 5 },
      { code: 'DeleteButton', name: '删除按钮', order: 6 },
      { code: 'ToggleButton', name: '启停按钮', order: 7 },
    ]);
    await this.ensureButtonPermissions(role, [
      { code: 'AddRole', name: '新增角色', order: 1 },
      { code: 'EditRole', name: '编辑角色', order: 2 },
      { code: 'DeleteRole', name: '删除角色', order: 3 },
      { code: 'ToggleRole', name: '启停角色', order: 4 },
      { code: 'AssignRoleUsers', name: '分配用户', order: 5 },
      { code: 'AddRoleUser', name: '授权用户', order: 6 },
      { code: 'RemoveRoleUser', name: '取消授权', order: 7 },
    ]);
    await this.ensureButtonPermissions(user, [
      { code: 'AddUser', name: '新增用户', order: 1 },
      { code: 'AssignUserRoles', name: '分配角色', order: 2 },
      { code: 'ResetUserPassword', name: '重置密码', order: 3 },
      { code: 'DeleteUser', name: '删除用户', order: 4 },
      { code: 'ToggleUser', name: '启停用户', order: 5 },
    ]);
    await this.ensureButtonPermissions(dictionary, [
      { code: 'MaintainDictionary', name: '维护字典项', order: 1 },
      { code: 'AddDictionaryItem', name: '新增字典项', order: 3 },
      { code: 'EditDictionaryItem', name: '编辑字典项', order: 4 },
      { code: 'DeleteDictionaryItem', name: '删除字典项', order: 5 },
      { code: 'ToggleDictionaryItem', name: '启停字典项', order: 6 },
      { code: 'ExportDictionary', name: '导出字典', order: 7 },
      { code: 'AddServiceCatalog', name: '新增服务目录', order: 8 },
      { code: 'EditServiceCatalog', name: '编辑服务目录', order: 9 },
      { code: 'DeleteServiceCatalog', name: '删除服务目录', order: 10 },
      { code: 'ToggleServiceCatalog', name: '启停服务目录', order: 11 },
    ]);
    await this.ensureButtonPermissions(parameters, [
      { code: 'AddSystemParameter', name: '新增系统参数', order: 1 },
      { code: 'EditSystemParameter', name: '编辑系统参数', order: 2 },
      { code: 'DeleteSystemParameter', name: '删除系统参数', order: 3 },
    ]);
    await this.ensureButtonPermissions(businessMenus.get('ClientManagement'), [
      { code: 'ImportClient', name: '导入客户', order: 1 },
      { code: 'AddClient', name: '新增客户', order: 2 },
      { code: 'EditClient', name: '编辑客户', order: 3 },
      { code: 'DeleteClient', name: '删除客户', order: 4 },
      { code: 'ConfirmClientImport', name: '确认客户导入', order: 5 },
      { code: 'DeleteClientImport', name: '删除导入暂存', order: 6 },
      { code: 'ViewClientImport', name: '查看客户导入记录', order: 7 },
      { code: 'ViewClientCredential', name: '查看客户账号资料', order: 8 },
      { code: 'EditClientCredential', name: '维护客户账号资料', order: 9 },
      { code: 'MaintainClientLevel', name: '维护客户等级状态', order: 10 },
    ]);
    await this.ensureButtonPermissions(businessMenus.get('OrderManagement'), [
      { code: 'AddOrder', name: '创建订单', order: 1 },
      { code: 'EditOrder', name: '编辑订单', order: 2 },
      { code: 'DeleteOrder', name: '删除订单', order: 3 },
    ]);
    await this.ensureButtonPermissions(businessMenus.get('FinanceSettlement'), [
      { code: 'ViewFinance', name: '查看财务底账', order: 1 },
      { code: 'MaintainFinanceContract', name: '维护合同', order: 2 },
      { code: 'MaintainFinanceInvoice', name: '维护发票', order: 3 },
      { code: 'MaintainFinancePayment', name: '维护收款', order: 4 },
      { code: 'MatchFinancePayment', name: '匹配收款发票', order: 5 },
      { code: 'ImportFinancePayment', name: '导入银行流水', order: 6 },
    ]);
    for (const code of Object.keys(FINANCE_BUTTON_ORDERS).filter(code => code !== 'ViewFinance'))
      await this.ensureRolesInheritPermission(code, 'ViewFinance');
    await this.ensureRolesInheritPermission('ViewFinance', 'FinanceSettlement');
    await this.ensureButtonPermissions(businessMenus.get('ArchiveFiles'), [
      { code: 'UploadArchiveFile', name: '上传业务归档', order: 1 },
      { code: 'DeleteArchiveFile', name: '删除资料文件', order: 2 },
      { code: 'ManageArchiveMaterial', name: '管理公司资料', order: 3 },
    ]);
    await this.ensureButtonPermissions(businessMenus.get('CommissionRules'), [
      { code: 'AddCommissionRule', name: '新增提成规则', order: 1 },
      { code: 'EditCommissionRule', name: '编辑提成规则', order: 2 },
      { code: 'DeleteCommissionRule', name: '删除提成规则', order: 3 },
      { code: 'GenerateCommissionSettlement', name: '生成提成结算', order: 4 },
      { code: 'ConfirmCommissionSettlement', name: '确认提成结算', order: 5 },
      { code: 'PayCommissionSettlement', name: '标记提成发放', order: 6 },
      { code: 'CancelCommissionSettlement', name: '取消提成结算', order: 7 },
    ]);
    await this.ensureButtonPermissions(businessMenus.get('TeamManagement'), [
      { code: 'EditTeamProfile', name: '编辑员工档案', order: 1 },
      { code: 'AddDepartment', name: '新增部门', order: 2 },
      { code: 'EditDepartment', name: '编辑部门', order: 3 },
      { code: 'DeleteDepartment', name: '删除部门', order: 4 },
    ]);
  }

  private async upsertPermission(input: SeedPermission) {
    const existed = await this.permissionRepository.findOne({ where: { code: input.code } });
    if (existed) {
      let changed = false;

      // 只处理明确的历史迁移，避免系统启动时覆盖用户在菜单管理中手动调整过的排序和显示状态。
      if (input.code === 'BusinessSettings' && ['系统设置', '数据字典'].includes(existed.name)) {
        existed.name = input.name;
        changed = true;
      }
      if (input.code === 'ArchiveFiles' && existed.name === '档案') {
        existed.name = input.name;
        changed = true;
      }
      if (input.code === 'TeamManagement' && existed.name === '团队管理') {
        existed.name = input.name;
        existed.icon = input.icon ?? existed.icon;
        changed = true;
      }
      if (input.code === 'BusinessDashboard' && existed.name === '看板') {
        existed.name = input.name;
        changed = true;
      }
      if (input.code === 'CommissionRules') {
        existed.name = input.name;
        existed.parentId = input.parentId ?? null;
        existed.show = input.show;
        existed.order = input.order;
        existed.icon = input.icon ?? existed.icon;
        existed.activeMenuCode = input.activeMenuCode ?? null;
        changed = true;
      }
      if (input.code === 'RoleUser') {
        existed.parentId = input.parentId ?? null;
        existed.show = input.show;
        existed.order = input.order;
        existed.activeMenuCode = input.activeMenuCode ?? null;
        changed = true;
      }
      if (['AddRoleUser', 'RemoveRoleUser'].includes(input.code)) {
        existed.name = input.name;
        existed.parentId = input.parentId ?? null;
        existed.order = input.order;
        changed = true;
      }
      if (input.type === 'BUTTON' && FINANCE_BUTTON_ORDERS[input.code]) {
        existed.name = input.name;
        existed.parentId = input.parentId ?? null;
        existed.order = input.order;
        changed = true;
      }
      if (changed)
        return this.permissionRepository.save(existed);
      return existed;
    }

    return this.permissionRepository.save(this.permissionRepository.create({
      code: input.code,
      name: input.name,
      type: input.type,
      parentId: input.parentId ?? null,
      path: input.path ?? null,
      component: input.component ?? null,
      icon: input.icon ?? null,
      layout: input.layout ?? null,
      activeMenuCode: input.activeMenuCode ?? null,
      show: input.show,
      enable: true,
      keepAlive: input.keepAlive ?? false,
      order: input.order,
    }));
  }

  private async ensureButtonPermissions(parent: Permission | undefined, buttons: SeedButtonPermission[]) {
    if (!parent)
      return;
    for (const button of buttons) {
      await this.upsertPermission({
        ...button,
        type: 'BUTTON',
        show: true,
        parentId: parent.id,
      });
    }
  }

  private async ensureRolesInheritPermission(sourceCode: string, targetCode: string) {
    const [source, target] = await Promise.all([
      this.permissionRepository.findOne({ where: { code: sourceCode } }),
      this.permissionRepository.findOne({ where: { code: targetCode } }),
    ]);
    if (!source || !target)
      return;

    const roles = await this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permissions')
      .innerJoin('role.permissions', 'sourcePermission', 'sourcePermission.code = :sourceCode', { sourceCode })
      .getMany();

    for (const role of roles) {
      if (role.permissions?.some(permission => permission.id === target.id))
        continue;
      role.permissions = [...(role.permissions || []), target];
      await this.roleRepository.save(role);
    }
  }

  private async ensureSystemParameters() {
    for (const registeredParameter of REGISTERED_SYSTEM_PARAMETERS) {
      const existed = await this.parameterRepository.findOne({ where: { paramKey: registeredParameter.paramKey } });
      if (existed) {
        let changed = false;
        if (!existed.builtIn) {
          existed.builtIn = true;
          changed = true;
        }
        if (!existed.enabled) {
          existed.enabled = true;
          changed = true;
        }
        if (existed.paramName !== registeredParameter.paramName) {
          existed.paramName = registeredParameter.paramName;
          changed = true;
        }
        if (existed.valueType !== registeredParameter.valueType) {
          existed.valueType = registeredParameter.valueType;
          changed = true;
        }
        if (existed.groupName !== registeredParameter.groupName) {
          existed.groupName = registeredParameter.groupName;
          changed = true;
        }
        if (changed)
          await this.parameterRepository.save(existed);
        continue;
      }

      await this.parameterRepository.save(this.parameterRepository.create({
        paramKey: registeredParameter.paramKey,
        paramName: registeredParameter.paramName,
        valueType: registeredParameter.valueType,
        paramValue: registeredParameter.defaultValue(),
        groupName: registeredParameter.groupName,
        enabled: true,
        builtIn: true,
        sort: registeredParameter.sort,
        remark: registeredParameter.remark,
      }));
    }
  }

  private async ensureDefaultAnnouncements() {
    const existedCount = await this.announcementRepository.count();
    if (existedCount > 0)
      return;

    const publishAt = new Date();
    publishAt.setHours(0, 0, 0, 0);

    await this.announcementRepository.save([
      this.announcementRepository.create({
        title: '服务项状态变更请同步检查回款与资料归档',
        content: '订单服务项进入完成、逾期或异常状态后，请同步核对回款、发票和资料归档情况。',
        type: '公告',
        enabled: true,
        pinned: true,
        sort: 1,
        publishAt,
        expireAt: null,
        creatorName: '系统初始化',
      }),
      this.announcementRepository.create({
        title: '银行流水导入后请及时完成收款匹配',
        content: '财务导入银行流水后，请在收款匹配中完成客户、合同和发票核对。',
        type: '提醒',
        enabled: true,
        pinned: false,
        sort: 2,
        publishAt,
        expireAt: null,
        creatorName: '系统初始化',
      }),
      this.announcementRepository.create({
        title: '客户资料和交付成果请关联到对应客户或订单',
        content: '资料中心上传文件时，请优先选择客户、订单或服务项，方便后续追溯。',
        type: '通知',
        enabled: true,
        pinned: false,
        sort: 3,
        publishAt,
        expireAt: null,
        creatorName: '系统初始化',
      }),
    ]);
  }

  private async normalizeDictionaryItems() {
    await this.dataSource.transaction(async (manager) => {
      const dictionaryRepository = manager.getRepository(DictionaryItem);
      const items = await dictionaryRepository.find({ order: { dictionaryType: 'ASC', id: 'ASC' } });
      const normalizedItems = items.map((item) => {
        const normalizedCode = createDictionaryItemCode(item.name);
        if (!normalizedCode)
          throw new Error(`字典项“${item.name}”无法生成编码，请先修正名称`);
        return {
          item,
          oldCode: item.code,
          oldName: item.name,
          normalizedCode,
        };
      });

      const codeOwners = new Map<string, DictionaryItem>();
      for (const normalized of normalizedItems) {
        const key = `${normalized.item.dictionaryType}:${normalized.normalizedCode}`;
        const owner = codeOwners.get(key);
        if (owner)
          throw new Error(`字典项编码冲突：${normalized.item.dictionaryType}/${normalized.item.name} 与 ${owner.name} 都会生成 ${normalized.normalizedCode}`);
        codeOwners.set(key, normalized.item);
      }

      for (const { item } of normalizedItems.filter(row => row.oldCode !== row.normalizedCode)) {
        item.code = `__DICT_MIGRATING_${item.id}__`;
        await dictionaryRepository.save(item);
      }

      for (const normalized of normalizedItems) {
        const { item, oldCode, oldName, normalizedCode } = normalized;
        item.code = normalizedCode;

        const shouldSyncReferences = oldCode !== normalizedCode;
        if (!shouldSyncReferences)
          continue;

        const saved = await dictionaryRepository.save(item);
        if (shouldSyncReferences) {
          await syncDictionaryItemReferences(manager, {
            dictionaryType: saved.dictionaryType,
            oldCode,
            newCode: saved.code,
            oldName,
            newName: saved.name,
          });
        }
      }
    });
  }

  private async ensureJoinTableComments() {
    // TypeORM自动生成的多对多联表没有实体字段承载注释，这里只补充schema说明，不写业务数据。
    await this.dataSource.query(`
      ALTER TABLE sys_user_roles
      COMMENT = '用户角色关联表',
      MODIFY user_id int NOT NULL COMMENT '用户ID',
      MODIFY role_id int NOT NULL COMMENT '角色ID'
    `);
    await this.dataSource.query(`
      ALTER TABLE sys_role_permissions
      COMMENT = '角色资源权限关联表',
      MODIFY role_id int NOT NULL COMMENT '角色ID',
      MODIFY permission_id int NOT NULL COMMENT '资源权限ID'
    `);
  }
}
