import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemParameter } from '../../entities/system-parameter.entity';
import { KDOCS_HISTORY_LINKS_KEY, parseKdocsHistoryLinks } from '../system-parameters/system-parameter-registry';

@Injectable()
export class KdocsService {
  constructor(
    @InjectRepository(SystemParameter) private readonly parameterRepository: Repository<SystemParameter>,
  ) {}

  async historyLinks() {
    const parameter = await this.parameterRepository.findOne({
      where: { paramKey: KDOCS_HISTORY_LINKS_KEY, enabled: true },
    });
    if (!parameter)
      return [];

    try {
      return parseKdocsHistoryLinks(parameter.paramValue || '[]');
    }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : `${KDOCS_HISTORY_LINKS_KEY} 配置无效`);
    }
  }
}
