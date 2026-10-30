
export const PORTAL_ROLES = {
  officer: ['super_admin', 'senior_management', 'regional_officer'],
  bureau: ['bureau_officer', 'data_operator'],
};

export const ALL_ROLES = [
  ...PORTAL_ROLES.officer,
  ...PORTAL_ROLES.bureau,
];

/**
 * Returns the portal name ('officer' | 'bureau') associated with a given role.
 * @param {string} role
 * @returns {'officer' | 'bureau' | null}
 */
export const portalForRole = (role) => {
  if (PORTAL_ROLES.officer.includes(role)) return 'officer';
  if (PORTAL_ROLES.bureau.includes(role)) return 'bureau';
  return null;
};

export default portalForRole;
