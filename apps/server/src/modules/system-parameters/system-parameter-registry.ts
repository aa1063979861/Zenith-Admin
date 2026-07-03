import { SystemParameterValueType } from '../../entities/system-parameter.entity';

export type RegisteredSystemParameter = {
  paramKey: string;
  paramName: string;
  valueType: SystemParameterValueType;
  groupName: string;
  defaultValue: () => string;
  sort: number;
  remark: string;
  usageScene: string;
  effectiveScope: string;
  minNumber?: number;
  maxNumber?: number;
  integer?: boolean;
};

export const DEFAULT_EMPLOYEE_INITIAL_PASSWORD = '123456';
export const DEFAULT_SECURITY_ACCESS_TOKEN_TTL_MINUTES = 15;
export const DEFAULT_SECURITY_REFRESH_TOKEN_TTL_MINUTES = 8 * 60;
export const DEFAULT_SECURITY_PASSWORD_MIN_LENGTH = 6;
export const DEFAULT_ORDER_SERVICE_DUE_WARNING_DAYS = 30;
export const DEFAULT_ORDER_NO_PREFIX = 'ZH';
export const DEFAULT_UPLOAD_AVATAR_MAX_MB = 2;
export const DEFAULT_UPLOAD_IMPORT_EXCEL_MAX_MB = 20;
export const DEFAULT_UPLOAD_ARCHIVE_FILE_MAX_MB = 200;
export const DEFAULT_UI_LAYOUT_SETTING_VISIBLE = true;
export const DEFAULT_ORDER_PERFORMER_DEFAULTS_TO_RECEIVER = true;
export const DEFAULT_ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT = true;
export const DEFAULT_CLIENT_CREDENTIAL_SYSTEM_OPTIONS = '[]';
export const EMPLOYEE_INITIAL_PASSWORD_KEY = 'employee.initial_password';
export const SECURITY_ACCESS_TOKEN_TTL_MINUTES_KEY = 'security.access_token_ttl_minutes';
export const SECURITY_REFRESH_TOKEN_TTL_MINUTES_KEY = 'security.refresh_token_ttl_minutes';
export const SECURITY_PASSWORD_MIN_LENGTH_KEY = 'security.password_min_length';
export const KDOCS_HISTORY_LINKS_KEY = 'kdocs.history_links';
export const CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY = 'client.credential_system_options';
export const ORDER_NO_PREFIX_KEY = 'order.order_no_prefix';
export const ORDER_SERVICE_DUE_WARNING_DAYS_KEY = 'order.service_due_warning_days';
export const UPLOAD_AVATAR_MAX_MB_KEY = 'upload.avatar_max_mb';
export const UPLOAD_IMPORT_EXCEL_MAX_MB_KEY = 'upload.import_excel_max_mb';
export const UPLOAD_ARCHIVE_FILE_MAX_MB_KEY = 'upload.archive_file_max_mb';
export const UI_LAYOUT_SETTING_VISIBLE_KEY = 'ui.layout_setting_visible';
export const ORDER_PERFORMER_DEFAULTS_TO_RECEIVER_KEY = 'order.performer_defaults_to_receiver';
export const ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT_KEY = 'order.service_year_previous_year_default';

