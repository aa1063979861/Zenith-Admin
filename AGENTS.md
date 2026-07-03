# Zenith-Admin 项目入口说明

本文档是 AI 进入本项目后的第一阅读文件。每次开始开发、修复、重构或补充文档前，必须先阅读本文件，再按需阅读关联 PRD 和代码。若业务规则、目录结构、启动方式、数据模型或重要决策发生变化，必须同步更新本文件。

## 1. 项目定位

本项目用于开发达州众恒信息科技有限公司内部管理系统，英文名 `ZenithAdmin`，中文名 `众恒科技管理系统`。目标是替代当前金山文档统计方式，形成可长期使用的客户、订单、服务履约、合同、发票、收款、附件、提成和经营看板系统。

核心业务对象不是单一订单表，而是：

```text
客户 -> 订单 -> 服务项 -> 合同/发票/收款/提成/附件
```

服务项是最小履约和核算单元。合同、发票、收款、利润、提成必须能追溯到服务项。

## 2. 当前代码基线

当前仓库来自 `aa1063979861/Zenith-Admin` 的 `2.x` 分支，前端基于 `zclzone/vue-naive-admin` 2.x。

已确认技术栈：

- Vite
- Vue 3
- JavaScript
- Pinia
- Vue Router
- Naive UI
- Unocss
- ECharts
- xlsx（后端解析 `.xls` / `.xlsx` 导入文件）
- pdfjs-dist（前端解析文本型电子发票 PDF，用于附件识别回填；不做 OCR）

当前仓库已经采用前后端同仓工作区：

- 前端：仓库根目录，基于 Vite + Vue 3 + Pinia + Naive UI。
- 后端：`apps/server`，基于 NestJS + TypeORM + MySQL。

正式业务能力必须由后端 API 和数据库约束支撑，前端不得把金额校验、收款匹配、提成计算等核心业务规则只写在浏览器端。

## 3. 重要文件和目录

### 3.1 项目入口

- `AGENTS.md`：本文件，项目级 AI 入口说明。
- `package.json`：前端依赖和脚本。
- `vite.config.js`：Vite 配置。
- `uno.config.js`：Unocss 配置。
- `src/main.js`：Vue 应用入口。
- `src/App.vue`：应用根组件。
- `src/settings.js`：主题、布局、基础权限菜单配置。

### 3.2 路由和权限

- `src/router/index.js`：路由实例和守卫安装。
- `src/router/basic-routes.js`：基础静态路由。
- `src/router/guards/`：登录、权限、标题、标签页等路由守卫。
- `src/store/modules/user.js`：当前用户状态。
- `src/store/modules/permission.js`：权限状态。
- `src/store/modules/router.js`：动态路由状态。
- `src/views/pms/`：模板自带用户、角色等权限管理页面。
- `src/views/business/`：众恒业务页面，组织、客户、订单、基础设置、财务、资料中心和看板均接真实 API；提成结算通过财务管理页面入口进入，但权限节点为隐藏顶级路由，`activeMenuCode` 只负责侧边栏高亮，财务底账读取必须通过 `ViewFinance` 控制。
- `src/views/system/parameters/`：系统参数页面，维护员工初始密码等全局参数。
- `src/views/system/operation-logs/`：操作日志页面，查看删除、修改、授权等审计记录。
- `src/views/business/shared/api.js`：业务 API 封装。
- `src/views/business/shared/useBusinessStore.js`：真实业务 Pinia store。
- 早期业务样例数据和业务原型 store 已移除；正式业务页面不得再新增前端样例数据作为兜底数据源。

### 3.6 后端

