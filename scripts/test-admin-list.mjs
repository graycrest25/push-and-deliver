import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the component's handlers with controlled hook state and API responses.
const slots = [];
const effects = [];
let position = 0;
let dirty = false;
let failNext = false;
const requests = [];
const mutations = [];
const admin = {
  name: "Jane",
  imageurl: null,
  email: "jane@example.com",
  userid: "target",
  isAdmin: true,
  adminType: "regular",
};
const same = (a, b) =>
  a?.length === b?.length &&
  a.every((value, index) => Object.is(value, b[index]));
const context = vm.createContext({
  Error,
  AbortController,
  PAGE_SIZES: [10, 25, 50],
  React: {
    createElement: (type, props, ...children) => ({
      type,
      props: props ?? {},
      children,
    }),
  },
  useState: (initial) => {
    const index = position++;
    slots[index] ??= { value: initial };
    return [
      slots[index].value,
      (value) => {
        const next =
          typeof value === "function" ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) {
          slots[index].value = next;
          dirty = true;
        }
      },
    ];
  },
  useRef: (value) => {
    const index = position++;
    slots[index] ??= { current: value };
    return slots[index];
  },
  useCallback: (callback, deps) => {
    const index = position++;
    if (!slots[index] || !same(slots[index].deps, deps))
      slots[index] = { value: callback, deps };
    return slots[index].value;
  },
  useEffect: (callback, deps) => {
    const index = position++;
    if (!slots[index] || !same(slots[index].deps, deps)) {
      const cleanup = slots[index]?.cleanup;
      slots[index] = { deps };
      effects.push(() => {
        cleanup?.();
        slots[index].cleanup = callback();
      });
    }
  },
  listAdminUsers: async (options) => {
    requests.push(options);
    if (failNext && options.pageToken) throw new Error("Next page unavailable");
    const users = options.pageToken || options.pageSize === 25 ? [admin] : [];
    return {
      success: true,
      users,
      count: users.length,
      scannedCount: options.pageSize,
      pageSize: options.pageSize,
      nextPageToken: options.pageToken ? null : "NEXT_TOKEN",
    };
  },
});
for (const name of [
  "Button",
  "Badge",
  "Input",
  "Select",
  "SelectContent",
  "SelectItem",
  "SelectTrigger",
  "SelectValue",
  "Skeleton",
  "Table",
  "TableBody",
  "TableCell",
  "TableHead",
  "TableHeader",
  "TableRow",
  "IconUserCircle",
])
  context[name] = name;
const source = fs
  .readFileSync("src/pages/admin/admin-accounts-list.tsx", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\n/gm, "");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.React,
  },
});
vm.runInContext(outputText.replace(/export /g, ""), context);
let tree;
function render() {
  position = 0;
  dirty = false;
  tree = context.AdminAccountsList({
    currentUid: "caller",
    updatingUid: null,
    onRoleChange: async (uid, value) => {
      mutations.push({ uid, value });
      return { success: true, uid, isAdmin: false, adminType: "" };
    },
  });
  while (effects.length) effects.shift()();
}
function nodes(node, type) {
  if (Array.isArray(node)) return node.flatMap((value) => nodes(value, type));
  if (!node || typeof node !== "object") return [];
  return [...(node.type === type ? [node] : []), ...nodes(node.children, type)];
}
function content(node) {
  if (Array.isArray(node)) return node.map(content).join("");
  if (!node || typeof node !== "object") return node ?? "";
  return content(node.children);
}
const button = (name) =>
  nodes(tree, "Button").find((node) => content(node) === name);
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
  if (dirty) render();
}
render();
await settle();
assert.equal(requests[0].pageSize, 10);
assert.equal(requests[0].pageToken, undefined);
assert.equal(
  button("Next").props.disabled,
  false,
  "Empty batches with a continuation token must allow Next",
);
assert.equal(button("Previous").props.disabled, true);

failNext = true;
button("Next").props.onClick();
await settle();
assert.equal(requests.at(-1).pageToken, "NEXT_TOKEN");
assert.match(
  content(tree),
  /Page 1/,
  "Failed requests must preserve the loaded page number",
);
assert.match(content(tree), /Next page unavailable/);
failNext = false;
button("Retry").props.onClick();
await settle();
assert.equal(
  requests.at(-1).pageToken,
  "NEXT_TOKEN",
  "Retry must repeat the failed next-page request",
);
assert.match(content(tree), /Page 2/);
assert.equal(button("Next").props.disabled, true, "A null token disables Next");
assert.equal(button("Previous").props.disabled, false);

button("Previous").props.onClick();
await settle();
assert.equal(
  requests.at(-1).pageToken,
  undefined,
  "Returning to the first page must omit the token",
);
assert.match(content(tree), /Page 1/);
const pageSizeSelect = nodes(tree, "Select").find(
  (node) => node.props.value === "10",
);
pageSizeSelect.props.onValueChange("25");
await settle();
assert.equal(requests.at(-1).pageSize, 25);
assert.equal(requests.at(-1).pageToken, undefined);
assert.match(content(tree), /Page 1/);
const roleSelect = nodes(tree, "Select").find(
  (node) => node.props.value === "",
);
roleSelect.props.onValueChange("remove");
await settle();
assert.deepEqual(mutations, [{ uid: "target", value: "remove" }]);
assert.match(content(tree), /0 admins/);
assert.equal(
  button("Next").props.disabled,
  false,
  "Removing an admin must preserve continuation through Auth accounts",
);
for (const slot of slots) slot?.cleanup?.();
assert.equal(
  requests.at(-1).signal.aborted,
  true,
  "Unmounting aborts the active request",
);
console.log(
  "Admin list UI tests passed: sparse batches, token navigation, failed-next retry, final-page disabling, size reset, role removal, and cleanup.",
);
