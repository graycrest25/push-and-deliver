import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/navigation.ts', 'utf8');
const iconNames = [...new Set(source.match(/Icon[A-Za-z]+/g))];
const context = vm.createContext(Object.fromEntries(iconNames.map(name => [name, {}])));
function load(path, expose = '') {
  const code = fs.readFileSync(path, 'utf8').replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, '');
  const { outputText } = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  vm.runInContext(outputText.replace(/export /g, '') + expose, context);
}
load('src/lib/admin-access.ts');
load('src/lib/navigation.ts', '\nglobalThis.links = navigation; globalThis.screens = adminScreens;');
assert.equal(new Set(context.links.map(item => item.url)).size, context.links.length, 'No duplicate destinations');
const router = fs.readFileSync('src/router/Router.tsx', 'utf8');
for (const item of context.links) assert(router.includes(`path="${item.url}"`), `${item.url} must have an existing route`);
for (const role of ['super', 'regular', 'customercare', 'verifier']) {
  const links = context.allowedNavigation(role);
  assert.deepEqual(Array.from(links.map(item => item.url)).sort(), Array.from(context.screens[role]).sort(), `${role} navigation must include exactly its authorized screens`);
  for (const item of links) {
    assert.equal(context.navigationForPath(`${item.url}/document-id`).url, item.url, 'Detail pages resolve their parent');
  }
}
assert.equal(context.allowedNavigation('unknown').length, 0);
assert.equal(context.navigationForPath('/users-invalid'), undefined, 'Prefix collisions must not match');
console.log('Navigation tests passed: all existing routes, exact role destinations, detail breadcrumbs, and unknown-role isolation.');

for (const role of ['super', 'regular', 'customercare', 'verifier', '', undefined]) {
  for (const route of ['/head-offices', '/user-activation', '/rider-weekly-deliveries', '/weekly-concentration']) {
    assert.equal(context.canAccessAdminScreen(role, route), role === 'super', `${route} is super-admin only`);
    assert.equal(context.canAccessAdminScreen(role, `${route}/record-id`), role === 'super');
    assert.equal(context.allowedNavigation(role).some(item => item.url === route), role === 'super');
  }
}
for (const role of ['regular', 'customercare']) {
  for (const route of ['/users', '/riders', '/support-tickets', '/shipment-orders']) {
    assert.equal(context.canAccessAdminScreen(role, route), true, 'Preserve pre-existing operational access');
  }
}
console.log('Super-admin feature routes passed: navigation, direct/deep routes, and preserved operational permissions.');

for (const role of ['super', 'regular', 'customercare', 'verifier', 'unknown']) {
  const sidebar = context.sidebarNavigation(role);
  assert.equal(sidebar.some(item => item.url === '/user-activation'), false, 'Activation is never a top-level sidebar item');
  const users = sidebar.find(item => item.url === '/users');
  assert.equal(users?.children.some(item => item.url === '/user-activation') ?? false, role === 'super');
  const destinations = sidebar.flatMap(item => [item.url, ...item.children.map(child => child.url)]);
  assert.deepEqual(Array.from(destinations).sort(), Array.from(context.allowedNavigation(role), item => item.url).sort(), 'Grouping preserves every authorized destination');
}
console.log('Nested Users navigation passed: super-admin activation submenu, no standalone entry, and preserved role-filtered destinations.');

for (const role of ['super', 'regular', 'customercare', 'verifier', 'unknown']) {
  const sidebar = context.sidebarNavigation(role);
  assert.equal(sidebar.some(item => item.url === '/rider-weekly-deliveries'), false);
  const riders = sidebar.find(item => item.url === '/riders');
  assert.equal(riders?.children.some(item => item.url === '/rider-weekly-deliveries') ?? false, role === 'super');
}
console.log('Rider weekly deliveries navigation passed: super-only route and Riders submenu; existing rider detail routes remain intact.');

for (const role of ['super', 'regular', 'customercare', 'verifier', 'unknown']) {
  const sidebar = context.sidebarNavigation(role);
  assert.equal(sidebar.some(item => item.url === '/weekly-concentration'), false);
  const users = sidebar.find(item => item.url === '/users');
  assert.equal(users?.children.some(item => item.url === '/weekly-concentration') ?? false, role === 'super');
  assert.equal(context.canAccessAdminScreen(role, '/weekly-concentration'), role === 'super');
}
console.log('Weekly concentration navigation passed: super-only route within Users submenu.');

for (const role of ['super', 'regular', 'customercare', 'verifier']) {
  const sidebar = context.sidebarNavigation(role);
  assert.equal(sidebar.some(item => item.url === '/coupon-redemption-metrics'), false);
  const coupons = sidebar.find(item => item.url === '/coupons');
  assert.equal(coupons?.children.some(item => item.url === '/coupon-redemption-metrics') ?? false, role === 'super');
  assert.equal(context.canAccessAdminScreen(role, '/coupon-redemption-metrics'), role === 'super');
}
console.log('Coupon metrics navigation passed: super-only route within Coupons submenu.');
