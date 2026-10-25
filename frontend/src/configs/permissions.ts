export type Role = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'DISPATCHER';

/** UI actions gated by role. Mirrors the `authorize(...)` calls of the matching backend routes. */
export type Permission = 'staff:manage' | 'dispatch:operate' | 'wards:manage';

const PERMISSION_ROLES: Readonly<Record<Permission, readonly Role[]>> = {
  'staff:manage': ['ADMIN'],
  'dispatch:operate': ['ADMIN', 'DISPATCHER'],
  'wards:manage': ['ADMIN'],
};

/** Routes that only some roles may open. A route that is not listed is open to every signed-in user. */
export const ROUTE_ROLES: Readonly<Record<string, readonly Role[]>> = {
  '/staff': ['ADMIN', 'DOCTOR', 'NURSE'],
  '/dispatch': ['ADMIN', 'DISPATCHER'],
  '/audit-logs': ['ADMIN'],
};

export const hasPermission = (role: string | undefined, permission: Permission): boolean =>
  !!role && (PERMISSION_ROLES[permission] as readonly string[]).includes(role);

export const canAccessRoute = (role: string | undefined, path: string): boolean => {
  const allowed: readonly string[] | undefined = ROUTE_ROLES[path];
  return !allowed || (!!role && allowed.includes(role));
};
