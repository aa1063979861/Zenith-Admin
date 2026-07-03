import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionLine } from '../../entities/commission-line.entity';
import { CommissionRule } from '../../entities/commission-rule.entity';
import { CommissionSettlement } from '../../entities/commission-settlement.entity';
import { ServiceItem } from '../../entities/service-item.entity';
import { AuthModule } from '../auth/auth.module';
import { ServiceCatalogModule } from '../service-catalog/service-catalog.module';
import { CommissionController } from './commission.controller';
import { CommissionService } from './commission.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommissionRule, CommissionSettlement, CommissionLine, ServiceItem]), AuthModule, ServiceCatalogModule],
  controllers: [CommissionController],
  providers: [CommissionService],
})
export class CommissionModule {}