export const REGISTERED_SYSTEM_PARAMETERS: RegisteredSystemParameter[] = [
  {
    paramKey: EMPLOYEE_INITIAL_PASSWORD_KEY,
    paramName: '员工初始密码',
    valueType: 'password',
    groupName: '用户管理',
    defaultValue: () => process.env.DEFAULT_EMPLOYEE_PASSWORD || DEFAULT_EMPLOYEE_INITIAL_PASSWORD,
    sort: 1,
    remark: '用户管理新增员工账号时使用的默认初始密码',
    usageScene: '用户管理 - 新增员工账号',
    effectiveScope: '创建员工账号时作为默认初始密码',
  },
  {
    paramKey: SECURITY_ACCESS_TOKEN_TTL_MINUTES_KEY,
    paramName: '访问令牌有效期',
    valueType: 'number',
    groupName: '登录安全',
    defaultValue: () => String(toMinutes(process.env.AUTH_ACCESS_TOKEN_TTL, DEFAULT_SECURITY_ACCESS_TOKEN_TTL_MINUTES)),
    sort: 10,
    remark: '登录后接口访问令牌的有效分钟数',
    usageScene: '登录认证 - 访问令牌签发',
    effectiveScope: '用户登录、刷新登录状态、切换角色后，新签发的访问令牌按该分钟数过期',
    minNumber: 1,
    maxNumber: 1440,
    integer: true,
  },
  {
    paramKey: SECURITY_REFRESH_TOKEN_TTL_MINUTES_KEY,
    paramName: '登录保持时长',
    valueType: 'number',
    groupName: '登录安全',
    defaultValue: () => process.env.AUTH_REFRESH_TOKEN_TTL_MINUTES || String(DEFAULT_SECURITY_REFRESH_TOKEN_TTL_MINUTES),
    sort: 11,
    remark: '刷新令牌和登录会话的有效分钟数',
    usageScene: '登录认证 - 刷新令牌与登录会话',
    effectiveScope: '用户重新登录或刷新登录状态后，登录会话和刷新 Cookie 按该分钟数过期',
    minNumber: 5,
    maxNumber: 43200,
    integer: true,
  },
  {
    paramKey: SECURITY_PASSWORD_MIN_LENGTH_KEY,
    paramName: '密码最小长度',
    valueType: 'number',
    groupName: '登录安全',
    defaultValue: () => String(DEFAULT_SECURITY_PASSWORD_MIN_LENGTH),
    sort: 12,
    remark: '用户密码、重置密码和员工初始密码的最小长度',
    usageScene: '用户管理 - 密码设置',
    effectiveScope: '修改密码、重置员工密码、校验员工初始密码时按该长度限制',
    minNumber: 6,
    maxNumber: 32,
    integer: true,
  },
  {
    paramKey: KDOCS_HISTORY_LINKS_KEY,
    paramName: '金山历史文档列表',
    valueType: 'string',
    groupName: '金山文档',
    defaultValue: () => process.env.KDOCS_HISTORY_LINKS || '[]',
    sort: 100,
    remark: 'JSON数组，例如：[{"name":"2025一体化增值业务","url":"https://www.kdocs.cn/l/xxxx","category":"旧业务"}]',
    usageScene: '金山历史查询 - 文档入口',
    effectiveScope: '系统内展示金山文档入口，不调用金山开放平台API',
  },
  {
    paramKey: CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY,
    paramName: '客户账号系统选项',
    valueType: 'string',
    groupName: '客户账号',
    defaultValue: () => process.env.CLIENT_CREDENTIAL_SYSTEM_OPTIONS || DEFAULT_CLIENT_CREDENTIAL_SYSTEM_OPTIONS,
    sort: 150,
    remark: 'JSON数组，例如：[{"name":"系统名称","loginUrl":"http://example.local/login"}]',
    usageScene: '客户管理 - 新增或编辑客户账号资料',
    effectiveScope: '账号资料表单按该配置展示系统名称候选项，并自动带出登录地址；为空时允许手工填写',
  },
  {
    paramKey: ORDER_NO_PREFIX_KEY,
    paramName: '订单编号前缀',
    valueType: 'string',
    groupName: '订单管理',
    defaultValue: () => process.env.ORDER_NO_PREFIX || DEFAULT_ORDER_NO_PREFIX,
    sort: 199,
    remark: '订单号日期前的固定前缀，仅支持1-8位英文字母或数字，例如：ZH',
    usageScene: '订单管理 - 新建订单和续签订单',
    effectiveScope: '新生成订单号使用该前缀；已生成订单号不回写',
  },
  {
    paramKey: ORDER_SERVICE_DUE_WARNING_DAYS_KEY,
    paramName: '服务到期预警天数',
    valueType: 'number',
    groupName: '订单管理',
    defaultValue: () => String(DEFAULT_ORDER_SERVICE_DUE_WARNING_DAYS),
    sort: 200,
    remark: '服务到期前多少天进入即将到期、待续签提醒口径',
    usageScene: '订单管理、服务项列表、经营看板 - 到期提醒',
    effectiveScope: '服务项到期统计、待续签判断和待办排序按该天数计算',
    minNumber: 1,
    maxNumber: 365,
    integer: true,
  },
  {
    paramKey: ORDER_PERFORMER_DEFAULTS_TO_RECEIVER_KEY,
    paramName: '完成人默认同接单人',
    valueType: 'boolean',
    groupName: '订单管理',
    defaultValue: () => String(DEFAULT_ORDER_PERFORMER_DEFAULTS_TO_RECEIVER),
    sort: 201,
    remark: '新增订单选择接单人和服务项时，是否自动把完成人设置为接单人',
    usageScene: '订单管理 - 新增订单表单',
    effectiveScope: '新建订单草稿中服务项完成人的默认值；已保存订单不受影响',
  },
  {
    paramKey: ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT_KEY,
    paramName: '服务年度默认上一年度',
    valueType: 'boolean',
    groupName: '订单管理',
    defaultValue: () => String(DEFAULT_ORDER_SERVICE_YEAR_PREVIOUS_YEAR_DEFAULT),
    sort: 202,
    remark: '新增订单时服务年度是否默认取当前年度的上一年度',
    usageScene: '订单管理 - 新增订单表单',
    effectiveScope: '仅影响新建订单表单打开时的服务年度默认值',
  },
  {
    paramKey: UPLOAD_AVATAR_MAX_MB_KEY,
    paramName: '头像上传大小上限',
    valueType: 'number',
    groupName: '上传限制',
    defaultValue: () => String(DEFAULT_UPLOAD_AVATAR_MAX_MB),
    sort: 300,
    remark: '个人头像上传文件大小上限，单位 MB',
    usageScene: '个人资料 - 上传头像',
    effectiveScope: '上传头像接口按该大小限制文件',
    minNumber: 1,
    maxNumber: 20,
    integer: true,
  },
  {
    paramKey: UPLOAD_IMPORT_EXCEL_MAX_MB_KEY,
    paramName: '导入Excel大小上限',
    valueType: 'number',
    groupName: '上传限制',
    defaultValue: () => String(DEFAULT_UPLOAD_IMPORT_EXCEL_MAX_MB),
    sort: 301,
    remark: '客户导入和银行流水导入 Excel 文件大小上限，单位 MB',
    usageScene: '客户导入、财务银行流水导入',
    effectiveScope: '导入类 Excel 上传接口按该大小限制文件',
    minNumber: 1,
    maxNumber: 100,
    integer: true,
  },
  {
    paramKey: UPLOAD_ARCHIVE_FILE_MAX_MB_KEY,
    paramName: '资料文件上传大小上限',
    valueType: 'number',
    groupName: '上传限制',
    defaultValue: () => String(DEFAULT_UPLOAD_ARCHIVE_FILE_MAX_MB),
    sort: 302,
    remark: '资料中心业务归档和公司资料文件大小上限，单位 MB',
    usageScene: '资料中心 - 业务归档、公司资料',
    effectiveScope: '资料中心上传接口按该大小限制文件',
    minNumber: 1,
    maxNumber: 1024,
    integer: true,
  },
  {
    paramKey: UI_LAYOUT_SETTING_VISIBLE_KEY,
    paramName: '显示布局设置按钮',
    valueType: 'boolean',
    groupName: '界面设置',
    defaultValue: () => String(DEFAULT_UI_LAYOUT_SETTING_VISIBLE),
    sort: 400,
    remark: '是否在页面右侧显示布局设置浮动按钮',
    usageScene: '全局布局 - LayoutSetting',
    effectiveScope: '登录后的前端页面按该开关显示或隐藏布局设置按钮',
  },
];

