export {
  ARCHIVE_WEEKLY_REPORT_SOURCE_TYPE,
  ARCHIVE_WEEKLY_REPORT_STATUS,
  ARCHIVE_WEEKLY_REPORT_STATUSES,
} from '../../common/business.constants';

export const ARCHIVE_ENTITY_TYPES = ['客户', '订单', '服务项', '合同', '发票', '收款'] as const;
export type ArchiveEntityType = typeof ARCHIVE_ENTITY_TYPES[number];

export const ARCHIVE_BUSINESS_TAGS = ['合同', '发票', '银行流水', '报告', '上报证明', '截图', '客户资料', '其他'] as const;
export const ARCHIVE_MATERIAL_TYPES = ['制度文件', '操作说明', '政策文件', '培训资料', '视频', '其他'] as const;
export const ARCHIVE_MATERIAL_STATUSES = ['已发布', '已废止'] as const;

export const ARCHIVE_ALLOWED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.mp4',
  '.webm',
  '.mov',
] as const;
