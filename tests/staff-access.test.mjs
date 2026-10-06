import test from 'node:test';
import assert from 'node:assert/strict';
import {
 actionPermission,adminAccess,adminTabPermissions,canPerformAction,customerStatusAllowed,emailVerifiedSignIn,hasPermission,hasStaffAccess,
 noAccess,operationsKindPermissions,operatorActionTypes,permissions,permissionsFor,resolveAccess,rolePermissions,staffRoles,viewAccess,
} from '../lib/market/access.ts';
import {actionSchema} from '../lib/market/actions.ts';

test('every role maps only to known permissions; admin holds all of them',()=>{
 for(const role of staffRoles){
  const granted=permissionsFor(role);
  assert.ok(granted.length>0,role);
  for(const permission of granted)assert.ok(permissions.includes(permission),`${role}: ${permission}`);
  assert.deepEqual(granted,[...rolePermissions[role]]);
 }
 assert.deepEqual(new Set(permissionsFor('admin')),new Set(permissions));
 assert.deepEqual(permissionsFor('owner'),[]);
 assert.deepEqual(permissionsFor(undefined),[]);
 assert.deepEqual(permissionsFor(null),[]);
 // The decisions from the task: finance reads the queue and the log, support never acts on orders, warehouse never touches the catalog.
 assert.ok(permissionsFor('finance').includes('operations.read'));
 assert.ok(permissionsFor('finance').includes('audit.read'));
 assert.ok(!permissionsFor('finance').includes('operations.act'));
 assert.ok(!permissionsFor('support').includes('operations.act'));
 assert.ok(permissionsFor('procurement').includes('catalog.manage'));
 assert.ok(!permissionsFor('warehouse').includes('catalog.manage'));
 for(const role of ['support','procurement','warehouse','finance']){
  for(const permission of ['staff.manage','system.manage','pricing.manage','policy.manage'])assert.ok(!permissionsFor(role).includes(permission),`${role} must not hold ${permission}`);
 }
});

test('resolveAccess: the primary operator is always admin, staff need an active row and a verified email',()=>{
 const operatorEmail='Owner@Atlas.uz';
 assert.deepEqual(resolveAccess({email:'owner@atlas.uz',method:'email',operatorEmail}),adminAccess);
 assert.deepEqual(resolveAccess({email:'OWNER@atlas.uz',method:'google',operatorEmail,staff:{role:'support',status:'disabled'}}),adminAccess);
 // Phone and Telegram sessions carry no verified email: never staff, never operator.
 assert.deepEqual(resolveAccess({email:'',method:'phone',operatorEmail,staff:{role:'admin',status:'active'}}),noAccess);
 assert.deepEqual(resolveAccess({email:'owner@atlas.uz',method:'telegram',operatorEmail}),noAccess);
 assert.deepEqual(resolveAccess({email:'owner@atlas.uz',method:'phone',operatorEmail}),noAccess);
 const active=resolveAccess({email:'Anna@atlas.uz',method:'email',operatorEmail,staff:{role:'support',status:'active'}});
 assert.equal(active.operator,false);assert.equal(active.role,'support');assert.deepEqual(active.permissions,permissionsFor('support'));
 const google=resolveAccess({email:'buyer@atlas.uz',method:'google',operatorEmail,staff:{role:'procurement',status:'active'}});
 assert.equal(google.role,'procurement');
 // Invited, disabled, unknown role or no row at all: nothing.
 assert.deepEqual(resolveAccess({email:'anna@atlas.uz',method:'email',operatorEmail,staff:{role:'support',status:'invited'}}),noAccess);
 assert.deepEqual(resolveAccess({email:'anna@atlas.uz',method:'email',operatorEmail,staff:{role:'admin',status:'disabled'}}),noAccess);
 assert.deepEqual(resolveAccess({email:'anna@atlas.uz',method:'email',operatorEmail,staff:{role:'root',status:'active'}}),noAccess);
 assert.deepEqual(resolveAccess({email:'anna@atlas.uz',method:'email',operatorEmail,staff:null}),noAccess);
 assert.deepEqual(resolveAccess({email:'anna@atlas.uz',method:'email',operatorEmail:undefined}),noAccess);
 // A staff row with the admin role is an administrator (operator) too.
 const staffAdmin=resolveAccess({email:'cto@atlas.uz',method:'email',operatorEmail,staff:{role:'admin',status:'active'}});
 assert.equal(staffAdmin.operator,true);assert.equal(staffAdmin.role,'admin');
 // No operator email configured: nobody is admin by accident.
 assert.deepEqual(resolveAccess({email:'anyone@atlas.uz',method:'email',operatorEmail:''}),noAccess);
 assert.equal(emailVerifiedSignIn({email:'a@b.c',method:'apple'}),true);
 assert.equal(emailVerifiedSignIn({email:'a@b.c',method:'phone'}),false);
 assert.equal(emailVerifiedSignIn({email:'',method:'email'}),false);
});

test('hasPermission and hasStaffAccess accept the admin flag, a permission list or the account user shape',()=>{
 assert.equal(hasPermission(true,'system.manage'),true);
 assert.equal(hasPermission(false,'operations.read'),false);
 assert.equal(hasPermission(['operations.read'],'operations.read'),true);
 assert.equal(hasPermission(['operations.read'],'operations.act'),false);
 assert.equal(hasPermission({operator:false,permissions:['finance.read']},'finance.read'),true);
 assert.equal(hasPermission({operator:true,permissions:[]},'finance.read'),true);
 assert.equal(hasPermission({operator:false,permissions:null},'finance.read'),false);
 assert.equal(hasPermission(undefined,'finance.read'),false);
 assert.equal(hasStaffAccess({operator:false,permissions:[]}),false);
 assert.equal(hasStaffAccess({operator:false,permissions:['operations.read']}),true);
 assert.equal(hasStaffAccess(true),true);
 assert.equal(hasStaffAccess(null),false);
});