- `apps/server/package.json`：后端依赖和脚本。
- `apps/server/src/main.ts`：Nest 应用入口，注册全局校验、异常过滤和统一响应。
- `apps/server/src/app.module.ts`：后端根模块，配置 TypeORM MySQL。
- `apps/server/src/database/database-seed.service.ts`：开发种子，只允许确保超级管理员、系统菜单元数据和系统参数元数据存在。
- `apps/server/src/entities/`：TypeORM 实体。
- `apps/server/src/modules/auth/`：登录、JWT、密码修改。
- `apps/server/src/modules/users/`：用户/员工接口。普通用户即员工，超级管理员是唯一例外。
- `apps/server/src/modules/roles/`：角色接口。
- `apps/server/src/modules/permissions/`：菜单管理接口，底层仍使用 `Permission` 实体承载菜单和按钮权限。
- `apps/server/src/modules/dictionaries/`：数据字典/数据集接口，区划、职位等在这里维护。
- `apps/server/src/modules/service-catalog/`：服务目录接口，维护服务编码、类别、默认价格和启停状态；服务期与到期提醒由类别自动派生。
- `apps/server/src/modules/organization/`：组织管理接口，部门架构、组织概览和部门维护在这里处理。
- `apps/server/src/modules/system-parameters/`：系统参数接口，员工初始密码等参数在这里维护。
- `apps/server/src/modules/clients/`：客户、账号资料、单位基础客户库导入接口。
- `apps/server/src/modules/orders/`：订单和服务项接口。
- `apps/server/src/modules/archive/`：资料中心接口，包含业务归档、公司资料、周报汇总和受控预览下载。

### 3.3 布局和通用组件

- `src/layouts/`：normal、simple、full、empty 布局。
- `src/layouts/components/`：侧边栏、面包屑、标签页、用户头像等布局组件。
- `src/components/common/`：通用页面、卡片、主题、页脚等组件。
- `src/components/me/`：模板封装的 CRUD、Modal 等业务组件。
- `src/composables/`：表单、弹窗、CRUD 等组合函数。

### 3.4 API 和请求

- `src/api/index.js`：模板基础 API。
- `src/utils/http/`：请求封装、拦截器、辅助函数。

### 3.5 产品文档

当前产品文档位于仓库外层：

- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/README.md`
- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/00-方案总览.md`
- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/01-PRD.md`
- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/02-数据模型.md`
- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/03-财务开票收款方案.md`
- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/04-导入归档移动端.md`
- `C:/Users/Administrator/Desktop/demo/demo1/docs/management-system/05-实施路线图.md`

开发业务功能前必须先核对这些文档。若实现方案和文档冲突，先更新文档或说明冲突，不得悄悄偏离。

## 4. 不可变业务规则

### 4.1 客户规则

- 一个订单只对应一个客户。
- 客户决定订单，不是订单决定客户。
- 客户至少由区划、6 位单位编码、单位名称识别。
- 新录入正式客户时，单位编码必须是 6 位数字。
- 旧数据缺单位编码时，必须进入导入暂存和人工确认流程，不得直接生成正式客户。

### 4.2 订单和服务项

- 一个客户可以有多个订单。
- 一个订单可以有多个服务项。
- 接单人和填报人可以不是同一个员工。
- 当前业务不存在多人共同完成同一个服务项，不设计多人提成拆分。
- 服务项是利润、提成、履约、开票分摊和收款分摊的最小颗粒。
- “决算财报内控”“资产财报内控”等合并项目必须拆成多个服务项。
- 打包价必须人工手动分摊，系统只校验分摊合计，不自动猜测金额归属。
- 订单和服务项中的区划、单位编码、单位名称是创建订单时的业务快照；客户后续改名、改编码或合并时，不回写历史订单和服务项。
- 订单删除采用软删除：订单和其服务项从业务列表移除，必须填写删除原因并写入操作日志；已有收款的服务项所在订单不得删除。
- 客户创建后，区划、单位编码、单位名称不得在普通编辑中修改；只能在客户详情页通过“变更单位信息”入口修改，必须填写原因并写入客户身份变更历史。

### 4.3 一体化增值服务

- 一体化增值服务最低服务期是一年。
- 必须支持服务开始日期、到期日期、到期提醒和续费跟进。
- 服务目录类别仅支持“一次性”和“周期性”：一次性不需要服务期限和到期提醒；周期性默认一年服务期限并自动启用到期提醒，前端不得让用户手工选择服务期限或提醒开关。
- 周期性服务期按包含结束日的自然周期计算，例如 `2026-01-01` 至 `2026-12-31` 视为满 12 个月；续签新服务项从原到期日次日开始，到期日按同一口径生成。

### 4.4 合同、发票、收款

