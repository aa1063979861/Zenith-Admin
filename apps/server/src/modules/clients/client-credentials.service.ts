import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientCredential } from '../../entities/client-credential.entity';
import { Client } from '../../entities/client.entity';
import { CredentialAccessLog } from '../../entities/credential-access-log.entity';
import { User } from '../../entities/user.entity';
import { resolveUserDisplayName } from '../operation-logs/operation-logs.service';
import { SystemParametersService } from '../system-parameters/system-parameters.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

@Injectable()
export class ClientCredentialsService {
  constructor(
    @InjectRepository(Client) private readonly clientRepository: Repository<Client>,
    @InjectRepository(ClientCredential) private readonly credentialRepository: Repository<ClientCredential>,
    @InjectRepository(CredentialAccessLog) private readonly credentialAccessLogRepository: Repository<CredentialAccessLog>,
    private readonly parametersService: SystemParametersService,
  ) {}

  credentialSystemOptions() {
    return this.parametersService.getClientCredentialSystemOptions();
  }

  async list(clientId: number, user: User) {
    await this.ensureClientExists(clientId);
    await this.credentialAccessLogRepository.save(this.credentialAccessLogRepository.create({
      clientId,
      userId: user.id,
      username: resolveUserDisplayName(user) || '',
      action: 'VIEW',
      remark: '查看客户账号资料',
    }));
    const rows = await this.credentialRepository.find({ where: { clientId }, order: { id: 'DESC' } });
    return rows.map(row => ({
      ...row,
      updatedAt: row.updateTime,
    }));
  }

  async create(clientId: number, dto: CreateCredentialDto) {
    await this.ensureClientEditable(clientId);
    const systemName = dto.systemName.trim();
    const username = dto.username.trim();
    const password = dto.password.trim();
    if (!systemName)
      throw new BadRequestException('系统名称不能为空');
    if (!username)
      throw new BadRequestException('登录账号不能为空');
    if (!password)
      throw new BadRequestException('登录密码不能为空');
    const exists = await this.credentialRepository.exists({ where: { clientId, systemName, username } });
    if (exists)
      throw new BadRequestException('该客户已存在相同系统账号资料');
    const credential = this.credentialRepository.create({
      clientId,
      systemName,
      username,
      password,
      loginUrl: dto.loginUrl?.trim() || null,
      remark: dto.remark?.trim() || null,
    });
    return this.credentialRepository.save(credential);
  }

  async update(clientId: number, credentialId: number, dto: UpdateCredentialDto, user: User) {
    await this.ensureClientEditable(clientId);
    const credential = await this.credentialRepository.findOne({ where: { id: credentialId, clientId } });
    if (!credential)
      throw new NotFoundException('账号资料不存在');
    const systemName = dto.systemName !== undefined ? dto.systemName.trim() : credential.systemName;
    const username = dto.username !== undefined ? dto.username.trim() : credential.username;
    const password = dto.password !== undefined ? dto.password.trim() : credential.password;
    if (!systemName)
      throw new BadRequestException('系统名称不能为空');
    if (!username)
      throw new BadRequestException('登录账号不能为空');
    if (!password)
      throw new BadRequestException('登录密码不能为空');
    const exists = await this.credentialRepository.exists({ where: { clientId, systemName, username } });
    if (exists && (credential.systemName !== systemName || credential.username !== username))
      throw new BadRequestException('该客户已存在相同系统账号资料');
    credential.systemName = systemName;
    credential.username = username;
    credential.password = password;
    if (dto.loginUrl !== undefined)
      credential.loginUrl = dto.loginUrl.trim() || null;
    if (dto.remark !== undefined)
      credential.remark = dto.remark.trim() || null;
    const saved = await this.credentialRepository.save(credential);
    await this.credentialAccessLogRepository.save(this.credentialAccessLogRepository.create({
      clientId,
      userId: user.id,
      username: resolveUserDisplayName(user) || '',
      action: 'UPDATE',
      remark: `修改客户账号资料：${saved.systemName}`,
    }));
    return saved;
  }

  async remove(clientId: number, credentialId: number, user: User) {
    await this.ensureClientEditable(clientId);
    const credential = await this.credentialRepository.findOne({ where: { id: credentialId, clientId } });
    if (!credential)
      throw new NotFoundException('账号资料不存在');
    await this.credentialRepository.softRemove(credential);
    await this.credentialAccessLogRepository.save(this.credentialAccessLogRepository.create({
      clientId,
      userId: user.id,
      username: resolveUserDisplayName(user) || '',
      action: 'DELETE',
      remark: `删除客户账号资料：${credential.systemName}`,
    }));
    return true;
  }

  async recordCopy(clientId: number, credentialId: number, user: User, field?: string) {
    const credential = await this.credentialRepository.findOne({ where: { id: credentialId, clientId } });
    if (!credential)
      throw new NotFoundException('账号资料不存在');
    const fieldLabel = field === 'username' ? '账号' : field === 'password' ? '密码' : '账号资料';
    await this.credentialAccessLogRepository.save(this.credentialAccessLogRepository.create({
      clientId,
      userId: user.id,
      username: resolveUserDisplayName(user) || '',
      action: 'COPY',
      remark: `复制客户${fieldLabel}：${credential.systemName}`,
    }));
    return true;
  }

  private async ensureClientExists(clientId: number) {
    const exists = await this.clientRepository.exists({ where: { id: clientId } });
    if (!exists)
      throw new NotFoundException('客户不存在');
  }

  private async ensureClientEditable(clientId: number) {
    const client = await this.clientRepository.findOne({ where: { id: clientId } });
    if (!client)
      throw new NotFoundException('客户不存在');
    if (client.mergedToClientId)
      throw new BadRequestException('已合并单位不能修改，请先撤销合并');
  }
}
