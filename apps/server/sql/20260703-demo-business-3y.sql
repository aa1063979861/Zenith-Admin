-- 三年模拟业务数据
-- 用现有客户、员工、服务目录生成订单、服务项、合同、发票、收款、资料、周报、提成等测试数据。
-- 默认生成 2024-2026 年数据；@sim_client_limit = 0 表示使用全部正常客户。
-- 资料中心会生成 storageKey = mock/... 的模拟 PDF 附件记录。
-- 执行本 SQL 后请运行同目录脚本 20260703-demo-business-3y-mock-files.ps1，
-- 为这些模拟附件生成可预览、可下载的实体占位文件。

SET @schema_name := DATABASE();
SET @sim_prefix := 'SIM3Y';
SET @sim_start_year := 2024;
SET @sim_client_limit := 0;
SET @sim_fallback_service_price := 1800.00;
SET @sim_renewal_warning_days := 30;
SET @sim_admin_user_id := 1;
SET @sim_week_base := DATE('2026-06-29');
SET @sim_order_no_prefix := COALESCE((
  SELECT paramValue
  FROM sys_parameters
  WHERE paramKey = 'order.order_no_prefix'
    AND enabled = 1
    AND deleteTime IS NULL
  LIMIT 1
), 'ZH');
SET @sim_order_date_prefix := CONCAT(@sim_order_no_prefix, DATE_FORMAT(CURDATE(), '%Y%m%d'));
SET @sim_order_serial_base := COALESCE((
  SELECT MAX(CAST(SUBSTRING(orderNo, CHAR_LENGTH(@sim_order_date_prefix) + 1) AS UNSIGNED))
  FROM orders
  WHERE orderNo LIKE CONCAT(@sim_order_date_prefix, '%')
    AND orderNo REGEXP CONCAT('^', @sim_order_date_prefix, '[0-9]{5}$')
), 0);

DROP TEMPORARY TABLE IF EXISTS tmp_sim_guard;
CREATE TEMPORARY TABLE tmp_sim_guard (
  guardValue int NOT NULL
);

SELECT '请先选择数据库后再执行三年模拟数据脚本' AS errorMessage
WHERE @schema_name IS NULL;
INSERT INTO tmp_sim_guard (guardValue)
SELECT NULL
WHERE @schema_name IS NULL;

SET @existing_sim_orders := (
  SELECT COUNT(*)
  FROM orders
  WHERE remark LIKE CONCAT(@sim_prefix, ' 三年模拟订单:%')
);
SELECT '检测到 SIM3Y 模拟订单已存在；如需重跑，请先在测试库清理该前缀数据' AS errorMessage
WHERE @existing_sim_orders > 0;
INSERT INTO tmp_sim_guard (guardValue)
SELECT NULL
WHERE @existing_sim_orders > 0;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_years;
CREATE TEMPORARY TABLE tmp_sim_years (
  yearSeq int NOT NULL PRIMARY KEY,
  serviceYear int NOT NULL
);
INSERT INTO tmp_sim_years (yearSeq, serviceYear)
VALUES
  (1, @sim_start_year),
  (2, @sim_start_year + 1),
  (3, @sim_start_year + 2);

DROP TEMPORARY TABLE IF EXISTS tmp_sim_clients;
CREATE TEMPORARY TABLE tmp_sim_clients AS
SELECT *
FROM (
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.regionCode, c.unitCode, c.id) AS clientSeq,
    c.id AS clientId,
    c.regionCode,
    c.regionName,
    c.unitCode,
    c.unitName,
    c.legalPerson,
    c.financeStaff,
    c.financeManager,
    c.contactPhone
  FROM clients c
  WHERE c.deleteTime IS NULL
    AND c.unitStatus = 'NORMAL'
) ranked_clients
WHERE @sim_client_limit = 0
   OR ranked_clients.clientSeq <= @sim_client_limit;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_employees;
CREATE TEMPORARY TABLE tmp_sim_employees AS
SELECT
  ROW_NUMBER() OVER (ORDER BY u.id) AS employeeSeq,
  u.id AS userId,
  COALESCE(ep.name, u.nickName, u.username) AS employeeName,
  ep.departmentName
FROM sys_users u
JOIN employee_profiles ep
  ON ep.userId = u.id
  AND ep.deleteTime IS NULL
  AND ep.active = 1
WHERE u.deleteTime IS NULL
  AND u.enable = 1
  AND u.userKind = 'EMPLOYEE';

DROP TEMPORARY TABLE IF EXISTS tmp_sim_receivers;
CREATE TEMPORARY TABLE tmp_sim_receivers AS
SELECT *
FROM tmp_sim_employees;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_performers;
CREATE TEMPORARY TABLE tmp_sim_performers AS
SELECT *
FROM tmp_sim_employees;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_services;
CREATE TEMPORARY TABLE tmp_sim_services AS
SELECT
  ROW_NUMBER() OVER (ORDER BY sort, id) AS serviceSeq,
  id AS serviceId,
  code AS serviceCode,
  name AS serviceName,
  defaultPrice,
  minMonths,
  reminderEnabled
FROM service_catalog
WHERE deleteTime IS NULL
  AND enabled = 1;

SET @client_count := (SELECT COUNT(*) FROM tmp_sim_clients);
SET @employee_count := (SELECT COUNT(*) FROM tmp_sim_employees);
SET @service_count := (SELECT COUNT(*) FROM tmp_sim_services);
SELECT '缺少正常客户、在职员工或启用服务目录，无法生成模拟业务数据' AS errorMessage
WHERE @client_count = 0 OR @employee_count = 0 OR @service_count = 0;
INSERT INTO tmp_sim_guard (guardValue)
SELECT NULL
WHERE @client_count = 0 OR @employee_count = 0 OR @service_count = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_order_base;
CREATE TEMPORARY TABLE tmp_sim_order_base AS
SELECT
  seed.orderSeq,
  seed.clientSeq,
  seed.clientId,
  seed.regionCode,
  seed.regionName,
  seed.unitCode,
  seed.unitName,
  seed.yearSeq,
  seed.serviceYear,
  CAST(CONCAT(@sim_order_date_prefix, LPAD(CAST(@sim_order_serial_base + seed.orderSeq AS UNSIGNED), 5, '0')) AS CHAR(40)) AS orderNo,
  seed.orderDate
FROM (
  SELECT
    ROW_NUMBER() OVER (ORDER BY y.serviceYear, c.regionCode, c.unitCode, c.clientId) AS orderSeq,
    c.clientSeq,
    c.clientId,
    c.regionCode,
    c.regionName,
    c.unitCode,
    c.unitName,
    y.yearSeq,
    y.serviceYear,
    DATE_ADD(
      STR_TO_DATE(CONCAT(y.serviceYear, '-01-01'), '%Y-%m-%d'),
      INTERVAL MOD(c.clientSeq * 7 + y.yearSeq * 17, 90) DAY
    ) AS orderDate
  FROM tmp_sim_clients c
  CROSS JOIN tmp_sim_years y
) seed;