- 合同可选，没有合同但有发票是正常业务。
- 有合同时，合同金额和发票金额必须一致。
- 发票可以关联多个订单或多个服务项。
- 一个订单的多个服务项可以开多张发票。
- 可以存在多开金额，例如实际服务 1000，单位要求多开 500，则合同和发票均为 1500。
- 收款必须匹配发票，未匹配发票的收款不能计入服务项已收金额，也不能进入提成结算。
- 支持部分收款和跨年收款。
- 银行流水可导入 Excel，系统可给匹配建议，但最终必须人工确认。

### 4.5 提成

- 提成规则必须可配置。
- 提成应落到服务项。
- 推荐以服务项已确认收款分摊金额作为提成基数。
- 提成结算单确认后才成为正式结果。

### 4.6 账号密码和日志

- 资产系统、内控系统账号密码不脱敏展示。
- 查看、复制、修改账号密码必须记录日志。
- 小程序或移动端查看账号密码同样必须记录日志。

### 4.7 超级管理员硬约束

- 超级管理员是单独的内置系统用户。
- 超级管理员拥有绝对权限。
- 超级管理员不可删除、不可禁用、不可被普通业务流程修改为员工。
- 超级管理员不是任何一个员工、老板或管理层。
- 员工通常对应业务系统用户，但超级管理员是唯一明确例外。
- 员工离职、禁用或角色调整不得影响超级管理员。
- 任何员工绩效、接单、填报、提成、业务统计都不得把超级管理员计入员工口径。
- 除超级管理员、系统菜单元数据和系统参数元数据外，系统不得自动预置任何数据。
- 不得自动预置角色、区划、服务项、客户、订单、员工、发票、收款、附件、提成规则。
- 菜单管理所需菜单/按钮属于系统运行元数据，可以内置初始化，确保角色管理后续可分配权限。
- 系统参数属于系统运行元数据，可以内置初始化；当前内置参数包含 `employee.initial_password`、`security.access_token_ttl_minutes`、`security.refresh_token_ttl_minutes`、`security.password_min_length`、`kdocs.history_links`、`client.credential_system_options`、`order.order_no_prefix`、`order.service_due_warning_days`、`order.performer_defaults_to_receiver`、`order.service_year_previous_year_default`、`upload.avatar_max_mb`、`upload.import_excel_max_mb`、`upload.archive_file_max_mb` 和 `ui.layout_setting_visible`，用于员工初始密码、登录安全、金山历史文档入口、客户账号系统候选项、订单编号、订单默认行为、到期提醒、上传限制和界面布局开关。
- 所有基础资料和业务数据必须由用户在系统中自行添加或后续通过导入确认流程写入。

### 4.8 用户、员工和组织管理

- 普通系统用户就是员工账号。
- 员工账号只能在系统管理的用户管理中新增。
- 用户管理负责创建员工账号、展示登录账号、角色授权、密码重置和启停状态。
- 用户管理新增员工账号时不填写初始密码，后端从系统参数 `employee.initial_password` 读取默认初始密码。
- 用户管理界面统一把后端字段 `username` 称为“登录账号”，登录账号只用于登录和唯一账号标识；员工姓名用于业务展示、人员口径、接单/填报/导入人等显示。
- 用户管理新增员工账号时只填写开户必需信息：员工姓名、账号状态、部门、职位和可选角色；不填写登录账号和初始密码。登录账号由后端按员工姓名转小写全拼自动生成，例如“罗志强”生成 `luozhiqiang`；如账号已存在则自动追加数字后缀，例如 `luozhiqiang2`。初始密码由后端从系统参数 `employee.initial_password` 读取。
- 用户管理新增员工账号时必须填写员工姓名、部门和职位；部门来自组织管理的 `org_departments`，职位来自 `position` 字典。手机号、邮箱、性别、头像、地址、入职日期、生日、紧急联系人等详细人事档案只在组织管理维护。
- 组织管理只展示普通员工，不展示超级管理员。
- 组织管理只允许维护部门架构、员工个人信息和业务档案，例如姓名、部门、职位、工号、性别、手机号、邮箱、地址、头像、入职日期、离职日期、生日、紧急联系人、紧急联系电话和档案备注；不得新增员工账号。
- 职位来自数据字典 `position` 类型，下拉选择，不在组织表单中手写自由文本。
- 部门来自组织部门表 `org_departments`，支持上级部门、负责人、排序、启停和架构图展示，不再作为数据字典页面中的可维护项。
- 组织管理列表支持关键字、部门、职位和在职/离职筛选；组织统计只统计 `EMPLOYEE` 用户，不包含超级管理员。
- 组织管理中的人事状态是 `在职/离职`；用户管理中的账号状态是 `启用/停用`，二者不能混用。员工办理离职时后端自动禁用其登录账号，但账号状态仍只在用户管理体现。

