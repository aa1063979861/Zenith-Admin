import { Column, Entity, Index, OneToMany } from 'typeorm';
import { IMPORT_BATCH_STATUS, ImportBatchStatus } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { FinancePaymentImportRow } from './finance-payment-import-row.entity';

export type FinancePaymentImportStatus = ImportBatchStatus;

@Entity('finance_payment_imports', { comment: '财务银行流水导入批次表' })
@Index(['importedAt'])
@Index(['status'])
export class FinancePaymentImport extends BaseEntity {
  @Column({ type: 'varchar', length: 255, comment: '来源文件名' })
  sourceFileName: string;

  @Column({ type: 'int', comment: '导入人用户ID' })
  importedBy: number;

  @Column({ type: 'varchar', length: 80, comment: '导入人姓名' })
  importedByName: string;

  @Column({ type: 'datetime', comment: '导入时间' })
  importedAt: Date;

  @Column({ type: 'varchar', length: 40, default: IMPORT_BATCH_STATUS.PARSED, comment: '批次状态：parsed已解析，confirmed已确认，failed失败' })
  status: FinancePaymentImportStatus;

  @Column({ type: 'int', default: 0, comment: '总行数' })
  totalRows: number;

  @Column({ type: 'int', default: 0, comment: '有效行数' })
  validRows: number;

  @Column({ type: 'int', default: 0, comment: '警告行数' })
  warningRows: number;

  @Column({ type: 'int', default: 0, comment: '错误行数' })
  errorRows: number;

  @Column({ type: 'int', default: 0, comment: '已生成收款数' })
  importedRows: number;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '批次备注' })
  remark?: string | null;

  @OneToMany(() => FinancePaymentImportRow, row => row.batch)
  rows: FinancePaymentImportRow[];
}
