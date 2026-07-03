-- 订单/财务闭环重构数据库增量脚本
-- 只新增续签字段和索引，不删除或覆盖历史数据。

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND COLUMN_NAME = 'renewalStatus') = 0,
  'ALTER TABLE service_items ADD COLUMN renewalStatus varchar(40) NOT NULL DEFAULT ''无需续签'' COMMENT ''续签状态：无需续签、未到期、待续签、已续签、不续签、已终止'' AFTER completedAt',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND COLUMN_NAME = 'renewalOfServiceItemId') = 0,
  'ALTER TABLE service_items ADD COLUMN renewalOfServiceItemId int NULL COMMENT ''续签来源服务项ID'' AFTER renewalStatus',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND COLUMN_NAME = 'renewedByServiceItemId') = 0,
  'ALTER TABLE service_items ADD COLUMN renewedByServiceItemId int NULL COMMENT ''已续签生成的服务项ID'' AFTER renewalOfServiceItemId',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND COLUMN_NAME = 'renewalReminderDate') = 0,
  'ALTER TABLE service_items ADD COLUMN renewalReminderDate date NULL COMMENT ''续签提醒日期'' AFTER renewedByServiceItemId',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND COLUMN_NAME = 'renewalRemark') = 0,
  'ALTER TABLE service_items ADD COLUMN renewalRemark varchar(500) NULL COMMENT ''续签备注'' AFTER renewalReminderDate',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND INDEX_NAME = 'IDX_service_items_renewalStatus') = 0,
  'CREATE INDEX IDX_service_items_renewalStatus ON service_items (renewalStatus)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_items' AND INDEX_NAME = 'IDX_service_items_renewalReminderDate') = 0,
  'CREATE INDEX IDX_service_items_renewalReminderDate ON service_items (renewalReminderDate)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