### 4.9 顶部用户入口和头像

- 顶部用户下拉必须提供个人资料入口。
- 普通用户拥有多个角色时才显示切换角色入口。
- 超级管理员没有普通角色，不为了切换角色而伪造角色。
- 角色切换由后端 `/auth/current-role/switch/:roleCode` 重新签发 JWT，当前角色编码写入 token；权限树只返回当前角色的菜单和按钮。不得只做前端假切换。
- 用户未配置头像图片时，头像按姓名首字显示：例如“罗志强”显示“罗”，“超级管理员”显示“超”。

### 4.10 角色管理和资源授权

- 角色管理是系统管理的真实权限模块，必须接后端 `roles`、`permissions`、`users` API，不得回退到前端样例数据。
- 系统不得自动预置普通角色；角色必须由用户在角色管理中自行新增。超级管理员不依赖普通角色获得权限。
- 当前开发库在用户明确确认后已手动创建 3 个普通角色：`Management`（管理层）、`BackOffice`（后勤行政）、`Staff`（普通员工）。这属于用户确认后的开发库数据，不得写入 `DatabaseSeedService` 或任何启动自动 seed。
- 角色权限口径：管理层偏经营查看和业务数据查看；后勤行政负责客户、订单、财务、档案、组织资料、基础设置、系统参数和用户管理等日常后台维护；普通员工负责客户、订单和组织查看，以及创建订单、维护自己经办的基础业务数据。后续以角色管理页面为准，可人工调整。
- 角色字段当前只包含角色名称、角色编码、启停状态、是否内置、菜单权限和员工授权关系；不得为了页面展示随意新增“排序、备注”等数据库字段，除非后续明确确认结构变更。
- 角色编码用于角色切换和权限标识，不由用户手动录入；后端按角色名称复用数据字典编码规则自动生成，即拼音首字母大写加 `_Code`，例如“管理层”生成 `GLC_Code`。角色名称变更时编码同步重算，并同步当前登录会话中的角色编码。
- 角色权限保存必须由后端校验菜单 ID 是否有效，并在选中子菜单或按钮时自动补齐真实父级菜单链路，避免普通用户获得孤立按钮却无法进入页面；隐藏路由的 `activeMenuCode` 仅在返回前端权限树时临时补齐导航入口及其可见父链，不写回角色真实授权。
- 角色列表必须展示权限数量和员工数量；删除角色前后端都必须阻止删除仍绑定员工的角色，用户需要先取消授权。
- 系统内置角色如后续存在，禁止停用、删除和普通授权变更。
- 角色授权页只展示普通员工账号，不展示超级管理员；超级管理员不能参与角色授权或取消授权。
- 停用角色不能授权给员工；停用账号不能新增角色授权，但允许取消已有授权。
- 角色管理和角色授权页的按钮权限必须写入菜单管理，包括 `AddRole`、`EditRole`、`DeleteRole`、`ToggleRole`、`AssignRoleUsers`、`AddRoleUser`、`RemoveRoleUser`，其中 `AddRoleUser`、`RemoveRoleUser` 直接归属 `RoleMgt`；角色授权隐藏路由 `RoleUser` 仅通过 `activeMenuCode=RoleMgt` 控制侧边栏高亮，不承载按钮父级，普通角色按按钮资源控制可见操作。

### 4.11 单位基础客户库导入