export const REGISTERED_SYSTEM_PARAMETER_MAP = new Map(
  REGISTERED_SYSTEM_PARAMETERS.map(parameter => [parameter.paramKey, parameter]),
);

export type KdocsHistoryLink = {
  id: number;
  name: string;
  url: string;
  category: string;
  remark: string;
};

export type ClientCredentialSystemOption = {
  id: number;
  name: string;
  loginUrl: string;
};

export function parseKdocsHistoryLinks(rawValue: string) {
  let links: unknown;
  try {
    links = JSON.parse(rawValue || '[]');
  }
  catch {
    throw new Error(`${KDOCS_HISTORY_LINKS_KEY} 必须是JSON数组`);
  }
  if (!Array.isArray(links))
    throw new Error(`${KDOCS_HISTORY_LINKS_KEY} 必须是JSON数组`);

  return links.map((link, index) => normalizeKdocsHistoryLink(link, index)).filter((link): link is KdocsHistoryLink => Boolean(link));
}

export function normalizeKdocsHistoryLinksValue(rawValue: string) {
  const links = parseKdocsHistoryLinks(rawValue);
  return JSON.stringify(links.map(link => ({
    name: link.name,
    url: link.url,
    category: link.category,
    remark: link.remark,
  })));
}

export function parseClientCredentialSystemOptions(rawValue: string) {
  let options: unknown;
  try {
    options = JSON.parse(rawValue || DEFAULT_CLIENT_CREDENTIAL_SYSTEM_OPTIONS);
  }
  catch {
    throw new Error(`${CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY} 必须是JSON数组`);
  }
  if (!Array.isArray(options))
    throw new Error(`${CLIENT_CREDENTIAL_SYSTEM_OPTIONS_KEY} 必须是JSON数组`);

  return options.map((option, index) => normalizeClientCredentialSystemOption(option, index)).filter((option): option is ClientCredentialSystemOption => Boolean(option));
}

