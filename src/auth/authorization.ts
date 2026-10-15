import type { NextFunction, Request, Response } from 'express';
import type { Institution } from '../domain/institution.js';
import type { EnterpriseRole, UserPrincipal, UserScope } from './types.js';

export const ENTERPRISE_PERMISSIONS = [
  'institution.view',
  'metric.write',
  'risk.recompute',
  'alerts.view',
  'alerts.manage',
  'integrations.view',
  'enterprise.admin'
] as const;

export type EnterprisePermission = typeof ENTERPRISE_PERMISSIONS[number];

const permissionsByRole: Record<EnterpriseRole, ReadonlySet<EnterprisePermission>> = {
  super_admin: new Set(ENTERPRISE_PERMISSIONS),
  executive: new Set(['institution.view', 'alerts.view', 'integrations.view']),
  regional_specialist: new Set(['institution.view', 'metric.write', 'risk.recompute', 'alerts.view', 'alerts.manage', 'integrations.view']),
  district_manager: new Set(['institution.view', 'metric.write', 'alerts.view', 'alerts.manage']),
  institution_manager: new Set(['institution.view', 'metric.write', 'alerts.view']),
  viewer: new Set(['institution.view', 'alerts.view'])
};

const knownPermissions = new Set<string>(ENTERPRISE_PERMISSIONS);
const provinceWideRoles = new Set<EnterpriseRole>(['super_admin', 'executive', 'regional_specialist']);

export function principalFromSession(session: unknown): UserPrincipal | null {
  if (!session || typeof session !== 'object') return null;
  const value = session as Record<string, unknown>;
  const username = typeof value.username === 'string' ? value.username : '';
  if (!username) return null;

  // Backward-compatible bridge while old in-memory tests and sessions are phased out.
  if (value.role === 'admin') {
    return { id: typeof value.userId === 'string' ? value.userId : `legacy:${username}`, username, role: 'super_admin', scopes: [] };
  }

  const role = value.role;
  if (typeof role !== 'string' || !(role in permissionsByRole)) return null;
  const rawScopes = Array.isArray(value.scopes) ? value.scopes : [];
  const scopes: UserScope[] = rawScopes.flatMap(scope => {
    if (!scope || typeof scope !== 'object') return [];
    const item = scope as Record<string, unknown>;
    const districtKey = typeof item.districtKey === 'string' && item.districtKey ? item.districtKey : undefined;
    const institutionId = typeof item.institutionId === 'string' && item.institutionId ? item.institutionId : undefined;
    return districtKey || institutionId ? [{ ...(districtKey ? { districtKey } : {}), ...(institutionId ? { institutionId } : {}) }] : [];
  });

  return {
    id: typeof value.userId === 'string' ? value.userId : (typeof value.id === 'string' ? value.id : `session:${username}`),
    username,
    role: role as EnterpriseRole,
    scopes
  };
}

export function can(principal: UserPrincipal | null | undefined, permission: EnterprisePermission): boolean {
  if (!principal || !knownPermissions.has(permission)) return false;
  const rolePermissions = permissionsByRole[principal.role];
  return Boolean(rolePermissions?.has(permission));
}

export function canAccessInstitution(principal: UserPrincipal | null | undefined, institution: Institution): boolean {
  if (!principal) return false;
  if (provinceWideRoles.has(principal.role)) return true;
  if (!principal.scopes.length) return false;
  return principal.scopes.some(scope =>
    (scope.institutionId != null && scope.institutionId === institution.id) ||
    (scope.districtKey != null && scope.districtKey === institution.districtKey)
  );
}

export function filterInstitutionsForPrincipal(principal: UserPrincipal | null | undefined, institutions: Institution[]) {
  if (!principal) return [];
  if (provinceWideRoles.has(principal.role)) return institutions;
  return institutions.filter(institution => canAccessInstitution(principal, institution));
}

export function requirePermission(permission: EnterprisePermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const principal = principalFromSession((req as any).session);
    if (!can(principal, permission)) return res.status(403).json({ code: 'forbidden' });
    (req as any).principal = principal;
    next();
  };
}