- `C:/Users/Administrator/Desktop/excel-2026-06-25.xls` 是财政系统导出的单位基础客户库模板，不是订单导入模板。
- 单位库导入只创建客户主数据，不创建订单、服务项、合同、发票、收款、提成或附件。
- 单位库导入只保留核心客户字段：区划、单位编码、单位名称、单位地址、统一社会信用代码、法人、财务人员、负责人、联系电话、备注。
- 单位简称、单位全称、财政地区编码、单位类别、单位类型、经费供给方式、会计制度、启停年度等原始模板字段不写入正式客户表。
- 单位库导入流程必须是“上传解析 -> 导入批次/明细暂存 -> 人工确认 -> 正式写入客户”。
- 区划由数据字典 `region` 维护。单位库导入遇到不存在或未启用的单位所在地区时，应自动创建或启用对应 `region` 字典项，再继续校验；不能因为缺区划让整批长期停在错误状态。
- 导入确认前必须按当前客户库和当前数据字典重新校验，避免预览后基础资料变化导致脏数据入库。
- 可入库行状态为 `valid` 或 `warning`；`error` 行禁止确认入库；已入库行标记为 `imported`，已存在客户标记为 `skipped`。
- 导入批次和导入明细是暂存审计数据，不属于业务客户数据；未确认且未产生入库/跳过记录的批次允许用户删除，已确认或已有入库/跳过记录的批次不得删除。
- 单位库导入预览字段较多，前端必须使用宽工作区抽屉和表格横向滚动；明细表应限制自身高度，让横向滚动条在当前预览区域内可见，不能裁掉右侧字段。
- 单位库导入文件选择必须兼容 Chrome 和 Edge；前端使用可见的原生 `input[type=file]`，不得依赖上传组件内部隐藏 input、透明覆盖 input 或脚本间接点击。
- 客户列表不维护“是否客户”字段，是否存在业务通过订单数量体现；订单数量按正式订单实时计算，客户列表进入独立详情页后展示该客户订单和服务项，并提供带客户参数的新建订单入口。
- 当前单位库导入 API：
  - `POST /clients/imports/unit-directory`：上传并解析单位库 Excel。
  - `GET /clients/imports`：查询单位库导入批次。
  - `GET /clients/imports/:batchId`：查看导入批次明细。
  - `POST /clients/imports/:batchId/revalidate`：按当前数据字典重新校验批次。
  - `POST /clients/imports/:batchId/confirm`：确认选中明细入库。

### 4.12 列表分页和人员显示

- 所有列表默认每页 `50` 条。
- 所有列表分页必须支持页码切换、快速跳页、每页条数下拉和总记录数展示。
- 每页条数下拉统一使用 `50/100/200/500/1000/2000/5000/全部`，其中“全部”在前后端统一按 `100000` 上限处理。
- 分页配置统一从 `src/utils/pagination.js` 读取；新增表格不得再手写 `10` 或 `20` 条分页。
- 分页页大小下拉必须完整显示“全部”选项，不得被表格、抽屉或页面容器裁切；统一使用 `pageSizeSelectProps` 挂载到 `body`、`top-start` 向上展开，并限制菜单高度。
- 导入人、经办人、接单人、填报人等人员展示优先使用员工姓名或显示名称，不直接展示登录账号；只有姓名和显示名称都不存在时才回退到登录账号。

## 5. 推荐模块导航

后台菜单保持扁平，避免过多子菜单：

- 工作台
- 客户
- 订单
- 财务（含合同、发票、收款、提成结算）
- 资料中心
- 看板
- 设置

低频页面优先内嵌到模块内部，用标签页、抽屉或弹窗承载，不轻易新增顶级菜单。

## 6. 第一阶段开发优先级

推荐按以下顺序推进：

1. 项目基础清理：品牌、首页、基础菜单、环境说明。
2. 客户台账：客户列表、客户详情、联系人、账号资料入口。
3. 服务目录和员工基础数据。
4. 订单和服务项：创建订单、拆分服务项、打包价分摊。
5. 旧表导入暂存：先预览和校验，再确认入库。
6. 财务：合同、发票、收款、收款分摊和附件。
7. 提成结算和老板看板。
8. 移动 H5 或小程序。

不要跳过服务项直接做财务模块，否则后续提成和利润会失去准确归属。

## 7. 开发工作流

每次开发前：

1. 阅读本 `AGENTS.md`。
2. 阅读相关 PRD 或数据模型文档。
3. 用 `rg` 搜索现有代码和调用点。
4. 先确认事实，再设计改动。
5. 明确本次只做的范围，避免顺手重构无关模块。

开发中：