export function normalizeClientCredentialSystemOptionsValue(rawValue: string) {
  const options = parseClientCredentialSystemOptions(rawValue);
  return JSON.stringify(options.map(option => ({
    name: option.name,
    loginUrl: option.loginUrl,
  })));
}

function toMinutes(value: string | undefined, fallback: number) {
  const text = value?.trim();
  if (!text)
    return fallback;
  if (/^\d+$/.test(text))
    return Number(text);

  const matched = text.match(/^(\d+)([smhd])$/i);
  if (!matched)
    return fallback;

  const amount = Number(matched[1]);
  const unit = matched[2].toLowerCase();
  if (unit === 's')
    return Math.max(1, Math.ceil(amount / 60));
  if (unit === 'm')
    return amount;
  if (unit === 'h')
    return amount * 60;
  return amount * 24 * 60;
}

function normalizeKdocsHistoryLink(link: unknown, index: number): KdocsHistoryLink | null {
  const record = link && typeof link === 'object' ? link as Record<string, unknown> : {};
  const name = String(record.name || '').trim();
  const url = String(record.url || '').trim();
  if (!name && !url)
    return null;
  if (!name || !url)
    throw new Error(`第 ${index + 1} 个金山文档配置缺少名称或链接`);
  if (!/^https:\/\/(www\.)?kdocs\.cn\//.test(url))
    throw new Error(`第 ${index + 1} 个金山文档链接必须是 https://kdocs.cn 或 https://www.kdocs.cn`);
  return {
    id: index + 1,
    name,
    url,
    category: String(record.category || '金山文档').trim(),
    remark: String(record.remark || '').trim(),
  };
}

function normalizeClientCredentialSystemOption(option: unknown, index: number): ClientCredentialSystemOption | null {
  const record = option && typeof option === 'object' ? option as Record<string, unknown> : {};
  const name = String(record.name || '').trim();
  const loginUrl = String(record.loginUrl || '').trim();
  if (!name && !loginUrl)
    return null;
  if (!name || !loginUrl)
    throw new Error(`第 ${index + 1} 个客户账号系统配置缺少名称或登录地址`);
  assertHttpUrl(loginUrl, `第 ${index + 1} 个客户账号系统登录地址`);
  return {
    id: index + 1,
    name,
    loginUrl,
  };
}

function assertHttpUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  }
  catch {
    throw new Error(`${label}必须是有效 URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(`${label}仅支持 http 或 https`);
}
