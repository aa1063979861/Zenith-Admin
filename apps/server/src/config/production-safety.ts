import { ConfigService } from '@nestjs/config';
import { DEVELOPMENT_JWT_SECRETS, SERVER_DEFAULTS } from '../common/runtime.constants';

type EnvSource = ConfigService | NodeJS.ProcessEnv;

function readEnv(source: EnvSource, key: string) {
  if (typeof (source as ConfigService).get === 'function')
    return (source as ConfigService).get<string>(key);
  return (source as NodeJS.ProcessEnv)[key];
}

export function assertProductionSafety(source: EnvSource = process.env) {
  if (readEnv(source, 'NODE_ENV') !== 'production')
    return;

  const errors: string[] = [];
  const developmentJwtSecrets = new Set<string>([...DEVELOPMENT_JWT_SECRETS]);
  const jwtSecret = readEnv(source, 'JWT_SECRET');
  const systemAdminPassword = readEnv(source, 'SYSTEM_ADMIN_PASSWORD');
  if (!jwtSecret || developmentJwtSecrets.has(jwtSecret))
    errors.push('生产环境必须配置非默认 JWT_SECRET');
  if (!systemAdminPassword || systemAdminPassword === SERVER_DEFAULTS.SYSTEM_ADMIN_PASSWORD)
    errors.push('生产环境必须配置非默认 SYSTEM_ADMIN_PASSWORD');
  if (readEnv(source, 'AUTH_COOKIE_SECURE') !== 'true')
    errors.push('生产环境必须设置 AUTH_COOKIE_SECURE=true');
  if (readEnv(source, 'DB_SYNCHRONIZE') !== 'false')
    errors.push('生产环境必须设置 DB_SYNCHRONIZE=false');

  if (errors.length)
    throw new Error(`生产环境安全检查失败：${errors.join('；')}`);
}
