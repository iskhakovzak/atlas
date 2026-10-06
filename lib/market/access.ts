import {loginPath} from '../auth/return-to.ts';
export type SessionStatus = 'loading' | 'guest' | 'authenticated' | 'error';
export const memberViews = new Set(['account','favorites','cart','orders','balance','notifications','identity','declaration','batch']);
export const adminViews = new Set(['operations','analytics','admin']);

// ---------- Staff roles and permissions (shared by server and UI; no server imports here) ----------
export const staffRoles = ['support','procurement','warehouse','finance','admin'] as const;
export type StaffRole = typeof staffRoles[number];
export const staffStatuses = ['invited','active','disabled'] as const;
export type StaffStatus = typeof staffStatuses[number];
export const permissions = [
  'operations.read',   // the order queue, customer accounts and their orders
  'operations.act',    // order actions in the queue (purchase, intake, warehouse, parcels)
  'catalog.manage',    // catalog import, cards, collections, publishing
  'pricing.manage',    // tariffs, services, FX refresh
  'policy.manage',     // limits and blocked categories
  'staff.manage',      // the staff directory: roles and access
  'customers.manage',  // customer status: active / review (blocking stays with the administrator)
  'support.reply',     // support replies and customer notifications
  'finance.read',      // the books, analytics, CSV exports
  'finance.write',     // ledger entries, voiding, accounting settings
  'system.manage',     // projection rebuild, backup export, server errors and vitals
  'audit.read',        // the audit log
  'content.manage',    // site content: contacts, legal entity, payment methods, reviews, parcel photos (POST /api/site-content)
] as const;
export type Permission = typeof permissions[number];
export const allPermissions: readonly Permission[] = permissions;
/**
 * Role → permissions. Decisions:
 * - admin: everything (the primary operator from ATLAS_OPERATOR_EMAIL is always admin).
 * - finance: books read/write, the order queue read-only, the audit log.
 * - support: the queue read-only, replies and notifications, customer status active ↔ review
 *   (a full block needs an administrator; see `customerStatusAllowed`).
 * - procurement: the queue with actions and the catalog.
 * - warehouse: the queue with actions (intake, weighing, parcels, warehouse services).
 */
export const rolePermissions: Record<StaffRole, readonly Permission[]> = {
  admin: permissions,
  finance: ['finance.read','finance.write','operations.read','audit.read'],
  support: ['operations.read','support.reply','customers.manage'],
  procurement: ['operations.read','operations.act','catalog.manage'],
  warehouse: ['operations.read','operations.act'],
};
export function isStaffRole(value: unknown): value is StaffRole { return typeof value === 'string' && (staffRoles as readonly string[]).includes(value); }
export function permissionsFor(role?: StaffRole | string | null): Permission[] { return isStaffRole(role) ? [...rolePermissions[role]] : []; }

/** What the server resolved for the signed-in user; `operator` means administrator (full access). */
export type StaffAccess = { operator: boolean; role?: StaffRole; permissions: Permission[] };
export const noAccess: StaffAccess = { operator: false, permissions: [] };
export const adminAccess: StaffAccess = { operator: true, role: 'admin', permissions: [...permissions] };
type AccessLike = boolean | readonly string[] | { operator?: boolean; permissions?: readonly string[] | null } | null | undefined;
function normalizeAccess(value: AccessLike): { operator: boolean; permissions: readonly string[] } {
  if (typeof value === 'boolean') return { operator: value, permissions: value ? permissions : [] };
  if (Array.isArray(value)) return { operator: false, permissions: value };
  if (value && typeof value === 'object') return { operator: !!(value as { operator?: boolean }).operator, permissions: (value as { permissions?: readonly string[] | null }).permissions ?? [] };
  return { operator: false, permissions: [] };
}
export function hasPermission(access: AccessLike, permission: Permission): boolean {
  const normalized = normalizeAccess(access);
  return normalized.operator || normalized.permissions.includes(permission);
}
/** Any staff right at all: the "Manage" entry and the /admin shell open for every active staff member. */
export function hasStaffAccess(access: AccessLike): boolean {
  const normalized = normalizeAccess(access);
  return normalized.operator || normalized.permissions.length > 0;
}

/** Only an email sign-in (email code, Google, Apple) carries a verified address; phone and Telegram never match staff rows. */
export const verifiedEmailMethods = ['email','google','apple'] as const;
export function emailVerifiedSignIn(user: { email?: string | null; method?: string | null }): boolean {
  if (!user.email) return false;
  return user.method == null || (verifiedEmailMethods as readonly string[]).includes(user.method);
}
/**
 * Pure resolution of a user's access: the primary operator (ATLAS_OPERATOR_EMAIL) is always admin;
 * otherwise an `active` staff row with the same (lower-cased) email and a recognised role, and only
 * when the sign-in method proved that email. Invited or disabled rows give nothing.
 */
export function resolveAccess(input: { email?: string | null; method?: string | null; operatorEmail?: string | null; staff?: { role: string; status: string } | null }): StaffAccess {
  if (!emailVerifiedSignIn(input)) return noAccess;
  const email = input.email!.trim().toLowerCase();
  if (input.operatorEmail && email === input.operatorEmail.trim().toLowerCase()) return adminAccess;
  const staff = input.staff;
  if (!staff || staff.status !== 'active' || !isStaffRole(staff.role)) return noAccess;
  return { operator: staff.role === 'admin', role: staff.role, permissions: permissionsFor(staff.role) };
}

