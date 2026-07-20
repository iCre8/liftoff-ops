import { describe, expect, it } from 'vitest';

import {
  adminProvisioningPlan,
  normalizeInitialAdminEmail,
  SafeProvisioningError,
  validateProvisioningInvocation,
} from './provision-initial-admin.mjs';

describe('UAT initial administrator provisioning', () => {
  it('normalizes the configured company account without logging it', () => {
    expect(normalizeInitialAdminEmail('  ADMIN@launchpadphilly.org ')).toBe(
      'admin@launchpadphilly.org',
    );
  });

  it('requires an explicit UAT target and keeps apply opt-in', () => {
    expect(() => validateProvisioningInvocation([])).toThrow(SafeProvisioningError);
    expect(validateProvisioningInvocation(['--uat'])).toEqual({ apply: false });
    expect(validateProvisioningInvocation(['--uat', '--apply'])).toEqual({ apply: true });
  });

  it('rejects a non-company account', () => {
    expect(() => normalizeInitialAdminEmail('admin@example.test')).toThrow(SafeProvisioningError);
  });

  it('plans creation when the configured account is absent', () => {
    expect(
      adminProvisioningPlan({
        accountExists: false,
        accountStatus: undefined,
        hasGlobalAdminRole: false,
      }),
    ).toEqual({ createAccount: true, addAdminRole: true });
  });

  it('adds only the missing global administrator role to an active account', () => {
    expect(
      adminProvisioningPlan({
        accountExists: true,
        accountStatus: 'ACTIVE',
        hasGlobalAdminRole: false,
      }),
    ).toEqual({ createAccount: false, addAdminRole: true });
  });

  it('is idempotent when the active administrator is already provisioned', () => {
    expect(
      adminProvisioningPlan({
        accountExists: true,
        accountStatus: 'ACTIVE',
        hasGlobalAdminRole: true,
      }),
    ).toEqual({ createAccount: false, addAdminRole: false });
  });

  it('refuses to reactivate an inactive account', () => {
    expect(() =>
      adminProvisioningPlan({
        accountExists: true,
        accountStatus: 'INACTIVE',
        hasGlobalAdminRole: false,
      }),
    ).toThrow(SafeProvisioningError);
  });
});