- 优先沿用现有 Vue、Naive UI、Unocss、Pinia、请求封装和路由模式。
- 不引入新框架或大型依赖，除非已有需求不能用现有技术解决。
- 不把后端应负责的业务约束只写在前端。
- 不写任何自动填充业务初始数据的 seed。`DatabaseSeedService` 只能维护超级管理员、系统菜单元数据和系统参数元数据。
- 新增或修改 TypeORM 实体时，表和字段必须写中文 `comment`，便于后期通过数据库直接理解结构。
- 金额字段用明确命名，不用 `amount1`、`value`、`data` 等模糊字段。
- 不写投机性 fallback 逻辑来掩盖未确认的数据结构。
- 表格、表单、抽屉、详情页保持业务密度，不做营销页式 UI。
- 不在页面顶部或表单中放置解释系统规则、描述页面用途、说明后续开发状态的静态提示；保留必要的错误校验、保存结果、导入校验和会影响当前操作的阻断提示。
- 新增中文注释时，和现有文件注释语言保持一致。

开发后：

- 至少运行 `pnpm build` 或对应可用检查。
- 涉及 UI 时启动本地服务并做浏览器验证。
- 涉及导入、金额、匹配、权限时必须用真实或接近真实的数据验证。
- 更新本文件和相关 PRD/数据模型文档中的新增规则、路径或决策。

## 8. 危险操作规则

未得到用户明确要求，不执行以下操作：

- `git commit`
- `git push`
- `git reset --hard`
- 删除文件或目录
- 批量移动系统文件
- 重置数据库
- 修改生产环境配置
- 全局安装或卸载依赖

如果确实需要高风险操作，必须先说明操作类型、影响范围和风险，等用户明确确认后再执行。

## 9. 本地命令

在 `C:/Users/Administrator/Desktop/demo/demo1/Zenith-Admin` 下执行：

```powershell
pnpm install
pnpm dev
pnpm build
pnpm lint:fix
```

后端命令：

```powershell
pnpm --filter @zenith-admin/server check:schema-comments
pnpm --filter @zenith-admin/server check:schema-comments:db
pnpm --filter @zenith-admin/server build
pnpm --filter @zenith-admin/server start:dev
```

后端 `build` 会自动执行 `check:schema-comments`，校验 TypeORM 表注释、字段注释和原始 SQL schema 注释必须存在、包含中文且不得出现典型乱码；涉及数据库实际状态时运行 `check:schema-comments:db`，直接校验 `information_schema` 中所有表和字段注释。

本地开发默认前端端口 `3200`，后端端口 `8085`。前端 `.env.development` 使用 `VITE_AXIOS_BASE_URL = '/api'`，由 Vite proxy 转发到 `http://localhost:8085`。

后端环境变量参考 `apps/server/.env.example`。开发库默认 `zenith_admin`，`DB_SYNCHRONIZE=true` 会让 TypeORM 自动建表；启动前必须确认这是开发库，不得连接生产库。

当前本机统一使用系统级 `MySQL84` 作为开发数据库，监听 `3306`，服务路径为 `C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe`，配置文件为 `C:/ProgramData/MySQL/MySQL Server 8.4/my.ini`。2026-06-30 已确认 `root` 空密码可登录，并已创建开发库 `zenith_admin`。`apps/server/.env` 指向 `DB_PORT=3306`、`DB_DATABASE=zenith_admin`。不得再默认启动 `127.0.0.1:3317` 的隔离 MySQL 实例。

项目启动优先使用固定脚本：

```powershell
powershell -ExecutionPolicy Bypass -File "C:/Users/Administrator/Desktop/demo/demo1/Zenith-Admin/scripts/start-dev.ps1"
```

该脚本会检查并启动 `MySQL84`、确认 `root` 空密码和 `zenith_admin` 数据库、构建并启动后端 `8085`、启动前端 `3200`。如果端口被旧进程占用，脚本会重启对应项目进程；不要再手工拼零散启动命令。
脚本运行日志统一写入项目内 `.runtime/`，该目录不进入版本管理。

如果本机没有全局 pnpm，可使用 Codex 桌面环境提供的 pnpm：

```powershell
& "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm.cmd" install
```

## 9.1 生产更新与部署

生产环境：

