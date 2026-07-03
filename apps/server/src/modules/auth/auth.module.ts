import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SERVER_DEFAULTS } from '../../common/runtime.constants';
import { AuthSession } from '../../entities/auth-session.entity';
import { Permission } from '../../entities/permission.entity';
import { User } from '../../entities/user.entity';
import { SystemParametersModule } from '../system-parameters/system-parameters.module';
import { OperationLogsModule } from '../operation-logs/operation-logs.module';
import { DEFAULT_ACCESS_TOKEN_TTL } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSession, User, Permission]),
    forwardRef(() => SystemParametersModule),
    forwardRef(() => OperationLogsModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || SERVER_DEFAULTS.JWT_SECRET,
        signOptions: {
          expiresIn: configService.get<string>('AUTH_ACCESS_TOKEN_TTL') || DEFAULT_ACCESS_TOKEN_TTL,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionGuard],
  exports: [TypeOrmModule, JwtModule, AuthService, JwtAuthGuard, PermissionGuard],
})
export class AuthModule {}
