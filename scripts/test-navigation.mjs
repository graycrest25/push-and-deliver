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
