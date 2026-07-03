import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuthSession } from '../../entities/auth-session.entity';
import { User } from '../../entities/user.entity';
import { SystemParametersService } from '../system-parameters/system-parameters.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AuthRequestContext, AuthTokenPayload } from './types/auth-request-context';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthSession) private readonly sessionRepository: Repository<AuthSession>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly parametersService: SystemParametersService,
  ) {}

  async login(dto: LoginDto, context: AuthRequestContext) {
    const user = await this.userRepository.findOne({
      where: { username: dto.username },
      relations: ['roles', 'employeeProfile'],
      select: {
        id: true,
        username: true,
        passwordHash: true,
        nickName: true,
        enable: true,
        userKind: true,
        builtIn: true,
      },
    });
    if (!user)
      throw new UnauthorizedException('登录账号或密码错误');

    const passwordMatched = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatched)
      throw new UnauthorizedException('登录账号或密码错误');
    if (!user.enable)
      throw new UnauthorizedException('账号已停用，请联系管理员');

    const session = await this.createSession(user, context);
    return this.issueTokenPair(user, session);
  }

  async refresh(refreshToken: string | undefined, context: AuthRequestContext) {
    const session = await this.findActiveSessionByRefreshToken(refreshToken);
    const nextRefreshToken = this.generateRefreshToken();

    session.refreshTokenHash = this.hashRefreshToken(nextRefreshToken);
    session.expiresAt = await this.getRefreshExpiresAt();
    session.lastUsedAt = new Date();
    session.userAgent = context.userAgent || session.userAgent;
    session.ipAddress = context.ipAddress || session.ipAddress;
    await this.sessionRepository.save(session);

    return {
      accessToken: await this.signAccessToken(session.user, session, session.currentRoleCode || undefined),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken)
      return null;

    const session = await this.sessionRepository.findOne({
      where: { refreshTokenHash: this.hashRefreshToken(refreshToken) },
      relations: ['user', 'user.employeeProfile'],
    });
    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
    }
    return session?.user || null;
  }

  async switchCurrentRole(user: User, roleCode: string) {
    if (user.builtIn)
      throw new BadRequestException('超级管理员无需切换角色');

    const role = (user.roles || []).find(item => item.code === roleCode && item.enable);
    if (!role)
      throw new BadRequestException('角色不存在或已停用');

    const sessionId = (user as User & { authSessionId?: number }).authSessionId;
    if (!sessionId)
      throw new UnauthorizedException('登录状态已失效');

    const session = await this.findActiveSessionById(sessionId, user.id);
    session.currentRoleCode = role.code;
    session.lastUsedAt = new Date();
    await this.sessionRepository.save(session);

    return {
      accessToken: await this.signAccessToken(user, session, role.code),
    };
  }

  async changePassword(user: User, dto: ChangePasswordDto) {
    const freshUser = await this.userRepository.findOne({
      where: { id: user.id },
      select: ['id', 'passwordHash'],
    });
    if (!freshUser)
      throw new UnauthorizedException('账号不存在');

    const passwordMatched = await bcrypt.compare(dto.oldPassword, freshUser.passwordHash);
    if (!passwordMatched)
      throw new UnauthorizedException('原密码错误');

    const newPassword = await this.parametersService.validatePasswordLength(dto.newPassword, '新密码');
    freshUser.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(freshUser);
    await this.revokeOtherSessions(user.id, (user as User & { authSessionId?: number }).authSessionId);
    return true;
  }

  async findActiveSessionById(sessionId: number, userId: number) {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ['user', 'user.roles', 'user.employeeProfile'],
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new UnauthorizedException('登录状态已失效');
    return session;
  }

  private async createSession(user: User, context: AuthRequestContext) {
    const refreshToken = this.generateRefreshToken();
    const session = this.sessionRepository.create({
      userId: user.id,
      user,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: await this.getRefreshExpiresAt(),
      lastUsedAt: new Date(),
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });
    const savedSession = await this.sessionRepository.save(session);
    return Object.assign(savedSession, { refreshToken });
  }

  private async findActiveSessionByRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken)
      throw new UnauthorizedException('登录状态已失效');

    const session = await this.sessionRepository.findOne({
      where: { refreshTokenHash: this.hashRefreshToken(refreshToken) },
      relations: ['user', 'user.roles', 'user.employeeProfile'],
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new UnauthorizedException('登录状态已失效');
    if (!session.user || !session.user.enable)
      throw new UnauthorizedException('账号不存在或已停用');
    return session;
  }

  private async revokeOtherSessions(userId: number, keepSessionId?: number) {
    const query = this.sessionRepository
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL');

    if (keepSessionId)
      query.andWhere('id != :keepSessionId', { keepSessionId });

    await query.execute();
  }

  private async issueTokenPair(user: User, session: AuthSession & { refreshToken: string }) {
    return {
      accessToken: await this.signAccessToken(user, session),
      refreshToken: session.refreshToken,
      user,
    };
  }

  private async signAccessToken(user: User, session: AuthSession, roleCode?: string) {
    const defaultRoleCode = user.builtIn
      ? undefined
      : roleCode || session.currentRoleCode || (user.roles || []).find(role => role.enable)?.code;

    const payload: AuthTokenPayload = {
      jti: randomBytes(16).toString('hex'),
      sub: user.id,
      username: user.username,
      sid: session.id,
      roleCode: defaultRoleCode,
    };
    const ttlMinutes = await this.parametersService.getAccessTokenTtlMinutes();
    return this.jwtService.sign(payload, { expiresIn: `${ttlMinutes}m` });
  }

  private generateRefreshToken() {
    return randomBytes(32).toString('hex');
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  async getRefreshTokenMaxAgeMs() {
    const ttlMinutes = await this.parametersService.getRefreshTokenTtlMinutes();
    return ttlMinutes * 60 * 1000;
  }

  private async getRefreshExpiresAt() {
    const ttlMinutes = await this.parametersService.getRefreshTokenTtlMinutes();
    return new Date(Date.now() + ttlMinutes * 60 * 1000);
  }
}
