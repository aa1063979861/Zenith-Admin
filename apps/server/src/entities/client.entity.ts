import { Column, Entity, Index, OneToMany, OneToOne } from 'typeorm';
import { CLIENT_UNIT_STATUS, CUSTOMER_LEVEL, ClientUnitStatus, CustomerLevel } from '../common/business.constants';
import { BaseEntity } from './base.entity';
import { ClientContact } from './client-contact.entity';
import { ClientCredential } from './client-credential.entity';
import { ClientIdentityHistory } from './client-identity-history.entity';
import { ClientSummary } from './client-summary.entity';
import { Order } from './order.entity';

export type { ClientUnitStatus, CustomerLevel } from '../common/business.constants';

@Entity('clients', { comment: '客户主数据表' })
@Index(['regionCode', 'unitCode'], { unique: true })
@Index(['customerLevel'])
@Index(['unitStatus'])
export class Client extends BaseEntity {
  @Column({ length: 120, comment: '系统区划编码，来源于数据字典region' })
  regionCode: string;

  @Column({ length: 160, comment: '系统区划名称' })
  regionName: string;

  @Column({ length: 6, comment: '单位编码，必须为6位数字' })
  unitCode: string;

  @Column({ length: 255, comment: '单位名称' })
  unitName: string;

  @Column({ length: 40, default: CLIENT_UNIT_STATUS.NORMAL, comment: '单位状态：NORMAL正常，CANCELLED已撤销，MERGED已合并，DISABLED停用' })
  unitStatus: ClientUnitStatus;

  @Column({ length: 40, default: CUSTOMER_LEVEL.NORMAL, comment: '客户等级：NORMAL普通，IMPORTANT重点，CORE核心，STRATEGIC战略' })
  customerLevel: CustomerLevel;

  @Column({ type: 'int', nullable: true, comment: '合并后单位ID' })
  mergedToClientId?: number | null;

  @Column({ type: 'varchar', nullable: true, length: 120, comment: '统一社会信用代码' })
  unifiedSocialCreditCode?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '法人' })
  legalPerson?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '财务人员' })
  financeStaff?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 80, comment: '财务负责人' })
  financeManager?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '客户来源，manual手工录入，import导入' })
  source?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 255, comment: '单位地址' })
  address?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 40, comment: '联系电话' })
  contactPhone?: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, comment: '备注' })
  remark?: string | null;

  @OneToMany(() => ClientCredential, credential => credential.client)
  credentials: ClientCredential[];

  @OneToMany(() => ClientContact, contact => contact.client)
  contacts: ClientContact[];

  @OneToMany(() => ClientIdentityHistory, history => history.client)
  identityHistories: ClientIdentityHistory[];

  @OneToOne(() => ClientSummary, summary => summary.client)
  summary?: ClientSummary;

  @OneToMany(() => Order, order => order.client)
  orders: Order[];
}