- 访问地址：`https://zhiqiangl.cn/`
- 公网 IP：`101.126.143.247`
- SSH 用户：`root`
- SSH key：`C:/Users/Administrator/.ssh/zhiqiangl_ed25519`
- 应用目录：`/opt/zhiqiangl-admin`
- systemd 服务：`zhiqiangl-admin`
- 当前版本软链：`/opt/zhiqiangl-admin/current`
- 版本目录：`/opt/zhiqiangl-admin/releases/`
- 持久上传目录：`/opt/zhiqiangl-admin/uploads`
- 后端监听：`8085`
- Nginx 对外监听：`80/443`
- 本项目生产数据库：服务器本机 `127.0.0.1:3307`，库名 `zhiqiangl_admin`

更新生产环境只使用固定脚本：

```powershell
powershell -ExecutionPolicy Bypass -File "C:/Users/Administrator/Desktop/demo/demo1/Zenith-Admin/scripts/deploy-prod.ps1"
```

脚本职责：

- 本机构建后端和前端。
- 排除 `.env`、`.runtime`、`node_modules`、上传文件和日志后打包。
- 上传到服务器 `/tmp/zhiqiangl-admin.tar.gz`。
- 解压到 `/opt/zhiqiangl-admin/releases/<yyyyMMddHHmmss>`。
- 从旧 `current` 复制线上 `apps/server/.env` 到新 release。
- 将 `apps/server/uploads` 链接到 `/opt/zhiqiangl-admin/uploads`。
- 执行 `pnpm install --prod --frozen-lockfile --ignore-scripts`。
- 切换 `current` 软链并重启 `zhiqiangl-admin`。

部署后最小验证：

```powershell
ssh -i "C:/Users/Administrator/.ssh/zhiqiangl_ed25519" root@101.126.143.247 "systemctl is-active zhiqiangl-admin && readlink -f /opt/zhiqiangl-admin/current"
curl.exe -k -I "https://zhiqiangl.cn/"
```

生产红线：

- 不要动服务器 `3306` 端口和 `zenith_admin` 库；它们属于另一个项目。
- 不要把本地 `.env` 或任何密码写入文档、提交或打包产物。
- 不要在未确认影响范围时执行生产数据库结构变更、批量更新或删除。
- 不要手工拼零散生产部署命令，除非固定脚本已在上传后中断且需要只补远端 release 切换。

回滚方式：

```bash
ln -sfn /opt/zhiqiangl-admin/releases/<旧版本号> /opt/zhiqiangl-admin/current
systemctl restart zhiqiangl-admin
systemctl is-active zhiqiangl-admin
```

排障要点：

- `UFW BLOCK` 高位端口日志通常是公网扫描，不代表本项目端口异常。
- SSH 卡在 banner 或 HTTPS 握手超时时，优先从云控制台检查 `uptime`、`free -h`、`systemctl status ssh nginx zhiqiangl-admin --no-pager`。
- 控制台日志刷屏时可临时执行 `dmesg -n 1`，再重启 `systemd-journald` 或 `ssh`。
- 若脚本在上传后失败，先查 `/tmp/zhiqiangl-admin.tar.gz` 和 `readlink -f /opt/zhiqiangl-admin/current`，确认后只补远端解压、软链切换和服务重启。

## 10. 待确认事项

- 移动端优先做 H5 还是直接做小程序。
- 发票 ZIP/OCR 批量识别何时进入下一阶段。
- 订单旧表导入、发票导入、银行流水导入仍需按“暂存预览 -> 人工确认入库”继续实现；当前已实现的是单位基础客户库导入。

## 11. 当前实现状态