/**
 * Operator actions posted to /api/operations (kind: "action") → the permission they need,
 * plus, where a permission is shared by several roles, the roles that may use it.
 *
 * | action                                              | permission     | roles (besides admin)   |
 * |-----------------------------------------------------|----------------|-------------------------|
 * | advance                                             | operations.act | procurement             |
 * | confirm-store-shipping, change-request-create       | operations.act | procurement             |
 * | order-issue-update (may propose a refund)           | operations.act | procurement             |
 * | receive, parcel-set, warehouse-inspect,             | operations.act | warehouse, procurement  |
 * |   warehouse-service-complete/-decline               |                |                         |
 * | order-image, assign-order, staff-note               | operations.act | warehouse, procurement  |
 * | support-reply, customer-notification                | support.reply  | support                 |
 * Customer-only actions (cancel, approve-extra, checkout…) are never operator actions: `undefined`.
 */
export const operatorActions: Record<string, { permission: Permission; roles?: readonly StaffRole[] }> = {
  'advance': { permission: 'operations.act', roles: ['procurement'] },
  'confirm-store-shipping': { permission: 'operations.act', roles: ['procurement'] },
  'confirm-customs-duty': { permission: 'operations.act', roles: ['procurement'] },
  'change-request-create': { permission: 'operations.act', roles: ['procurement'] },
  'order-issue-update': { permission: 'operations.act', roles: ['procurement'] },
  'receive': { permission: 'operations.act' },
  'parcel-set': { permission: 'operations.act' },
  'warehouse-inspect': { permission: 'operations.act' },
  'warehouse-service-complete': { permission: 'operations.act' },
  'warehouse-service-decline': { permission: 'operations.act' },
  'order-image': { permission: 'operations.act' },
  'assign-order': { permission: 'operations.act' },
  'staff-note': { permission: 'operations.act' },
  'support-reply': { permission: 'support.reply' },
  'customer-notification': { permission: 'support.reply' },
};
export const operatorActionTypes = Object.keys(operatorActions);
export function actionPermission(actionType: string): Permission | undefined { return operatorActions[actionType]?.permission; }
/** Admin may do everything; otherwise the permission and, when listed, the role must both match. */
export function canPerformAction(access: StaffAccess | null | undefined, actionType: string): boolean {
  const rule = operatorActions[actionType];
  if (!rule || !access) return false;
  if (access.operator) return true;
  if (!access.permissions.includes(rule.permission)) return false;
  return !rule.roles || (!!access.role && rule.roles.includes(access.role));
}
/** Support puts a customer on review or back to active; only an administrator blocks. */
export function customerStatusAllowed(access: StaffAccess | null | undefined, status: 'active' | 'review' | 'blocked'): boolean {
  if (!access) return false;
  if (access.operator) return true;
  return access.permissions.includes('customers.manage') && status !== 'blocked';
}

/** /api/operations update kinds → permission. */
export const operationsKindPermissions: Record<string, Permission> = {
  'pricing': 'pricing.manage',
  'fx-refresh': 'pricing.manage',
  'policy': 'policy.manage',
  'staff': 'staff.manage',
  'customer-status': 'customers.manage',
  'customer-note': 'customers.manage',
  'staff-deactivate': 'staff.manage',
  'admin-settings': 'system.manage',
  'projection-rebuild': 'system.manage',
};
/** GET /api/operations query sections (`?audit=1`, `?audit=csv`, `?customers=csv`, `?customer=<id>`, `?system=1`) → permission. */
export const operationsQueryPermissions: Record<string, Permission> = {
  'audit': 'audit.read',
  'customers': 'customers.manage',
  'customer': 'customers.manage',
  'system': 'system.manage',
};
/** Admin tabs → permission (`null` = any staff member). */
export const adminTabPermissions: Record<string, Permission | null> = {
  overview: null, catalog: 'catalog.manage', content: 'content.manage', customers: 'customers.manage', support: 'support.reply', finance: 'finance.read',
  pricing: 'pricing.manage', staff: 'staff.manage', rules: 'policy.manage', system: 'system.manage', audit: 'audit.read',
};
/** Admin views → permission: /operations needs the queue, /analytics the books, /admin any staff right. */
export const adminViewPermissions: Record<string, Permission | null> = { operations: 'operations.read', analytics: 'finance.read', admin: null };

/** Third argument: `true` for the administrator, or the user's `{operator, permissions}`. */
export function viewAccess(view: string, status: SessionStatus, access: AccessLike = false) {
  if (!memberViews.has(view) && !adminViews.has(view)) return 'allow';
  if (status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  if (status === 'guest') return 'signin';
  if (!adminViews.has(view)) return 'allow';
  const required = adminViewPermissions[view];
  return (required ? hasPermission(access, required) : hasStaffAccess(access)) ? 'allow' : 'forbidden';
}
export function signInPath(returnTo = '/') {
  return loginPath(returnTo);
}