test('operator actions: every allowed action type exists in the action schema and maps to a permission',()=>{
 const types=new Set(actionSchema.options.map(option=>option.shape.type.value));
 for(const type of operatorActionTypes){assert.ok(types.has(type),type);assert.ok(actionPermission(type),type)}
 // Customer-only actions are never operator actions.
 for(const type of ['cancel','approve-extra','checkout','cart-add','payment-demo','consent-accept','identity-confirm'])assert.equal(actionPermission(type),undefined,type);
 assert.equal(actionPermission('support-reply'),'support.reply');
 assert.equal(actionPermission('customer-notification'),'support.reply');
 assert.equal(actionPermission('receive'),'operations.act');
 assert.equal(actionPermission('advance'),'operations.act');
});

test('canPerformAction follows the role table: procurement buys, warehouse receives, support replies, admin does all',()=>{
 const access=role=>resolveAccess({email:'x@atlas.uz',method:'email',operatorEmail:'owner@atlas.uz',staff:{role,status:'active'}});
 const procurement=access('procurement'),warehouse=access('warehouse'),support=access('support'),finance=access('finance');
 for(const type of operatorActionTypes)assert.equal(canPerformAction(adminAccess,type),true,type);
 for(const type of ['advance','confirm-store-shipping','change-request-create','order-issue-update']){
  assert.equal(canPerformAction(procurement,type),true,type);
  assert.equal(canPerformAction(warehouse,type),false,type);
  assert.equal(canPerformAction(support,type),false,type);
 }
 for(const type of ['receive','parcel-set','warehouse-inspect','warehouse-service-complete','warehouse-service-decline','order-image','assign-order','staff-note']){
  assert.equal(canPerformAction(warehouse,type),true,type);
  assert.equal(canPerformAction(procurement,type),true,type);
  assert.equal(canPerformAction(support,type),false,type);
  assert.equal(canPerformAction(finance,type),false,type);
 }
 for(const type of ['support-reply','customer-notification']){
  assert.equal(canPerformAction(support,type),true,type);
  assert.equal(canPerformAction(warehouse,type),false,type);
  assert.equal(canPerformAction(procurement,type),false,type);
 }
 assert.equal(canPerformAction(procurement,'cancel'),false);
 assert.equal(canPerformAction(adminAccess,'cancel'),false);
 assert.equal(canPerformAction(noAccess,'receive'),false);
 assert.equal(canPerformAction(null,'receive'),false);
 // A permission without the matching role (crafted access object) is still refused for role-limited actions.
 assert.equal(canPerformAction({operator:false,permissions:['operations.act']},'advance'),false);
 assert.equal(canPerformAction({operator:false,permissions:['operations.act']},'receive'),true);
});

test('customer status: support flags for review, only the administrator blocks',()=>{
 const support=resolveAccess({email:'s@atlas.uz',method:'email',operatorEmail:'o@atlas.uz',staff:{role:'support',status:'active'}});
 assert.equal(customerStatusAllowed(support,'review'),true);
 assert.equal(customerStatusAllowed(support,'active'),true);
 assert.equal(customerStatusAllowed(support,'blocked'),false);
 assert.equal(customerStatusAllowed(adminAccess,'blocked'),true);
 const warehouse=resolveAccess({email:'w@atlas.uz',method:'email',operatorEmail:'o@atlas.uz',staff:{role:'warehouse',status:'active'}});
 assert.equal(customerStatusAllowed(warehouse,'review'),false);
 assert.equal(customerStatusAllowed(null,'review'),false);
});

test('operations update kinds and admin tabs each name a permission',()=>{
 for(const kind of ['pricing','fx-refresh','policy','staff','customer-status','projection-rebuild'])assert.ok(permissions.includes(operationsKindPermissions[kind]),kind);
 assert.equal(operationsKindPermissions['action'],undefined);
 for(const tab of ['overview','catalog','customers','support','finance','pricing','staff','rules','system','audit'])assert.ok(tab in adminTabPermissions,tab);
 assert.equal(adminTabPermissions.overview,null);
 assert.equal(adminTabPermissions.staff,'staff.manage');
 assert.equal(adminTabPermissions.system,'system.manage');
});

test('viewAccess with roles: /operations needs the queue, /analytics the books, /admin any staff right',()=>{
 const access=role=>resolveAccess({email:'x@atlas.uz',method:'email',operatorEmail:'owner@atlas.uz',staff:{role,status:'active'}});
 for(const role of staffRoles){
  assert.equal(viewAccess('admin','authenticated',access(role)),'allow',role);
  assert.equal(viewAccess('operations','authenticated',access(role)),'allow',role);
 }
 assert.equal(viewAccess('analytics','authenticated',access('finance')),'allow');
 assert.equal(viewAccess('analytics','authenticated',access('admin')),'allow');
 for(const role of ['support','procurement','warehouse'])assert.equal(viewAccess('analytics','authenticated',access(role)),'forbidden',role);
 for(const view of ['admin','operations','analytics']){
  assert.equal(viewAccess(view,'authenticated',noAccess),'forbidden',view);
  assert.equal(viewAccess(view,'authenticated',{operator:false,permissions:[]}),'forbidden',view);
  assert.equal(viewAccess(view,'authenticated',{operator:false,permissions:undefined}),'forbidden',view);
  assert.equal(viewAccess(view,'guest',adminAccess),'signin',view);
  assert.equal(viewAccess(view,'loading',adminAccess),'loading',view);
 }
 // Member pages never depend on staff rights.
 assert.equal(viewAccess('orders','authenticated',noAccess),'allow');
});