- 开发环境默认连接真实后端 API，前端不再保留本地原型权限和样例数据旁路。
- 业务模块早期前端样例数据和业务原型 store 已删除，客户、订单、组织、数据字典和系统参数等正式页面必须走真实 API。
- 菜单和按钮权限以后端 `sys_permissions` 为唯一来源，前端不得再维护静态权限树兜底。
- `src/views/home/index.vue` 已替换为众恒工作台。
- `src/views/login/index.vue` 已替换为 `众恒科技管理系统` 登录页，登录走后端 `/auth/login`。
- `apps/server/src/database/database-seed.service.ts` 只自动创建超级管理员 `admin`、缺失的系统菜单元数据和系统参数元数据；已存在菜单由菜单管理维护，启动种子不得覆盖用户在菜单管理里的菜单名称、路径、图标、显示状态等修改。超级管理员默认密码来自 `SYSTEM_ADMIN_PASSWORD`，开发默认 `123456`；员工初始密码、登录令牌有效期、密码最小长度、金山历史文档入口、客户账号系统候选项、订单编号前缀、订单默认行为、服务到期预警天数、上传大小上限和布局设置按钮显示开关来自系统参数。
- `src/views/business/settings/index.vue` 已接真实基础设置 API。区划、职位通过 `dictionary_items` 维护；服务目录通过独立 `service_catalog` 维护类别、默认价格和启停状态，最低服务月数和到期提醒由类别派生；部门已升级为组织管理中的 `org_departments`。
- `src/views/system/parameters/index.vue` 已接真实系统参数 API，可维护员工初始密码等全局配置。
- `src/views/system/operation-logs/index.vue` 已接真实操作日志 API，用于按模块、动作、目标和关键词查询系统审计记录。
- `src/views/pms/user/index.vue` 已接真实用户 API，只展示普通员工账号，不展示超级管理员；支持关键字、部门、职位、角色、状态筛选，支持创建员工账号、分配角色、重置密码、启停和删除。
- `src/views/business/team/index.vue` 已重构为组织管理页面，包含组织概览、部门架构和员工档案；部门架构支持架构图和树表维护，员工档案支持关键字/部门/职位/在职状态筛选、资料总览和编辑档案抽屉。
- `src/views/business/clients/index.vue` 和 `src/views/business/clients/detail.vue` 已接真实客户 API，支持客户列表、独立详情、联系人、账号资料、单位身份变更历史、合并记录、订单/服务项概览和带客户参数的新建订单入口，并支持单位基础客户库上传、批次列表、明细预览、重新校验和确认入库。
- `src/views/business/orders/index.vue` 已接真实订单 API，支持订单汇总、订单/服务项筛选、创建订单、订单详情、订单软删除、服务项履约更新、服务项新增/编辑/删除、打包价分摊校验、接单人/填报人和最低服务期校验；后端 `apps/server/src/modules/orders/` 已补齐订单详情、订单汇总、订单更新、订单软删除、服务项新增/更新/删除接口，并通过服务项状态自动汇总订单状态。
- 后端已实现 `auth/users/roles/permissions/dictionaries/service-catalog/clients/orders/finance/archive/commission/dashboard` 基础模块；`clients` 模块已实现单位基础客户库导入批次、明细暂存、重新校验和确认入库；普通用户切换角色已接真实后端接口，超级管理员不显示切换角色入口。
- 财务管理已实现合同底账、发票底账、发票新增/编辑抽屉内上传单张附件、按文件名和文本型电子发票 PDF 票面文本识别发票号/日期/金额/购买方并回填、收款手工录入、收款匹配发票、按发票明细比例写入 `payment_service_allocations`、回写服务项已收金额、财务汇总和服务项对账；扫描件或图片型 PDF 暂不做 OCR；已匹配收款的发票只允许编辑发票号、购买方、开票日期、送达状态和备注等非核算字段；财务底账读取由 `ViewFinance` 控制，财务写按钮保存角色时会隐含补齐 `ViewFinance`，写接口使用 `RequireAllPermissions` 同时校验读取和写入按钮权限。
- 提成结算已并入财务管理入口，不在侧边栏显示为菜单。`CommissionRules` 是隐藏顶级路由，`activeMenuCode=FinanceSettlement` 只用于进入隐藏路由后的侧边栏高亮，不承载财务底账读取；提成模块支持规则配置、服务项基数查看、结算草稿生成、结算确认、标记发放、取消结算和明细追溯，按已收金额结算时可关联 `payment_service_allocations`。
- 资料中心已替代原“档案”菜单，包含业务归档、公司资料和周报汇总：业务归档通过资料文件表和业务关联表挂接客户、订单、服务项、合同、发票、收款；公司资料全员可查看，发布、编辑和删除走 `ManageArchiveMaterial` 权限；资料预览、下载和删除写入操作日志；周报独立建模，按当前公司 Word 周报格式支持周一到周五每日工作内容、本周总结、手工填写、系统按服务项生成草稿、保存和提交。
- 资料中心、看板页面已接真实后端读接口；没有数据库记录时展示真实空列表，不得回退到前端 mock 或样例数据。经营看板拆为 `经营总览`、`回款分析`、`履约待办`、`排行分析` 四个子菜单，复用同一个看板接口和页面组件按路由视角展示不同区块。
