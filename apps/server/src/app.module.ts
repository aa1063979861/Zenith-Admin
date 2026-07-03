import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AuthModule } from './modules/auth/auth.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CommissionModule } from './modules/commission/commission.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DictionariesModule } from './modules/dictionaries/dictionaries.module';
import { FinanceModule } from './modules/finance/finance.module';
import { KdocsModule } from './modules/kdocs/kdocs.module';
import { OperationLogsModule } from './modules/operation-logs/operation-logs.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { ServiceCatalogModule } from './modules/service-catalog/service-catalog.module';
import { SystemParametersModule } from './modules/system-parameters/system-parameters.module';
import { TablePreferencesModule } from './modules/table-preferences/table-preferences.module';
import { UsersModule } from './modules/users/users.module';
import { assertProductionSafety } from './config/production-safety';
import { SERVER_DEFAULTS } from './common/runtime.constants';
import { DatabaseSeedService } from './database/database-seed.service';
import { Announcement } from './entities/announcement.entity';
import { DictionaryItem } from './entities/dictionary-item.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { SystemParameter } from './entities/system-parameter.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        assertProductionSafety(configService);
        return {
          type: 'mysql',
          host: configService.get<string>('DB_HOST') || SERVER_DEFAULTS.DB_HOST,
          port: Number(configService.get<string>('DB_PORT') || SERVER_DEFAULTS.DB_PORT),
          username: configService.get<string>('DB_USERNAME') || SERVER_DEFAULTS.DB_USERNAME,
          password: configService.get<string>('DB_PASSWORD') ?? SERVER_DEFAULTS.DB_PASSWORD,
          database: configService.get<string>('DB_DATABASE') || SERVER_DEFAULTS.DB_DATABASE,
          autoLoadEntities: true,
          synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
          logging: configService.get<string>('DB_LOGGING') === 'true',
          charset: 'utf8mb4',
          timezone: '+08:00',
        };
      },
    }),
    TypeOrmModule.forFeature([User, Permission, Role, SystemParameter, DictionaryItem, Announcement]),
    AnnouncementsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DictionariesModule,
    OperationLogsModule,
    OrganizationModule,
    ClientsModule,
    OrdersModule,
    FinanceModule,
    KdocsModule,
    ArchiveModule,
    CommissionModule,
    DashboardModule,
    ServiceCatalogModule,
    SystemParametersModule,
    TablePreferencesModule,
  ],
  providers: [DatabaseSeedService],
})
export class AppModule {}
