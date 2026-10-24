import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, SETTINGS_NAV_ITEM, findNavItem } from '../navigation';

describe('navigation config', () => {
  it('gives every section its own route', () => {
    const paths = [...NAV_ITEMS, SETTINGS_NAV_ITEM].map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/settings');
  });

  it('finds the section a pathname belongs to, nested routes included', () => {
    expect(findNavItem('/dashboard')?.id).toBe('Overview');
    expect(findNavItem('/patients')?.id).toBe('Patients');
    expect(findNavItem('/patients/42/edit')?.id).toBe('Patients');
    expect(findNavItem('/settings')?.id).toBe('Settings');
  });

  it('does not match a path that merely starts with a route name', () => {
    expect(findNavItem('/patientsarchive')).toBeUndefined();
    expect(findNavItem('/login')).toBeUndefined();
  });
});
