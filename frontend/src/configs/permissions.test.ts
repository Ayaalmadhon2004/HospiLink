import { describe, it, expect } from 'vitest';
import { canAccessRoute, hasPermission, homePath } from './permissions';

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

  it('PHARMACIST runs the pharmacy and the catalogue, and nothing clinical or financial', () => {
    for (const p of ['pharmacy:read', 'pharmacy:manage', 'pharmacy:dispense', 'pharmacy:queue', 'medications:manage'] as const) expect(hasPermission('PHARMACIST', p)).toBe(true);
    for (const p of ['clinical:read', 'rx:write', 'billing:manage', 'export:billing', 'export:clinical', 'wards:manage'] as const) expect(hasPermission('PHARMACIST', p)).toBe(false);
    expect(canAccessRoute('PHARMACIST', '/pharmacy')).toBe(true);
    for (const r of ['/billing', '/patients', '/dashboard', '/beds', '/appointments', '/vitals', '/incidents', '/staff', '/users', '/audit-logs']) expect(canAccessRoute('PHARMACIST', r)).toBe(false);
    expect(canAccessRoute('PHARMACIST', '/settings')).toBe(true);
  });

  it('BILLING runs billing and billing exports, and nothing clinical or pharmacy', () => {
    for (const p of ['billing:manage', 'export:billing'] as const) expect(hasPermission('BILLING', p)).toBe(true);
    for (const p of ['clinical:read', 'pharmacy:read', 'pharmacy:manage', 'pharmacy:dispense', 'pharmacy:queue', 'export:clinical', 'medications:manage'] as const) expect(hasPermission('BILLING', p)).toBe(false);
    expect(canAccessRoute('BILLING', '/billing')).toBe(true);
    for (const r of ['/pharmacy', '/patients', '/dashboard', '/vitals', '/users']) expect(canAccessRoute('BILLING', r)).toBe(false);
  });

  it('clinical roles keep their screens; billing and pharmacy staff land on their own module', () => {
    for (const role of ['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER']) expect(canAccessRoute(role, '/dashboard')).toBe(true);
    expect(canAccessRoute('NURSE', '/pharmacy')).toBe(true);
    expect(canAccessRoute('NURSE', '/billing')).toBe(false);
    expect(homePath('PHARMACIST')).toBe('/pharmacy');
    expect(homePath('BILLING')).toBe('/billing');
    expect(homePath('DOCTOR')).toBe('/dashboard');
    expect(homePath(undefined)).toBe('/dashboard');
  });
});
