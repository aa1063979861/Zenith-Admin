import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ImportRowStatus } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { FinancePaymentImport } from './finance-payment-import.entity';

export type FinancePaymentImportRowStatus = ImportRowStatus;

@Entity('finance_payment_import_rows', { comment: '财务银行流水导入明细表' })
@Index(['batchId', 'sheetName', 'rowNo'], { unique: true })
@Index(['batchId', 'validationStatus'])
export class FinancePaymentImportRow extends BaseEntity {
  @Column({ type: 'int', comment: '导入批次ID' })
  batchId: number;

  @ManyToOne(() => FinancePaymentImport, batch => batch.rows, { nullable: false })
  batch: FinancePaymentImport;

  @Column({ type: 'varchar', length: 120, comment: '工作表名称' })
  sheetName: string;

  @Column({ type: 'int', comment: 'Excel原始行号' })
  rowNo: number;

  @Column({ type: 'json', comment: '原始行JSON' })
  rawJson: Record<string, unknown>;

  @Column({ type: 'json', nullable: true, comment: '标准化收款JSON' })
  normalizedJson?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 40, comment: '校验状态：valid有效，warning警告，error错误，imported已入库，skipped跳过' })
  validationStatus: FinancePaymentImportRowStatus;

  @Column({ type: 'text', nullable: true, comment: '校验说明' })
  validationMessage?: string | null;

  @Column({ type: 'int', nullable: true, comment: '匹配到的客户ID' })
  clientId?: number | null;

  @Column({ type: 'int', nullable: true, comment: '生成的收款ID' })
  paymentId?: number | null;
}
