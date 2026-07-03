import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../../entities/user.entity';
import { AuthService } from '../auth.service';
import { AuthTokenPayload } from '../types/auth-request-context';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization || '';
    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('请先登录');

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      const session = await this.authService.findActiveSessionById(payload.sid, payload.sub);
      const user = session.user;
      if (!user || !user.enable)
        throw new UnauthorizedException('账号不存在或已停用');

      (user as User & { authSessionId?: number; currentRoleCode?: string }).authSessionId = session.id;
      (user as User & { authSessionId?: number; currentRoleCode?: string }).currentRoleCode = payload.roleCode;
      request.user = user;
      return true;
    }
    catch {
      throw new UnauthorizedException('登录状态已失效');
    }
  }
}
