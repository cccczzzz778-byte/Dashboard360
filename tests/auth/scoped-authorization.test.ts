import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { Institution } from '../../src/domain/institution.js';
import type { UserPrincipal } from '../../src/auth/types.js';

const authzUrl = new URL('../../src/auth/authorization.ts', import.meta.url);
const institution = (id: string, districtKey: string): Institution => ({
  id, districtKey, officialName: id, type: 'TTB', address: null, leaderName: null, phone: null,
  latitude: null, longitude: null, locationAccuracy: 'unknown'
});

const principal = (role: UserPrincipal['role'], scopes: UserPrincipal['scopes'] = []): UserPrincipal => ({
  id: `u-${role}`, username: role, role, scopes
});

test('authorization module exists', () => {
  assert.ok(existsSync(authzUrl), 'src/auth/authorization.ts must exist');
});

test('permissions are role based and default deny', async () => {
  if (!existsSync(authzUrl)) return assert.fail('src/auth/authorization.ts must exist');
  const { can } = await import('../../src/auth/authorization.js');
  assert.equal(can(principal('super_admin'), 'enterprise.admin'), true);
  assert.equal(can(principal('executive'), 'institution.view'), true);
  assert.equal(can(principal('viewer'), 'institution.view'), true);
  assert.equal(can(principal('viewer'), 'metric.write'), false);
  assert.equal(can(principal('institution_manager'), 'risk.recompute'), false);
  assert.equal(can(principal('regional_specialist'), 'risk.recompute'), true);
  assert.equal(can(principal('super_admin'), 'unknown.permission' as any), false, 'unknown permissions must fail closed');
});

test('district and institution scopes block direct-id access outside assigned scope', async () => {
  if (!existsSync(authzUrl)) return assert.fail('src/auth/authorization.ts must exist');
  const { canAccessInstitution } = await import('../../src/auth/authorization.js');
  const gijduvon = institution('inst-gij', 'gijduvon');
  const olot = institution('inst-olot', 'olot');

  assert.equal(canAccessInstitution(principal('super_admin'), olot), true);
  assert.equal(canAccessInstitution(principal('executive'), olot), true);
  assert.equal(canAccessInstitution(principal('regional_specialist'), olot), true);

  const district = principal('district_manager', [{ districtKey: 'gijduvon' }]);
  assert.equal(canAccessInstitution(district, gijduvon), true);
  assert.equal(canAccessInstitution(district, olot), false);

  const manager = principal('institution_manager', [{ institutionId: 'inst-gij' }]);
  assert.equal(canAccessInstitution(manager, gijduvon), true);
  assert.equal(canAccessInstitution(manager, olot), false);

  const viewer = principal('viewer', [{ districtKey: 'gijduvon' }]);
  assert.equal(canAccessInstitution(viewer, gijduvon), true);
  assert.equal(canAccessInstitution(viewer, olot), false);
  assert.equal(canAccessInstitution(principal('viewer'), gijduvon), false, 'scoped roles with no scope must fail closed');
});
