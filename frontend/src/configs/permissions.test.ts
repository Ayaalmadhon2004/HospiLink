import { describe, it, expect } from 'vitest';
import { canAccessRoute, hasPermission } from './permissions';

describe('permissions', () => {
  it('only ADMIN manages staff', () => {
    expect(hasPermission('ADMIN', 'staff:manage')).toBe(true);
    expect(hasPermission('DOCTOR', 'staff:manage')).toBe(false);
    expect(hasPermission(undefined, 'staff:manage')).toBe(false);
  });

  it('dispatch is operated by ADMIN and DISPATCHER', () => {
    expect(hasPermission('DISPATCHER', 'dispatch:operate')).toBe(true);
    expect(hasPermission('NURSE', 'dispatch:operate')).toBe(false);
  });

  it('restricts /dispatch and /staff but leaves other routes open to signed-in users', () => {
    expect(canAccessRoute('NURSE', '/dispatch')).toBe(false);
    expect(canAccessRoute('DISPATCHER', '/dispatch')).toBe(true);
    expect(canAccessRoute('DISPATCHER', '/staff')).toBe(false);
    expect(canAccessRoute('NURSE', '/staff')).toBe(true);
    expect(canAccessRoute('NURSE', '/patients')).toBe(true);
    expect(canAccessRoute(undefined, '/staff')).toBe(false);
  });
});
