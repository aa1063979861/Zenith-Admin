import * as assert from 'node:assert/strict';

export function matchesPermissionPath(menuPath?: string | null, requestPath?: string | null, code?: string | null) {
  const normalizedMenuPath = normalizePath(menuPath);
  const normalizedRequestPath = normalizePath(requestPath);
  if (!normalizedMenuPath || !normalizedRequestPath)
    return false;
  if (normalizedMenuPath === normalizedRequestPath)
    return true;
  if (isExternalPath(normalizedMenuPath) && code && normalizedRequestPath === `/iframe/${hyphenateCode(code)}`)
    return true;
  if (isExternalPath(normalizedMenuPath))
    return false;

  const menuSegments = normalizedMenuPath.split('/').filter(Boolean);
  const requestSegments = normalizedRequestPath.split('/').filter(Boolean);
  return menuSegments.length === requestSegments.length
    && menuSegments.every((segment, index) => segment.startsWith(':') || segment === requestSegments[index]);
}

function normalizePath(path?: string | null) {
  const rawPath = path?.trim();
  if (!rawPath)
    return '';
  const text = rawPath.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return text || '/';
}

function isExternalPath(path: string) {
  return path.startsWith('http://') || path.startsWith('https://');
}

function hyphenateCode(code: string) {
  return code.replace(/\B([A-Z])/g, '-$1').toLowerCase();
}

if (require.main === module) {
  assert.equal(matchesPermissionPath('/pms/role/user/:roleId', '/pms/role/user/12'), true);
  assert.equal(matchesPermissionPath('/pms/role/user/:roleId', '/pms/role'), false);
  assert.equal(matchesPermissionPath('/', '/'), true);
  assert.equal(matchesPermissionPath('/clients', '/clients?tab=base'), true);
  assert.equal(matchesPermissionPath('https://example.com/docs', '/iframe/external-docs', 'ExternalDocs'), true);
  console.log('permission path checks passed');
}
