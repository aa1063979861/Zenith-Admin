import { applyDecorators, SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';
export const REQUIRED_PERMISSION_MODE_KEY = 'required_permission_mode';
export const REQUIRED_PERMISSION_CHECK_KEY = 'required_permission_check';

export type PermissionMode = 'any' | 'all';

export type PermissionCheck =
  | 'permission:create'
  | 'permission:update'
  | 'permission:delete'
  | 'dictionary:update'
  | 'service-catalog:update'
  | 'client:update'
  | 'role:update'
  | 'user:update';

export function RequirePermissions(...permissionCodes: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissionCodes);
}

export function RequireAllPermissions(...permissionCodes: string[]) {
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissionCodes),
    SetMetadata(REQUIRED_PERMISSION_MODE_KEY, 'all' satisfies PermissionMode),
  );
}

export function RequirePermissionCheck(check: PermissionCheck) {
  return SetMetadata(REQUIRED_PERMISSION_CHECK_KEY, check);
}
