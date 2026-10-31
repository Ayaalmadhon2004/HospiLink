export type Role = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'DISPATCHER';

/** UI actions gated by role. Mirrors the `authorize(...)` calls of the matching backend routes. */
export type Permission = 'staff:manage' | 'dispatch:operate' | 'wards:manage'
  | 'clinical:read' | 'notes:write' | 'rx:write' | 'labs:order' | 'labs:result' | 'medications:manage'
  | 'pharmacy:read' | 'pharmacy:manage' | 'pharmacy:dispense' | 'billing:manage' | 'export:clinical' | 'export:billing';

const PERMISSION_ROLES: Readonly<Record<Permission, readonly Role[]>> = {
  'staff:manage': ['ADMIN'],
  'dispatch:operate': ['ADMIN', 'DISPATCHER'],
  'wards:manage': ['ADMIN'],
  'clinical:read': ['ADMIN', 'DOCTOR', 'NURSE'],
  // Nurses write nursing notes only; the note form narrows the type list for them.
  'notes:write': ['DOCTOR', 'NURSE'],
  'rx:write': ['DOCTOR'],
  'labs:order': ['DOCTOR'],
  'labs:result': ['DOCTOR', 'NURSE'],
  'medications:manage': ['ADMIN', 'DOCTOR'],
  'pharmacy:read': ['ADMIN', 'DOCTOR', 'NURSE'],
  'pharmacy:manage': ['ADMIN'], // receive / adjust stock
  'pharmacy:dispense': ['ADMIN', 'DOCTOR', 'NURSE'],
  'billing:manage': ['ADMIN'],
  'export:clinical': ['ADMIN', 'DOCTOR'], // patients, appointments, vitals
  'export:billing': ['ADMIN'],
};

/** Routes that only some roles may open. A route that is not listed is open to every signed-in user. */
export const ROUTE_ROLES: Readonly<Record<string, readonly Role[]>> = {
  '/staff': ['ADMIN', 'DOCTOR', 'NURSE'],
  '/dispatch': ['ADMIN', 'DISPATCHER'],
  '/audit-logs': ['ADMIN'],
  '/users': ['ADMIN'],
  '/pharmacy': ['ADMIN', 'DOCTOR', 'NURSE'],
  '/pharmacy/movements': ['ADMIN'],
  '/billing': ['ADMIN'],
};

export const hasPermission = (role: string | undefined, permission: Permission): boolean =>
  !!role && (PERMISSION_ROLES[permission] as readonly string[]).includes(role);

export const canAccessRoute = (role: string | undefined, path: string): boolean => {
  const allowed: readonly string[] | undefined = ROUTE_ROLES[path];
  return !allowed || (!!role && allowed.includes(role));
};
