import { EntityManager } from 'typeorm';
import { Client } from '../../entities/client.entity';
import { DictionaryType } from '../../entities/dictionary-item.entity';
import { EmployeeProfile } from '../../entities/employee-profile.entity';
import { Order } from '../../entities/order.entity';
import { ServiceItem } from '../../entities/service-item.entity';

type DictionaryReferenceChange = {
  dictionaryType: DictionaryType;
  oldCode: string;
  newCode: string;
  oldName: string;
  newName: string;
};

export async function syncDictionaryItemReferences(manager: EntityManager, change: DictionaryReferenceChange) {
  if (change.dictionaryType === 'region') {
    await manager.update(Client, { regionCode: change.oldCode }, {
      regionCode: change.newCode,
      regionName: change.newName,
    });
    await manager.update(Order, { regionCode: change.oldCode }, {
      regionCode: change.newCode,
      regionName: change.newName,
    });
    await manager.update(ServiceItem, { regionCode: change.oldCode }, {
      regionCode: change.newCode,
      regionName: change.newName,
    });
    return;
  }

  await manager.update(EmployeeProfile, { positionCode: change.oldCode }, {
    positionCode: change.newCode,
    positionName: change.newName,
  });
}
