export interface AuthRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokenPayload {
  jti: string;
  sub: number;
  username: string;
  sid: number;
  roleCode?: string;
}