SET @sim_max_order_serial := (
  SELECT MAX(@sim_order_serial_base + orderSeq)
  FROM tmp_sim_order_base
);
SELECT '按当前订单号规则生成的流水号会超过 99999，请缩小 @sim_client_limit 或换一天导入' AS errorMessage
WHERE @sim_max_order_serial > 99999;
INSERT INTO tmp_sim_guard (guardValue)
SELECT NULL
WHERE @sim_max_order_serial > 99999;

ALTER TABLE tmp_sim_order_base
  ADD PRIMARY KEY (orderNo),
  ADD COLUMN orderId int NOT NULL DEFAULT 0,
  ADD COLUMN billableAmount decimal(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN packageAmount decimal(12, 2) NOT NULL DEFAULT 0.00;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_service_seed;
CREATE TEMPORARY TABLE tmp_sim_service_seed AS
SELECT
  seed.clientSeq,
  seed.clientId,
  seed.regionCode,
  seed.regionName,
  seed.unitCode,
  seed.unitName,
  seed.yearSeq,
  seed.serviceYear,
  seed.orderNo,
  seed.orderDate,
  0 AS orderId,
  0 AS serviceItemId,
  seed.serviceSeq,
  seed.serviceCode,
  seed.serviceName,
  seed.minMonths,
  seed.reminderEnabled,
  seed.receiverId,
  seed.receiverName,
  seed.performerId,
  seed.performerName,
  seed.billableAmount,
  seed.billableAmount AS allocatedAmount,
  seed.status,
  DATE_ADD(seed.orderDate, INTERVAL 5 DAY) AS serviceStartDate,
  CASE
    WHEN seed.minMonths > 0 THEN DATE_SUB(DATE_ADD(DATE_ADD(seed.orderDate, INTERVAL 5 DAY), INTERVAL seed.minMonths MONTH), INTERVAL 1 DAY)
    ELSE DATE_ADD(seed.orderDate, INTERVAL (60 + MOD(seed.clientSeq + seed.serviceSeq + seed.yearSeq, 150)) DAY)
  END AS serviceEndDate,
  CASE
    WHEN seed.status = '已完成' THEN DATE_ADD(seed.orderDate, INTERVAL (35 + MOD(seed.clientSeq + seed.serviceSeq, 45)) DAY)
    ELSE NULL
  END AS completedAt,
  CASE
    WHEN seed.reminderEnabled = 1 THEN '未到期'
    ELSE '无需续签'
  END AS renewalStatus,
  CASE
    WHEN seed.reminderEnabled = 1 THEN DATE_SUB(
      CASE
        WHEN seed.minMonths > 0 THEN DATE_SUB(DATE_ADD(DATE_ADD(seed.orderDate, INTERVAL 5 DAY), INTERVAL seed.minMonths MONTH), INTERVAL 1 DAY)
        ELSE DATE_ADD(seed.orderDate, INTERVAL (60 + MOD(seed.clientSeq + seed.serviceSeq + seed.yearSeq, 150)) DAY)
      END,
      INTERVAL @sim_renewal_warning_days DAY
    )
    ELSE NULL
  END AS renewalReminderDate
FROM (
  SELECT
    o.clientSeq,
    o.clientId,
    o.regionCode,
    o.regionName,
    o.unitCode,
    o.unitName,
    o.yearSeq,
    o.serviceYear,
    o.orderNo,
    o.orderDate,
    s.serviceSeq,
    s.serviceCode,
    s.serviceName,
    s.minMonths,
    s.reminderEnabled,
    receiver.userId AS receiverId,
    receiver.employeeName AS receiverName,
    performer.userId AS performerId,
    performer.employeeName AS performerName,
    CAST(
      CASE
        WHEN s.defaultPrice > 0 THEN s.defaultPrice
        ELSE @sim_fallback_service_price + MOD(o.clientSeq + o.serviceYear + s.serviceSeq, 5) * 200
      END
      AS DECIMAL(12, 2)
    ) AS billableAmount,
    CASE
      WHEN MOD(o.clientSeq + s.serviceSeq + o.yearSeq, 53) = 0 THEN '已取消'
      WHEN o.serviceYear = @sim_start_year THEN '已完成'
      WHEN o.serviceYear = @sim_start_year + 1 AND MOD(o.clientSeq + s.serviceSeq, 5) IN (0, 1) THEN '已完成'
      WHEN o.serviceYear = @sim_start_year + 1 AND MOD(o.clientSeq + s.serviceSeq, 5) = 2 THEN '待确认'
      WHEN o.serviceYear = @sim_start_year + 2 AND MOD(o.clientSeq + s.serviceSeq, 7) = 0 THEN '待客户资料'
      WHEN o.serviceYear = @sim_start_year + 2 AND MOD(o.clientSeq + s.serviceSeq, 7) = 1 THEN '待开始'
      ELSE '进行中'
    END AS status
  FROM tmp_sim_order_base o
  CROSS JOIN tmp_sim_services s
  JOIN tmp_sim_receivers receiver
    ON receiver.employeeSeq = MOD(o.clientSeq + s.serviceSeq, @employee_count) + 1
  JOIN tmp_sim_performers performer
    ON performer.employeeSeq = MOD(o.clientSeq + s.serviceSeq + o.yearSeq + 2, @employee_count) + 1
) seed;

ALTER TABLE tmp_sim_service_seed
  ADD INDEX idx_tmp_service_order (orderNo),
  ADD INDEX idx_tmp_service_item (serviceItemId),
  ADD INDEX idx_tmp_service_client_year (clientId, serviceYear);

UPDATE tmp_sim_order_base o
JOIN (
  SELECT
    orderNo,
    SUM(billableAmount) AS billableAmount,
    SUM(allocatedAmount) AS packageAmount
  FROM tmp_sim_service_seed
  GROUP BY orderNo
) amount
  ON amount.orderNo = o.orderNo
SET
  o.billableAmount = amount.billableAmount,
  o.packageAmount = amount.packageAmount;

START TRANSACTION;

INSERT INTO client_contacts (
  createTime,
  updateTime,
  clientId,
  role,
  name,
  department,
  phone,
  isPrimary,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  client.clientId,
  role_seed.role,
  CASE role_seed.role
    WHEN 'LEGAL_PERSON' THEN client.legalPerson
    WHEN 'FINANCE' THEN client.financeStaff
    ELSE client.financeManager
  END,
  role_seed.department,
  client.contactPhone,
  role_seed.isPrimary,
  'SIM3Y 模拟联系人'
FROM tmp_sim_clients client
JOIN (
  SELECT 'LEGAL_PERSON' AS role, '办公室' AS department, 1 AS isPrimary
  UNION ALL
  SELECT 'FINANCE', '财务科', 0
  UNION ALL
  SELECT 'UNIT_MANAGER', '单位负责人', 0
) role_seed
WHERE CASE role_seed.role
    WHEN 'LEGAL_PERSON' THEN client.legalPerson
    WHEN 'FINANCE' THEN client.financeStaff
    ELSE client.financeManager
  END IS NOT NULL
  AND TRIM(CASE role_seed.role
    WHEN 'LEGAL_PERSON' THEN client.legalPerson
    WHEN 'FINANCE' THEN client.financeStaff
    ELSE client.financeManager
  END) <> '';

INSERT INTO client_credentials (
  createTime,
  updateTime,
  clientId,
  systemName,
  username,
  `password`,
  loginUrl,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  clientId,
  systemName,
  CONCAT(LOWER(regionCode), '_', unitCode, '_', suffix),
  'Demo@2026',
  loginUrl,
  'SIM3Y 模拟账号资料'
FROM tmp_sim_clients client
JOIN (
  SELECT '资产系统' AS systemName, 'asset' AS suffix, 'https://demo.local/asset' AS loginUrl
  UNION ALL
  SELECT '预算一体化平台', 'budget', 'https://demo.local/budget'
) credentials;

INSERT INTO orders (
  createTime,
  updateTime,
  orderNo,
  clientId,
  regionCode,
  regionName,
  unitCode,
  unitName,
  serviceYear,
  packageAmount,
  billableAmount,
  orderDate,
  status,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  orderNo,
  clientId,
  regionCode,
  regionName,
  unitCode,
  unitName,
  serviceYear,
  packageAmount,
  billableAmount,
  orderDate,
  '履约中',
  CONCAT('SIM3Y 三年模拟订单：', serviceYear)
FROM tmp_sim_order_base;

UPDATE tmp_sim_order_base o
JOIN orders real_order
  ON real_order.orderNo = o.orderNo
SET o.orderId = real_order.id;

UPDATE tmp_sim_service_seed seed
JOIN tmp_sim_order_base o
  ON o.orderNo = seed.orderNo
SET seed.orderId = o.orderId;

INSERT INTO service_items (
  createTime,
  updateTime,
  orderId,
  clientId,
  orderNo,
  regionCode,
  regionName,
  unitCode,
  unitName,
  serviceCode,
  serviceName,
  serviceYear,
  receiverId,
  receiverName,
  performerId,
  performerName,
  allocatedAmount,
  billableAmount,
  receivedAmount,
  status,
  statusUpdatedAt,
  serviceStartDate,
  serviceEndDate,
  completedAt,
  renewalStatus,
  renewalReminderDate,
  reportSummary,
  problemDescription,
  proofUrl,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  orderId,
  clientId,
  orderNo,
  regionCode,
  regionName,
  unitCode,
  unitName,
  serviceCode,
  serviceName,
  serviceYear,
  receiverId,
  receiverName,
  performerId,
  performerName,
  allocatedAmount,
  billableAmount,
  0.00,
  status,
  NOW(),
  serviceStartDate,
  serviceEndDate,
  completedAt,
  renewalStatus,
  renewalReminderDate,
  CASE
    WHEN status IN ('已完成', '待确认') THEN CONCAT(serviceName, '资料已整理，上报进度模拟完成。')
    ELSE CONCAT(serviceName, '正在按计划推进。')
  END,
  CASE
    WHEN status = '待客户资料' THEN '等待单位补充盖章资料和经办人确认。'
    ELSE NULL
  END,
  CASE
    WHEN status = '已完成' THEN CONCAT('/mock/proof/', orderNo, '/', serviceCode, '.pdf')
    ELSE NULL
  END,
  CONCAT('SIM3Y 模拟服务项：', serviceYear)
FROM tmp_sim_service_seed;

UPDATE tmp_sim_service_seed seed
JOIN service_items item
  ON item.orderNo = seed.orderNo
  AND item.serviceCode = seed.serviceCode
  AND item.deleteTime IS NULL
SET seed.serviceItemId = item.id;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_service_seed_source;
CREATE TEMPORARY TABLE tmp_sim_service_seed_source AS
SELECT *
FROM tmp_sim_service_seed;
ALTER TABLE tmp_sim_service_seed_source
  ADD INDEX idx_tmp_service_source_item (serviceItemId),
  ADD INDEX idx_tmp_service_source_renewal (clientId, serviceCode, serviceYear);

DROP TEMPORARY TABLE IF EXISTS tmp_sim_service_seed_next;
CREATE TEMPORARY TABLE tmp_sim_service_seed_next AS
SELECT *
FROM tmp_sim_service_seed;
ALTER TABLE tmp_sim_service_seed_next
  ADD INDEX idx_tmp_service_next_item (serviceItemId),
  ADD INDEX idx_tmp_service_next_renewal (clientId, serviceCode, serviceYear);

UPDATE service_items source_item
JOIN tmp_sim_service_seed_source source_seed
  ON source_seed.serviceItemId = source_item.id
JOIN tmp_sim_service_seed_next next_seed
  ON next_seed.clientId = source_seed.clientId
  AND next_seed.serviceCode = source_seed.serviceCode
  AND next_seed.serviceYear = source_seed.serviceYear + 1
  AND next_seed.reminderEnabled = 1
  AND MOD(source_seed.clientSeq, 17) <> 0
SET
  source_item.renewedByServiceItemId = next_seed.serviceItemId,
  source_item.renewalStatus = '已续签',
  source_item.renewalRemark = CONCAT('SIM3Y 已续签到 ', next_seed.serviceYear, ' 年服务项');

UPDATE service_items next_item
JOIN tmp_sim_service_seed_next next_seed
  ON next_seed.serviceItemId = next_item.id
JOIN tmp_sim_service_seed_source source_seed
  ON source_seed.clientId = next_seed.clientId
  AND source_seed.serviceCode = next_seed.serviceCode
  AND source_seed.serviceYear = next_seed.serviceYear - 1
  AND source_seed.reminderEnabled = 1
  AND MOD(source_seed.clientSeq, 17) <> 0
SET
  next_item.renewalOfServiceItemId = source_seed.serviceItemId;

UPDATE service_items item
JOIN tmp_sim_service_seed seed
  ON seed.serviceItemId = item.id
SET
  item.renewalStatus = '待续签',
  item.renewalRemark = 'SIM3Y 保留未续签样本，用于到期提醒测试'
WHERE seed.reminderEnabled = 1
  AND seed.serviceYear = @sim_start_year + 1
  AND MOD(seed.clientSeq, 17) = 0;

UPDATE orders o
JOIN (
  SELECT
    orderId,
    SUM(status = '已取消') AS cancelledCount,
    SUM(status = '已完成') AS doneCount,
    SUM(status IN ('已完成', '待确认')) AS progressedCount,
    SUM(status IN ('待分配', '待开始')) AS waitingCount,
    COUNT(*) AS totalCount,
    MAX(completedAt) AS lastCompletedAt
  FROM service_items
  WHERE remark LIKE CONCAT(@sim_prefix, ' 模拟服务项%')
    AND deleteTime IS NULL
  GROUP BY orderId
) status_scope
  ON status_scope.orderId = o.id
SET
  o.status = CASE
    WHEN status_scope.cancelledCount = status_scope.totalCount THEN '已取消'
    WHEN status_scope.doneCount > 0 AND status_scope.doneCount + status_scope.cancelledCount = status_scope.totalCount THEN '已完成'
    WHEN status_scope.progressedCount > 0 THEN '部分完成'
    WHEN status_scope.waitingCount = status_scope.totalCount THEN '已确认'
    ELSE '履约中'
  END,
  o.completedAt = CASE
    WHEN status_scope.doneCount > 0 AND status_scope.doneCount + status_scope.cancelledCount = status_scope.totalCount THEN status_scope.lastCompletedAt
    ELSE NULL
  END,
  o.canceledAt = CASE
    WHEN status_scope.cancelledCount = status_scope.totalCount THEN NOW()
    ELSE NULL
  END,
  o.cancelReason = CASE
    WHEN status_scope.cancelledCount = status_scope.totalCount THEN 'SIM3Y 模拟取消'
    ELSE NULL
  END
WHERE o.remark LIKE CONCAT(@sim_prefix, ' 三年模拟订单:%');

DROP TEMPORARY TABLE IF EXISTS tmp_sim_contract_seed;
CREATE TEMPORARY TABLE tmp_sim_contract_seed AS
SELECT
  o.*,
  0 AS contractId,
  CAST(CONCAT(@sim_prefix, '-HT-', o.serviceYear, '-', LPAD(o.clientId, 6, '0')) AS CHAR(80)) AS contractNo,
  CASE
    WHEN MOD(o.clientSeq + o.yearSeq, 37) = 0 THEN '已作废'
    WHEN MOD(o.clientSeq + o.yearSeq, 19) = 0 THEN '草稿'
    ELSE '已签订'
  END AS contractStatus
FROM tmp_sim_order_base o
WHERE o.billableAmount > 0
  AND MOD(o.clientSeq + o.yearSeq, 11) <> 0;

ALTER TABLE tmp_sim_contract_seed
  ADD PRIMARY KEY (contractNo),
  ADD INDEX idx_tmp_contract_order (orderId);

INSERT INTO finance_contracts (
  createTime,
  updateTime,
  contractNo,
  clientId,
  clientName,
  title,
  totalAmount,
  signedAt,
  startsAt,
  endsAt,
  status,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  contractNo,
  clientId,
  unitName,
  CONCAT(serviceYear, ' 年 ', unitName, ' 综合服务合同'),
  billableAmount,
  DATE_ADD(orderDate, INTERVAL 3 DAY),
  STR_TO_DATE(CONCAT(serviceYear, '-01-01'), '%Y-%m-%d'),
  STR_TO_DATE(CONCAT(serviceYear, '-12-31'), '%Y-%m-%d'),
  contractStatus,
  CONCAT('SIM3Y 模拟合同：', contractStatus)
FROM tmp_sim_contract_seed;

UPDATE tmp_sim_contract_seed seed
JOIN finance_contracts contract
  ON contract.contractNo = seed.contractNo
SET seed.contractId = contract.id;

INSERT INTO finance_contract_lines (
  createTime,
  updateTime,
  contractId,
  order_service_item_id,
  amount,
  description
)
SELECT
  NOW(6),
  NOW(6),
  contract.contractId,
  service.serviceItemId,
  service.billableAmount,
  CONCAT(service.serviceYear, ' ', service.serviceName)
FROM tmp_sim_contract_seed contract
JOIN tmp_sim_service_seed service
  ON service.orderId = contract.orderId
WHERE service.billableAmount > 0;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_invoice_seed;
CREATE TEMPORARY TABLE tmp_sim_invoice_seed AS
SELECT
  contract.*,
  0 AS invoiceId,
  CAST(CONCAT(@sim_prefix, '-FP-', serviceYear, '-', LPAD(clientId, 6, '0')) AS CHAR(80)) AS invoiceNo,
  CASE
    WHEN MOD(clientSeq + yearSeq, 41) = 0 THEN '已作废'
    ELSE '已开具'
  END AS invoiceStatus,
  CASE MOD(clientSeq + yearSeq, 3)
    WHEN 0 THEN '未送达'
    WHEN 1 THEN '已送达'
    ELSE '单位已确认'
  END AS deliveryStatus,
  MOD(clientSeq + yearSeq, 6) AS paymentScenario
FROM tmp_sim_contract_seed contract
WHERE contract.contractStatus = '已签订'
  AND MOD(contract.clientSeq + contract.yearSeq, 13) <> 0;

ALTER TABLE tmp_sim_invoice_seed
  ADD PRIMARY KEY (invoiceNo),
  ADD INDEX idx_tmp_invoice_contract (contractId),
  ADD INDEX idx_tmp_invoice_id (invoiceId);

INSERT INTO finance_invoices (
  createTime,
  updateTime,
  invoiceNo,
  clientId,
  contractId,
  clientName,
  buyerName,
  invoiceDate,
  invoiceAmount,
  matchedAmount,
  deliveryStatus,
  paymentStatus,
  status,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  invoiceNo,
  clientId,
  contractId,
  unitName,
  unitName,
  DATE_ADD(orderDate, INTERVAL 20 DAY),
  billableAmount,
  0.00,
  deliveryStatus,
  '待收款',
  invoiceStatus,
  CONCAT('SIM3Y 模拟发票：', invoiceStatus)
FROM tmp_sim_invoice_seed;

UPDATE tmp_sim_invoice_seed seed
JOIN finance_invoices invoice
  ON invoice.invoiceNo = seed.invoiceNo
SET seed.invoiceId = invoice.id;

INSERT INTO finance_invoice_lines (
  createTime,
  updateTime,
  invoiceId,
  order_service_item_id,
  amount,
  description
)
SELECT
  NOW(6),
  NOW(6),
  invoice.invoiceId,
  service.serviceItemId,
  service.billableAmount,
  CONCAT(service.serviceYear, ' ', service.serviceName)
FROM tmp_sim_invoice_seed invoice
JOIN tmp_sim_service_seed service
  ON service.orderId = invoice.orderId
WHERE service.billableAmount > 0;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_payment_seed;
CREATE TEMPORARY TABLE tmp_sim_payment_seed AS
SELECT
  invoice.*,
  0 AS paymentId,
  CAST(CONCAT(@sim_prefix, '-BANK-', invoice.serviceYear, '-', LPAD(invoice.clientId, 6, '0')) AS CHAR(120)) AS bankSerialNo,
  CAST(
    CASE
      WHEN invoice.paymentScenario = 1 THEN invoice.billableAmount * 0.50
      WHEN invoice.paymentScenario = 2 THEN invoice.billableAmount * 0.80
      ELSE invoice.billableAmount
    END
    AS DECIMAL(12, 2)
  ) AS paymentAmount,
  CAST(
    CASE
      WHEN invoice.paymentScenario = 2 THEN invoice.billableAmount * 0.50
      ELSE CASE
        WHEN invoice.paymentScenario = 1 THEN invoice.billableAmount * 0.50
        ELSE invoice.billableAmount
      END
    END
    AS DECIMAL(12, 2)
  ) AS paymentMatchedAmount
FROM tmp_sim_invoice_seed invoice
WHERE invoice.invoiceStatus = '已开具'
  AND invoice.paymentScenario <> 0;

ALTER TABLE tmp_sim_payment_seed
  ADD PRIMARY KEY (bankSerialNo),
  ADD INDEX idx_tmp_payment_invoice (invoiceId),
  ADD INDEX idx_tmp_payment_id (paymentId);

INSERT INTO finance_payments (
  createTime,
  updateTime,
  paymentDate,
  clientId,
  clientName,
  payerName,
  bankRemark,
  bankAccount,
  bankSerialNo,
  amount,
  matchedAmount,
  matchStatus,
  matchedInvoiceId,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  DATE_ADD(orderDate, INTERVAL 32 DAY),
  clientId,
  unitName,
  unitName,
  CONCAT(serviceYear, ' 年服务费回款'),
  '中国工商银行达州分行 6222****8888',
  bankSerialNo,
  paymentAmount,
  paymentMatchedAmount,
  CASE
    WHEN paymentMatchedAmount <= 0 THEN '待匹配'
    WHEN paymentMatchedAmount < paymentAmount THEN '部分匹配'
    ELSE '已匹配'
  END,
  CASE WHEN paymentMatchedAmount > 0 THEN invoiceId ELSE NULL END,
  'SIM3Y 模拟银行流水'
FROM tmp_sim_payment_seed;

UPDATE tmp_sim_payment_seed seed
JOIN finance_payments payment
  ON payment.bankSerialNo = seed.bankSerialNo
SET seed.paymentId = payment.id;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_unmatched_payments;
CREATE TEMPORARY TABLE tmp_sim_unmatched_payments AS
SELECT
  o.*,
  CAST(CONCAT(@sim_prefix, '-UNMATCHED-', o.serviceYear, '-', LPAD(o.clientId, 6, '0')) AS CHAR(120)) AS bankSerialNo,
  CAST(500 + MOD(o.clientSeq + o.yearSeq, 8) * 300 AS DECIMAL(12, 2)) AS amount
FROM tmp_sim_order_base o
WHERE MOD(o.clientSeq + o.yearSeq, 23) = 0;

INSERT INTO finance_payments (
  createTime,
  updateTime,
  paymentDate,
  clientId,
  clientName,
  payerName,
  bankRemark,
  bankAccount,
  bankSerialNo,
  amount,
  matchedAmount,
  matchStatus,
  matchedInvoiceId,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  DATE_ADD(orderDate, INTERVAL 45 DAY),
  clientId,
  unitName,
  unitName,
  '待核对用途的银行流水',
  '中国建设银行达州分行 6227****6666',
  bankSerialNo,
  amount,
  0.00,
  '待匹配',
  NULL,
  'SIM3Y 未匹配流水样本'
FROM tmp_sim_unmatched_payments;

DROP TEMPORARY TABLE IF EXISTS tmp_sim_payment_import_seed;
CREATE TEMPORARY TABLE tmp_sim_payment_import_seed AS
SELECT
  y.serviceYear,
  0 AS batchId,
  CAST(CONCAT(@sim_prefix, '-bank-', y.serviceYear, '.xlsx') AS CHAR(255)) AS sourceFileName,
  COUNT(p.id) AS totalRows
FROM tmp_sim_years y
JOIN finance_payments p
  ON p.bankSerialNo LIKE CONCAT(@sim_prefix, '-%', y.serviceYear, '-%')
GROUP BY y.serviceYear;

ALTER TABLE tmp_sim_payment_import_seed ADD PRIMARY KEY (sourceFileName);

INSERT INTO finance_payment_imports (
  createTime,
  updateTime,
  sourceFileName,
  importedBy,
  importedByName,
  importedAt,
  status,
  totalRows,
  validRows,
  warningRows,
  errorRows,
  importedRows,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  sourceFileName,
  @sim_admin_user_id,
  '超级管理员',
  NOW(),
  'confirmed',
  totalRows,
  totalRows,
  0,
  0,
  totalRows,
  'SIM3Y 模拟银行流水导入批次'
FROM tmp_sim_payment_import_seed;

UPDATE tmp_sim_payment_import_seed seed
JOIN finance_payment_imports batch
  ON batch.sourceFileName = seed.sourceFileName
SET seed.batchId = batch.id;

INSERT INTO finance_payment_import_rows (
  createTime,
  updateTime,
  batchId,
  sheetName,
  rowNo,
  rawJson,
  normalizedJson,
  validationStatus,
  validationMessage,
  clientId,
  paymentId
)
SELECT
  NOW(6),
  NOW(6),
  batch.batchId,
  '银行流水',
  ROW_NUMBER() OVER (PARTITION BY batch.batchId ORDER BY payment.paymentDate, payment.id) + 1,
  JSON_OBJECT('交易日期', payment.paymentDate, '付款方', payment.payerName, '金额', payment.amount, '流水号', payment.bankSerialNo),
  JSON_OBJECT('paymentDate', payment.paymentDate, 'payerName', payment.payerName, 'amount', payment.amount, 'bankSerialNo', payment.bankSerialNo),
  'imported',
  'SIM3Y 已生成收款',
  payment.clientId,
  payment.id
FROM finance_payments payment
JOIN tmp_sim_payment_import_seed batch
  ON payment.bankSerialNo LIKE CONCAT(@sim_prefix, '-%', batch.serviceYear, '-%')
WHERE payment.bankSerialNo LIKE CONCAT(@sim_prefix, '-%');

DROP TEMPORARY TABLE IF EXISTS tmp_sim_payment_match_seed;
CREATE TEMPORARY TABLE tmp_sim_payment_match_seed AS
SELECT
  payment.paymentId,
  payment.invoiceId,
  payment.paymentMatchedAmount AS matchedAmount,
  0 AS matchId,
  payment.clientSeq,
  payment.yearSeq
FROM tmp_sim_payment_seed payment
WHERE payment.paymentMatchedAmount > 0;

ALTER TABLE tmp_sim_payment_match_seed
  ADD INDEX idx_tmp_match_payment (paymentId),
  ADD INDEX idx_tmp_match_invoice (invoiceId),
  ADD INDEX idx_tmp_match_id (matchId);

INSERT INTO payment_invoice_matches (
  createTime,
  updateTime,
  paymentId,
  invoiceId,
  matchedAmount,
  matchedBy,
  matchedAt,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  seed.paymentId,
  seed.invoiceId,
  seed.matchedAmount,
  employee.userId,
  NOW(),
  'SIM3Y 自动匹配发票'
FROM tmp_sim_payment_match_seed seed
JOIN tmp_sim_employees employee
  ON employee.employeeSeq = MOD(seed.clientSeq + seed.yearSeq, @employee_count) + 1;

UPDATE tmp_sim_payment_match_seed seed
JOIN payment_invoice_matches real_match
  ON real_match.paymentId = seed.paymentId
  AND real_match.invoiceId = seed.invoiceId
  AND real_match.deleteTime IS NULL
SET seed.matchId = real_match.id;

INSERT INTO payment_service_allocations (
  createTime,
  updateTime,
  paymentInvoiceMatchId,
  invoiceLineId,
  order_service_item_id,
  allocatedAmount
)
SELECT
  NOW(6),
  NOW(6),
  match_seed.matchId,
  invoice_line.id,
  invoice_line.order_service_item_id,
  CAST(match_seed.matchedAmount * invoice_line.amount / invoice.invoiceAmount AS DECIMAL(12, 2))
FROM tmp_sim_payment_match_seed match_seed
JOIN finance_invoices invoice
  ON invoice.id = match_seed.invoiceId
JOIN finance_invoice_lines invoice_line
  ON invoice_line.invoiceId = invoice.id
WHERE invoice.invoiceAmount > 0;

UPDATE finance_invoices invoice
LEFT JOIN (
  SELECT
    invoiceId,
    SUM(matchedAmount) AS matchedAmount
  FROM payment_invoice_matches
  WHERE deleteTime IS NULL
  GROUP BY invoiceId
) matched
  ON matched.invoiceId = invoice.id
SET
  invoice.matchedAmount = COALESCE(matched.matchedAmount, 0.00),
  invoice.paymentStatus = CASE
    WHEN COALESCE(matched.matchedAmount, 0.00) <= 0 THEN '待收款'
    WHEN COALESCE(matched.matchedAmount, 0.00) < invoice.invoiceAmount THEN '部分收款'
    ELSE '已收齐'
  END
WHERE invoice.invoiceNo LIKE CONCAT(@sim_prefix, '-%')
  AND invoice.status = '已开具';

UPDATE finance_payments payment
LEFT JOIN (
  SELECT
    paymentId,
    SUM(matchedAmount) AS matchedAmount,
    MIN(invoiceId) AS matchedInvoiceId
  FROM payment_invoice_matches
  WHERE deleteTime IS NULL
  GROUP BY paymentId
) matched
  ON matched.paymentId = payment.id
SET
  payment.matchedAmount = COALESCE(matched.matchedAmount, 0.00),
  payment.matchStatus = CASE
    WHEN COALESCE(matched.matchedAmount, 0.00) <= 0 THEN '待匹配'
    WHEN COALESCE(matched.matchedAmount, 0.00) < payment.amount THEN '部分匹配'
    ELSE '已匹配'
  END,
  payment.matchedInvoiceId = matched.matchedInvoiceId
WHERE payment.bankSerialNo LIKE CONCAT(@sim_prefix, '-%');

UPDATE service_items item
LEFT JOIN (
  SELECT
    order_service_item_id,
    SUM(allocatedAmount) AS receivedAmount
  FROM payment_service_allocations
  WHERE deleteTime IS NULL
  GROUP BY order_service_item_id
) allocation
  ON allocation.order_service_item_id = item.id
SET item.receivedAmount = COALESCE(allocation.receivedAmount, 0.00)
WHERE item.remark LIKE CONCAT(@sim_prefix, ' 模拟服务项%');

DROP TEMPORARY TABLE IF EXISTS tmp_sim_archive_seed;
CREATE TEMPORARY TABLE tmp_sim_archive_seed AS
SELECT
  seed.serviceItemId,
  seed.clientId,
  seed.unitName,
  seed.serviceYear,
  seed.orderNo,
  seed.serviceName,
  0 AS attachmentId,
  CAST(CONCAT(@sim_prefix, '-', seed.orderNo, '-', seed.serviceCode, '-proof.pdf') AS CHAR(255)) AS fileName,
  CASE
    WHEN seed.serviceName LIKE '%合同%' THEN '合同'
    WHEN seed.serviceName LIKE '%财报%' THEN '报告'
    ELSE '上报证明'
  END AS tag
FROM tmp_sim_service_seed seed
WHERE seed.status = '已完成'
  AND MOD(seed.clientSeq + seed.serviceSeq + seed.yearSeq, 8) = 0;

ALTER TABLE tmp_sim_archive_seed
  ADD PRIMARY KEY (fileName),
  ADD INDEX idx_tmp_archive_item (serviceItemId);

INSERT INTO archive_attachments (
  createTime,
  updateTime,
  name,
  originalName,
  tag,
  fileKind,
  clientId,
  linkedName,
  linkedType,
  linkedId,
  fileUrl,
  storageKey,
  fileExt,
  mimeType,
  sizeBytes,
  sha256,
  uploadedById,
  uploadedByName,
  uploadedAt,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  fileName,
  fileName,
  tag,
  '文档',
  clientId,
  CONCAT(orderNo, ' ', serviceName),
  '服务项',
  serviceItemId,
  CONCAT('/uploads/mock/', fileName),
  CONCAT('mock/', fileName),
  '.pdf',
  'application/pdf',
  102400 + MOD(serviceItemId, 4096),
  SHA2(fileName, 256),
  @sim_admin_user_id,
  '超级管理员',
  NOW(),
  'SIM3Y 模拟归档附件'
FROM tmp_sim_archive_seed;

UPDATE tmp_sim_archive_seed seed
JOIN archive_attachments attachment
  ON attachment.name = seed.fileName
SET seed.attachmentId = attachment.id;

INSERT INTO archive_attachment_links (
  createTime,
  updateTime,
  attachmentId,
  entityType,
  entityId,
  entityName,
  clientId,
  clientName,
  serviceYear,
  tag,
  remark
)
SELECT
  NOW(6),
  NOW(6),
  attachmentId,
  '服务项',
  serviceItemId,
  CONCAT(orderNo, ' ', serviceName),
  clientId,
  unitName,
  serviceYear,
  tag,
  'SIM3Y 模拟服务项归档'
FROM tmp_sim_archive_seed
WHERE attachmentId > 0;

INSERT INTO archive_attachments (
  createTime,
  updateTime,
  name,
  originalName,
  tag,
  fileKind,
  clientId,
  linkedName,
  linkedType,
  linkedId,
  fileUrl,
  storageKey,
  fileExt,
  mimeType,
  sizeBytes,
  sha256,
  uploadedById,
  uploadedByName,
  uploadedAt,
  remark
)
VALUES
  (NOW(6), NOW(6), 'SIM3Y-业务操作手册.pdf', 'SIM3Y-业务操作手册.pdf', '其他', '文档', NULL, NULL, NULL, NULL, '/uploads/mock/SIM3Y-业务操作手册.pdf', 'mock/SIM3Y-业务操作手册.pdf', '.pdf', 'application/pdf', 204800, SHA2('SIM3Y-业务操作手册.pdf', 256), @sim_admin_user_id, '超级管理员', NOW(), 'SIM3Y 模拟资料'),
  (NOW(6), NOW(6), 'SIM3Y-财务核对说明.pdf', 'SIM3Y-财务核对说明.pdf', '银行流水', '文档', NULL, NULL, NULL, NULL, '/uploads/mock/SIM3Y-财务核对说明.pdf', 'mock/SIM3Y-财务核对说明.pdf', '.pdf', 'application/pdf', 196608, SHA2('SIM3Y-财务核对说明.pdf', 256), @sim_admin_user_id, '超级管理员', NOW(), 'SIM3Y 模拟资料');

INSERT INTO archive_materials (
  createTime,
  updateTime,
  attachmentId,
  title,
  category,
  documentType,
  version,
  status,
  pinned,
  effectiveDate,
  expiredDate,
  publishedAt,
  publishedById,
  publishedByName,
  description
)
SELECT
  NOW(6),
  NOW(6),
  attachment.id,
  REPLACE(attachment.name, '.pdf', ''),
  '业务规范',
  CASE WHEN attachment.name LIKE '%财务%' THEN '操作说明' ELSE '培训资料' END,
  'V1',
  '已发布',
  CASE WHEN attachment.name LIKE '%操作手册%' THEN 1 ELSE 0 END,
  DATE('2026-01-01'),
  NULL,
  NOW(),
  @sim_admin_user_id,
  '超级管理员',
  'SIM3Y 模拟资料中心条目'
FROM archive_attachments attachment
WHERE attachment.name IN ('SIM3Y-业务操作手册.pdf', 'SIM3Y-财务核对说明.pdf');

DROP TEMPORARY TABLE IF EXISTS tmp_sim_weeks;
CREATE TEMPORARY TABLE tmp_sim_weeks (
  weekSeq int NOT NULL PRIMARY KEY
);
INSERT INTO tmp_sim_weeks (weekSeq)
VALUES (0), (1), (2), (3), (4), (5), (6), (7);

INSERT INTO archive_weekly_reports (
  createTime,
  updateTime,
  ownerUserId,
  ownerName,
  departmentName,
  weekStart,
  weekEnd,
  title,
  completedWork,
  dailyWork,
  weeklySummary,
  blockers,
  nextPlan,
  generatedJson,
  sourceType,
  status,
  submittedAt
)
SELECT
  NOW(6),
  NOW(6),
  employee.userId,
  employee.employeeName,
  employee.departmentName,
  DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY),
  DATE_ADD(DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), INTERVAL 6 DAY),
  CONCAT(DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), ' 工作周报'),
  '完成订单推进、客户沟通、资料整理和财务核对等模拟事项。',
  JSON_ARRAY(
    JSON_OBJECT('date', DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), 'weekday', '周一', 'content', '跟进订单和服务项状态'),
    JSON_OBJECT('date', DATE_ADD(DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), INTERVAL 1 DAY), 'weekday', '周二', 'content', '整理客户资料和归档附件'),
    JSON_OBJECT('date', DATE_ADD(DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), INTERVAL 2 DAY), 'weekday', '周三', 'content', '核对合同、发票和收款匹配'),
    JSON_OBJECT('date', DATE_ADD(DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), INTERVAL 3 DAY), 'weekday', '周四', 'content', '处理异常服务项和待确认事项'),
    JSON_OBJECT('date', DATE_ADD(DATE_SUB(@sim_week_base, INTERVAL week.weekSeq * 7 DAY), INTERVAL 4 DAY), 'weekday', '周五', 'content', '汇总本周进展和下周计划')
  ),
  '本周模拟完成多项客户服务推进，财务闭环数据保持可追溯。',
  CASE WHEN MOD(employee.employeeSeq + week.weekSeq, 4) = 0 THEN '部分单位资料补充较慢，需要下周继续跟进。' ELSE NULL END,
  '继续推进未完成服务项、逾期提醒、未匹配流水和资料归档。',
  JSON_OBJECT('source', 'SIM3Y', 'employeeSeq', employee.employeeSeq, 'weekSeq', week.weekSeq),
  CASE WHEN MOD(employee.employeeSeq + week.weekSeq, 3) = 0 THEN '手工填写' ELSE '系统生成' END,
  CASE WHEN MOD(employee.employeeSeq + week.weekSeq, 5) = 0 THEN '草稿' ELSE '已提交' END,
  CASE WHEN MOD(employee.employeeSeq + week.weekSeq, 5) = 0 THEN NULL ELSE NOW() END
FROM tmp_sim_employees employee
CROSS JOIN tmp_sim_weeks week;

INSERT INTO commission_rules (
  createTime,
  updateTime,
  title,
  roleType,
  serviceCode,
  serviceName,
  baseType,
  rate,
  fixedAmount,
  effectiveFrom,
  effectiveTo,
  note,
  enabled,
  sort
)
VALUES
  (NOW(6), NOW(6), 'SIM3Y-接单人提成', 'receiver', NULL, NULL, 'received_amount', 0.030000, 0.00, DATE('2024-01-01'), DATE('2026-12-31'), 'SIM3Y 模拟规则', 1, 10),
  (NOW(6), NOW(6), 'SIM3Y-完成人提成', 'performer', NULL, NULL, 'received_amount', 0.070000, 0.00, DATE('2024-01-01'), DATE('2026-12-31'), 'SIM3Y 模拟规则', 1, 20);

DROP TEMPORARY TABLE IF EXISTS tmp_sim_commission_line_seed;
CREATE TEMPORARY TABLE tmp_sim_commission_line_seed AS
SELECT
  0 AS settlementId,
  item.serviceYear,
  item.receiverId AS employeeId,
  item.receiverName AS employeeName,
  'receiver' AS roleType,
  receiver_rule.id AS ruleId,
  receiver_rule.title AS ruleTitle,
  'received_amount' AS baseType,
  item.id AS orderServiceItemId,
  allocation.id AS paymentServiceAllocationId,
  item.orderNo,
  item.regionName,
  item.unitCode,
  item.unitName AS clientName,
  item.serviceCode,
  item.serviceName,
  allocation.allocatedAmount AS baseAmount,
  receiver_rule.rate,
  0.00 AS fixedAmount,
  CAST(allocation.allocatedAmount * receiver_rule.rate AS DECIMAL(12, 2)) AS commissionAmount
FROM payment_service_allocations allocation
JOIN service_items item
  ON item.id = allocation.order_service_item_id
JOIN commission_rules receiver_rule
  ON receiver_rule.title = 'SIM3Y-接单人提成'
WHERE item.remark LIKE CONCAT(@sim_prefix, ' 模拟服务项%')
  AND allocation.allocatedAmount > 0
UNION ALL
SELECT
  0 AS settlementId,
  item.serviceYear,
  item.performerId AS employeeId,
  item.performerName AS employeeName,
  'performer' AS roleType,
  performer_rule.id AS ruleId,
  performer_rule.title AS ruleTitle,
  'received_amount' AS baseType,
  item.id AS orderServiceItemId,
  allocation.id AS paymentServiceAllocationId,
  item.orderNo,
  item.regionName,
  item.unitCode,
  item.unitName AS clientName,
  item.serviceCode,
  item.serviceName,
  allocation.allocatedAmount AS baseAmount,
  performer_rule.rate,
  0.00 AS fixedAmount,
  CAST(allocation.allocatedAmount * performer_rule.rate AS DECIMAL(12, 2)) AS commissionAmount
FROM payment_service_allocations allocation
JOIN service_items item
  ON item.id = allocation.order_service_item_id
JOIN commission_rules performer_rule
  ON performer_rule.title = 'SIM3Y-完成人提成'
WHERE item.remark LIKE CONCAT(@sim_prefix, ' 模拟服务项%')
  AND allocation.allocatedAmount > 0;

ALTER TABLE tmp_sim_commission_line_seed
  ADD INDEX idx_tmp_commission_employee_year (employeeId, serviceYear),
  ADD INDEX idx_tmp_commission_settlement (settlementId);

INSERT INTO commission_settlements (
  createTime,
  updateTime,
  employeeId,
  employeeName,
  serviceYear,
  serviceCode,
  serviceName,
  periodStart,
  periodEnd,
  totalAmount,
  status,
  confirmedBy,
  confirmedAt,
  paidAt,
  cancelledAt
)
SELECT
  NOW(6),
  NOW(6),
  employeeId,
  employeeName,
  serviceYear,
  NULL,
  NULL,
  STR_TO_DATE(CONCAT(serviceYear, '-01-01'), '%Y-%m-%d'),
  STR_TO_DATE(CONCAT(serviceYear, '-12-31'), '%Y-%m-%d'),
  SUM(commissionAmount),
  CASE
    WHEN serviceYear = @sim_start_year THEN 'paid'
    WHEN serviceYear = @sim_start_year + 1 THEN 'confirmed'
    ELSE 'draft'
  END,
  CASE WHEN serviceYear < @sim_start_year + 2 THEN @sim_admin_user_id ELSE NULL END,
  CASE WHEN serviceYear < @sim_start_year + 2 THEN NOW() ELSE NULL END,
  CASE WHEN serviceYear = @sim_start_year THEN NOW() ELSE NULL END,
  NULL
FROM tmp_sim_commission_line_seed
GROUP BY employeeId, employeeName, serviceYear;

UPDATE tmp_sim_commission_line_seed seed
JOIN commission_settlements settlement
  ON settlement.employeeId = seed.employeeId
  AND settlement.serviceYear = seed.serviceYear
  AND settlement.periodStart = STR_TO_DATE(CONCAT(seed.serviceYear, '-01-01'), '%Y-%m-%d')
  AND settlement.deleteTime IS NULL
SET seed.settlementId = settlement.id;

INSERT INTO commission_lines (
  createTime,
  updateTime,
  settlementId,
  order_service_item_id,
  paymentServiceAllocationId,
  employeeId,
  employeeName,
  roleType,
  ruleId,
  ruleTitle,
  baseType,
  orderNo,
  serviceYear,
  regionName,
  unitCode,
  clientName,
  serviceCode,
  serviceName,
  baseAmount,
  rate,
  fixedAmount,
  commissionAmount
)
SELECT
  NOW(6),
  NOW(6),
  settlementId,
  orderServiceItemId,
  paymentServiceAllocationId,
  employeeId,
  employeeName,
  roleType,
  ruleId,
  ruleTitle,
  baseType,
  orderNo,
  serviceYear,
  regionName,
  unitCode,
  clientName,
  serviceCode,
  serviceName,
  baseAmount,
  rate,
  fixedAmount,
  commissionAmount
FROM tmp_sim_commission_line_seed
WHERE settlementId > 0;

INSERT INTO client_summaries (
  createTime,
  updateTime,
  clientId,
  orderCount,
  serviceItemCount,
  contactCount,
  credentialCount,
  latestOrderDate,
  receivableAmount,
  receivedAmount,
  unpaidAmount
)
SELECT
  NOW(6),
  NOW(6),
  client.id,
  COUNT(DISTINCT o.id) AS orderCount,
  COUNT(DISTINCT item.id) AS serviceItemCount,
  COUNT(DISTINCT contact.id) AS contactCount,
  COUNT(DISTINCT credential.id) AS credentialCount,
  MAX(o.orderDate) AS latestOrderDate,
  COALESCE((
    SELECT SUM(inner_item.billableAmount)
    FROM service_items inner_item
    WHERE inner_item.clientId = client.id
      AND inner_item.deleteTime IS NULL
  ), 0.00) AS receivableAmount,
  COALESCE((
    SELECT SUM(inner_item.receivedAmount)
    FROM service_items inner_item
    WHERE inner_item.clientId = client.id
      AND inner_item.deleteTime IS NULL
  ), 0.00) AS receivedAmount,
  COALESCE((
    SELECT SUM(inner_item.billableAmount - inner_item.receivedAmount)
    FROM service_items inner_item
    WHERE inner_item.clientId = client.id
      AND inner_item.deleteTime IS NULL
  ), 0.00) AS unpaidAmount
FROM clients client
LEFT JOIN orders o
  ON o.clientId = client.id
  AND o.deleteTime IS NULL
LEFT JOIN service_items item
  ON item.clientId = client.id
  AND item.deleteTime IS NULL
LEFT JOIN client_contacts contact
  ON contact.clientId = client.id
  AND contact.deleteTime IS NULL
LEFT JOIN client_credentials credential
  ON credential.clientId = client.id
  AND credential.deleteTime IS NULL
WHERE client.deleteTime IS NULL
GROUP BY client.id
ON DUPLICATE KEY UPDATE
  updateTime = VALUES(updateTime),
  orderCount = VALUES(orderCount),
  serviceItemCount = VALUES(serviceItemCount),
  contactCount = VALUES(contactCount),
  credentialCount = VALUES(credentialCount),
  latestOrderDate = VALUES(latestOrderDate),
  receivableAmount = VALUES(receivableAmount),
  receivedAmount = VALUES(receivedAmount),
  unpaidAmount = VALUES(unpaidAmount);

COMMIT;

SELECT 'SIM3Y 模拟数据生成完成' AS message;
SELECT 'orders' AS tableName, COUNT(*) AS rowsGenerated FROM orders WHERE remark LIKE CONCAT(@sim_prefix, ' 三年模拟订单:%')
UNION ALL
SELECT 'service_items', COUNT(*) FROM service_items WHERE remark LIKE CONCAT(@sim_prefix, ' 模拟服务项%')
UNION ALL
SELECT 'finance_contracts', COUNT(*) FROM finance_contracts WHERE contractNo LIKE CONCAT(@sim_prefix, '-%')
UNION ALL
SELECT 'finance_invoices', COUNT(*) FROM finance_invoices WHERE invoiceNo LIKE CONCAT(@sim_prefix, '-%')
UNION ALL
SELECT 'finance_payments', COUNT(*) FROM finance_payments WHERE bankSerialNo LIKE CONCAT(@sim_prefix, '-%')
UNION ALL
SELECT 'archive_attachments', COUNT(*) FROM archive_attachments WHERE name LIKE CONCAT(@sim_prefix, '-%')
UNION ALL
SELECT 'archive_weekly_reports', COUNT(*) FROM archive_weekly_reports WHERE JSON_UNQUOTE(JSON_EXTRACT(generatedJson, '$.source')) = @sim_prefix
UNION ALL
SELECT 'commission_settlements', COUNT(*) FROM commission_settlements WHERE EXISTS (
  SELECT 1
  FROM commission_lines line
  JOIN service_items item
    ON item.id = line.order_service_item_id
  WHERE line.settlementId = commission_settlements.id
    AND item.remark LIKE CONCAT(@sim_prefix, ' 模拟服务项%')
);
