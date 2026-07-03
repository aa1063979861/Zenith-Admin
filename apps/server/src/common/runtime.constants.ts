export const SERVER_DEFAULTS = {
  PORT: 8085,
  CORS_ORIGINS: ['http://localhost:3200', 'http://127.0.0.1:3200'],
  DB_HOST: '127.0.0.1',
  DB_PORT: 3306,
  DB_USERNAME: 'root',
  DB_PASSWORD: '',
  DB_DATABASE: 'zenith_admin',
  SYSTEM_ADMIN_USERNAME: 'admin',
  SYSTEM_ADMIN_PASSWORD: '123456',
  JWT_SECRET: 'zenith-admin-dev-secret',
} as const;

export const DEVELOPMENT_JWT_SECRETS = [
  SERVER_DEFAULTS.JWT_SECRET,
  'zenith-admin-local-development-secret',
] as const;
