import { Body, Controller, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../entities/user.entity';
import { OperationLogsService } from '../operation-logs/operation-logs.service';
import {
  DEFAULT_REFRESH_COOKIE_NAME,
  DEFAULT_REFRESH_COOKIE_PATH,
} from './auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthRequestContext } from './types/auth-request-context';

interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

interface AuthResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly operationLogsService: OperationLogsService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: AuthResponse) {
    let result: Awaited<ReturnType<AuthService['login']>>;
    try {
      result = await this.authService.login(dto, this.getRequestContext(request));
    }
    catch (error) {
      await this.operationLogsService.record({
        module: '登录认证',
        action: '登录失败',
        targetType: 'auth-login',
        targetName: dto.username,
        detailJson: { username: dto.username, reason: error instanceof Error ? error.message : '登录失败' },
      });
      throw error;
    }
    await this.setRefreshCookie(response, result.refreshToken);
    await this.operationLogsService.record({
      module: '登录认证',
      action: '登录成功',
      targetType: 'auth-login',
      targetId: result.user.id,
      targetName: result.user.username,
      user: result.user,
    });
    return { accessToken: result.accessToken };
  }

  @Post('refresh/token')
  async refresh(@Req() request: AuthRequest, @Res({ passthrough: true }) response: AuthResponse) {
    const result = await this.authService.refresh(this.getRefreshToken(request), this.getRequestContext(request));
    await this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('current-role/switch/:roleCode')
  async switchCurrentRole(@CurrentUser() user: User, @Param('roleCode') roleCode: string) {
    const result = await this.authService.switchCurrentRole(user, roleCode);
    await this.operationLogsService.record({
      module: '登录认证',
      action: '切换角色',
      targetType: 'auth-role',
      targetId: user.id,
      targetName: roleCode,
      user,
      detailJson: { roleCode },
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('password')
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    const result = await this.authService.changePassword(user, dto);
    await this.operationLogsService.record({
      module: '登录认证',
      action: '修改密码',
      targetType: 'auth-password',
      targetId: user.id,
      targetName: user.username,
      user,
    });
    return result;
  }

  @Post('logout')
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: AuthResponse) {
    const user = await this.authService.logout(this.getRefreshToken(request));
    await this.operationLogsService.record({
      module: '登录认证',
      action: '退出登录',
      targetType: 'auth-logout',
      targetId: user?.id || null,
      targetName: user?.username || null,
      user,
    });
    this.clearRefreshCookie(response);
    return true;
  }

  private getRequestContext(request: AuthRequest): AuthRequestContext {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim() || request.ip;
    const userAgent = request.headers['user-agent'];

    return {
      ipAddress,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }

  private getRefreshToken(request: AuthRequest) {
    const cookieHeader = request.headers.cookie;
    const cookieValue = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader || '';
    const cookieName = this.getRefreshCookieName();
    return cookieValue
      .split(';')
      .map(item => item.trim())
      .find(item => item.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
  }

  private async setRefreshCookie(response: AuthResponse, refreshToken: string) {
    response.cookie(this.getRefreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.isSecureCookie(),
      path: this.getRefreshCookiePath(),
      maxAge: await this.authService.getRefreshTokenMaxAgeMs(),
    });
  }

  private clearRefreshCookie(response: AuthResponse) {
    response.clearCookie(this.getRefreshCookieName(), {
      path: this.getRefreshCookiePath(),
      sameSite: 'strict',
      secure: this.isSecureCookie(),
    });
  }

  private getRefreshCookieName() {
    return this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME') || DEFAULT_REFRESH_COOKIE_NAME;
  }

  private getRefreshCookiePath() {
    return this.configService.get<string>('AUTH_REFRESH_COOKIE_PATH') || DEFAULT_REFRESH_COOKIE_PATH;
  }

  private isSecureCookie() {
    return this.configService.get<string>('AUTH_COOKIE_SECURE') === 'true';
  }
}
