export const ENTERPRISE_ROLES = [
  'super_admin',
  'executive',
  'regional_specialist',
  'district_manager',
  'institution_manager',
  'viewer'
] as const;

export type EnterpriseRole = typeof ENTERPRISE_ROLES[number];

export type UserScope = {
  districtKey?: string;
  institutionId?: string;
};

export type UserPrincipal = {
  id: string;
  username: string;
  role: EnterpriseRole;
  scopes: UserScope[];
};

export type UserAccount = UserPrincipal & {
  passwordHash: string;
  isActive: boolean;
};
