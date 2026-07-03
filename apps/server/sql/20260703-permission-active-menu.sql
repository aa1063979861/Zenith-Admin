SET @active_menu_column_count := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sys_permissions'
    AND COLUMN_NAME = 'activeMenuCode'
);

SET @active_menu_column_sql := IF(
  @active_menu_column_count = 0,
  'ALTER TABLE sys_permissions ADD COLUMN activeMenuCode varchar(120) NULL COMMENT ''隐藏路由激活菜单编码''',
  'SELECT 1'
);

PREPARE active_menu_column_stmt FROM @active_menu_column_sql;
EXECUTE active_menu_column_stmt;
DEALLOCATE PREPARE active_menu_column_stmt;

UPDATE sys_permissions
SET parentId = NULL,
    activeMenuCode = 'FinanceSettlement',
    `show` = 0,
    sort_order = 50
WHERE code = 'CommissionRules'
  AND deleteTime IS NULL;

UPDATE sys_permissions
SET parentId = NULL,
    activeMenuCode = 'RoleMgt',
    `show` = 0,
    sort_order = 7
WHERE code = 'RoleUser'
  AND deleteTime IS NULL;

UPDATE sys_permissions child
JOIN sys_permissions role_menu
  ON role_menu.code = 'RoleMgt'
  AND role_menu.deleteTime IS NULL
SET child.parentId = role_menu.id,
    child.sort_order = CASE child.code
      WHEN 'AddRoleUser' THEN 6
      WHEN 'RemoveRoleUser' THEN 7
      ELSE child.sort_order
    END
WHERE child.code IN ('AddRoleUser', 'RemoveRoleUser')
  AND child.deleteTime IS NULL;

INSERT INTO sys_permissions (
  code,
  name,
  type,
  parentId,
  path,
  component,
  icon,
  layout,
  activeMenuCode,
  `show`,
  enable,
  keepAlive,
  sort_order,
  createTime,
  updateTime
)
SELECT
  'ViewFinance',
  '查看财务底账',
  'BUTTON',
  finance_menu.id,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  1,
  1,
  0,
  1,
  NOW(),
  NOW()
FROM sys_permissions finance_menu
WHERE finance_menu.code = 'FinanceSettlement'
  AND finance_menu.deleteTime IS NULL
ON DUPLICATE KEY UPDATE
  name = '查看财务底账',
  type = 'BUTTON',
  parentId = VALUES(parentId),
  path = NULL,
  component = NULL,
  icon = NULL,
  layout = NULL,
  activeMenuCode = NULL,
  `show` = 1,
  enable = 1,
  keepAlive = 0,
  sort_order = 1,
  deleteTime = NULL,
  updateTime = NOW();

UPDATE sys_permissions child
JOIN sys_permissions finance_menu
  ON finance_menu.code = 'FinanceSettlement'
  AND finance_menu.deleteTime IS NULL
SET child.parentId = finance_menu.id,
    child.name = CASE child.code
      WHEN 'ViewFinance' THEN '查看财务底账'
      WHEN 'MaintainFinanceContract' THEN '维护合同'
      WHEN 'MaintainFinanceInvoice' THEN '维护发票'
      WHEN 'MaintainFinancePayment' THEN '维护收款'
      WHEN 'MatchFinancePayment' THEN '匹配收款发票'
      WHEN 'ImportFinancePayment' THEN '导入银行流水'
      ELSE child.name
    END,
    child.sort_order = CASE child.code
      WHEN 'ViewFinance' THEN 1
      WHEN 'MaintainFinanceContract' THEN 2
      WHEN 'MaintainFinanceInvoice' THEN 3
      WHEN 'MaintainFinancePayment' THEN 4
      WHEN 'MatchFinancePayment' THEN 5
      WHEN 'ImportFinancePayment' THEN 6
      ELSE child.sort_order
    END
WHERE child.code IN (
    'ViewFinance',
    'MaintainFinanceContract',
    'MaintainFinanceInvoice',
    'MaintainFinancePayment',
    'MatchFinancePayment',
    'ImportFinancePayment'
  )
  AND child.deleteTime IS NULL;

INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT DISTINCT role_permission.role_id, view_permission.id
FROM sys_role_permissions role_permission
JOIN sys_permissions write_permission
  ON write_permission.id = role_permission.permission_id
  AND write_permission.code IN (
    'MaintainFinanceContract',
    'MaintainFinanceInvoice',
    'MaintainFinancePayment',
    'MatchFinancePayment',
    'ImportFinancePayment'
  )
  AND write_permission.deleteTime IS NULL
JOIN sys_permissions view_permission
  ON view_permission.code = 'ViewFinance'
  AND view_permission.deleteTime IS NULL
LEFT JOIN sys_role_permissions existed
  ON existed.role_id = role_permission.role_id
  AND existed.permission_id = view_permission.id
WHERE existed.role_id IS NULL;

INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT DISTINCT role_permission.role_id, finance_menu.id
FROM sys_role_permissions role_permission
JOIN sys_permissions view_permission
  ON view_permission.id = role_permission.permission_id
  AND view_permission.code = 'ViewFinance'
  AND view_permission.deleteTime IS NULL
JOIN sys_permissions finance_menu
  ON finance_menu.code = 'FinanceSettlement'
  AND finance_menu.deleteTime IS NULL
LEFT JOIN sys_role_permissions existed
  ON existed.role_id = role_permission.role_id
  AND existed.permission_id = finance_menu.id
WHERE existed.role_id IS NULL;
